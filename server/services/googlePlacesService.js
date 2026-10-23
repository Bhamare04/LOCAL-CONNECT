const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'rating',
  'userRatingCount',
  'priceLevel',
  'googleMapsUri'
].join(',');

class GooglePlacesServiceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'GooglePlacesServiceError';
    this.statusCode = statusCode;
  }
}

function getGooglePlacesApiKey() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) {
    throw new GooglePlacesServiceError(
      'Google Places service is not configured. Set GOOGLE_PLACES_API_KEY on the server.',
      503
    );
  }

  return apiKey;
}

function getGoogleErrorMessage(data) {
  return data?.error?.message || data?.error?.status || null;
}

async function requestGoogleJson(url, options, serviceName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new GooglePlacesServiceError(`${serviceName} returned malformed JSON.`, 502);
    }

    if (!response.ok) {
      const providerMessage = getGoogleErrorMessage(data);
      if (response.status === 401 || response.status === 403) {
        throw new GooglePlacesServiceError(
          `${serviceName} authorization failed. Check the API key, billing, and Places API configuration${providerMessage ? `: ${providerMessage}` : '.'}`,
          502
        );
      }

      throw new GooglePlacesServiceError(
        `${serviceName} request failed with status ${response.status}${providerMessage ? `: ${providerMessage}` : '.'}`,
        502
      );
    }

    return data;
  } catch (error) {
    if (error instanceof GooglePlacesServiceError) {
      throw error;
    }

    const message = error.name === 'AbortError'
      ? `${serviceName} request timed out.`
      : `${serviceName} request failed. Please check the network connection and try again.`;

    throw new GooglePlacesServiceError(message, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseText(value) {
  return typeof value === 'string'
    ? value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    : '';
}

function calculateMatchScore(place, sourcePlace, city) {
  const sourceName = normaliseText(sourcePlace.name);
  const candidateName = normaliseText(place.displayName?.text);
  const candidateAddress = normaliseText(place.formattedAddress);
  const cityName = normaliseText(city.city);
  let score = 0;

  if (candidateName === sourceName) {
    score += 100;
  } else if (candidateName.includes(sourceName) || sourceName.includes(candidateName)) {
    score += 60;
  } else {
    const sourceTokens = new Set(sourceName.split(' ').filter(Boolean));
    const matchingTokens = candidateName.split(' ').filter((token) => sourceTokens.has(token)).length;
    score += matchingTokens * 10;
  }

  if (cityName && candidateAddress.includes(cityName)) {
    score += 10;
  }

  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)
    && Number.isFinite(sourcePlace.latitude) && Number.isFinite(sourcePlace.longitude)) {
    const latitudeDifference = latitude - sourcePlace.latitude;
    const longitudeDifference = longitude - sourcePlace.longitude;
    const distanceDegrees = Math.sqrt(latitudeDifference ** 2 + longitudeDifference ** 2);
    if (distanceDegrees <= 0.02) {
      score += 25;
    } else if (distanceDegrees <= 0.1) {
      score += 10;
    }
  }

  return score;
}

async function searchGooglePlace(sourcePlace, city) {
  const apiKey = getGooglePlacesApiKey();
  if (!sourcePlace?.name) {
    throw new GooglePlacesServiceError('A place name is required for Google Places Text Search.', 400);
  }

  const locationContext = [city.city, city.state, city.country].filter(Boolean).join(', ');
  const textQuery = `${sourcePlace.name}, ${locationContext}`;
  const data = await requestGoogleJson(
    `${GOOGLE_PLACES_BASE_URL}/places:searchText`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': SEARCH_FIELD_MASK
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 5
      })
    },
    'Google Places Text Search'
  );

  if (!Array.isArray(data.places)) {
    throw new GooglePlacesServiceError('Google Places Text Search returned a malformed response.', 502);
  }

  if (data.places.length === 0) {
    throw new GooglePlacesServiceError(`Google Places returned no result for "${textQuery}".`, 404);
  }

  const rankedPlaces = data.places
    .map((place) => ({ place, score: calculateMatchScore(place, sourcePlace, city) }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = rankedPlaces[0];

  if (!bestMatch.place.id || bestMatch.score < 25) {
    throw new GooglePlacesServiceError(
      `Google Places returned no reliable match for "${sourcePlace.name}".`,
      404
    );
  }

  return {
    id: bestMatch.place.id,
    displayName: bestMatch.place.displayName?.text || null,
    formattedAddress: bestMatch.place.formattedAddress || null,
    location: bestMatch.place.location || null,
    searchQuery: textQuery
  };
}

async function getGooglePlaceDetails(placeId) {
  const apiKey = getGooglePlacesApiKey();
  if (typeof placeId !== 'string' || !placeId.trim()) {
    throw new GooglePlacesServiceError('A valid Google place ID is required for Place Details.', 400);
  }

  const data = await requestGoogleJson(
    `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId.trim())}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': DETAILS_FIELD_MASK
      }
    },
    'Google Place Details'
  );

  if (!data || typeof data !== 'object' || !data.id) {
    throw new GooglePlacesServiceError('Google Place Details returned a malformed response.', 502);
  }

  return {
    google_place_id: data.id,
    name: data.displayName?.text || null,
    formatted_address: data.formattedAddress || null,
    rating: Number.isFinite(data.rating) ? data.rating : null,
    rating_count: Number.isFinite(data.userRatingCount) ? data.userRatingCount : null,
    price_level: data.priceLevel || null,
    google_maps_url: data.googleMapsUri || null
  };
}

module.exports = {
  GooglePlacesServiceError,
  getGooglePlaceDetails,
  searchGooglePlace
};
