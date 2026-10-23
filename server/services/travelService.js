const GEOAPIFY_GEOCODING_URL = 'https://api.geoapify.com/v1/geocode/search';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';
const GEOAPIFY_PLACE_DETAILS_URL = 'https://api.geoapify.com/v2/place-details';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 10_000;

class TravelServiceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'TravelServiceError';
    this.statusCode = statusCode;
  }
}

function getGeoapifyApiKey() {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();

  if (!apiKey) {
    throw new TravelServiceError(
      'Travel places service is not configured. Set GEOAPIFY_API_KEY on the server.',
      503
    );
  }

  return apiKey;
}

async function requestJson(url, serviceName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new TravelServiceError(
        `${serviceName} request failed with status ${response.status}.`,
        502
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TravelServiceError) {
      throw error;
    }

    const message = error.name === 'AbortError'
      ? `${serviceName} request timed out.`
      : `${serviceName} request failed. Please check the network connection and try again.`;

    throw new TravelServiceError(message, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseCityName(city) {
  if (typeof city !== 'string' || !city.trim()) {
    throw new TravelServiceError('A non-empty city query parameter is required.', 400);
  }

  const value = city.trim();
  if (value.length > 120) {
    throw new TravelServiceError('City query parameter must be 120 characters or fewer.', 400);
  }

  return value;
}

async function getCoordinates(city) {
  const apiKey = getGeoapifyApiKey();
  const cityName = normaliseCityName(city);
  const params = new URLSearchParams({
    text: cityName,
    format: 'json',
    type: 'city',
    filter: 'countrycode:in',
    limit: '1',
    apiKey
  });
  const data = await requestJson(`${GEOAPIFY_GEOCODING_URL}?${params}`, 'Geoapify geocoding');
  const result = data.results?.[0];

  if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon)) {
    throw new TravelServiceError(`No geocoding result was found for "${cityName}".`, 404);
  }

  return {
    latitude: result.lat,
    longitude: result.lon,
    city: result.city || result.municipality || cityName,
    state: result.state || null,
    country: result.country || null
  };
}

async function getPlaces(city, options = {}) {
  const apiKey = getGeoapifyApiKey();
  const latitude = options.latitude;
  const longitude = options.longitude;
  const radius = options.radius ?? 10_000;
  const limit = options.limit ?? 20;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new TravelServiceError('Valid latitude and longitude are required to find places.', 400);
  }

  const params = new URLSearchParams({
    categories: 'tourism.sights,tourism.attraction',
    filter: `circle:${longitude},${latitude},${radius}`,
    limit: String(limit),
    apiKey
  });
  const data = await requestJson(`${GEOAPIFY_PLACES_URL}?${params}`, 'Geoapify places');

  return (data.features || []).map((feature) => {
    const properties = feature.properties || {};

    return {
      place_id: properties.place_id || null,
      name: properties.name || null,
      category: properties.categories?.[0] || null,
      categories: properties.categories || [],
      latitude: properties.lat ?? feature.geometry?.coordinates?.[1] ?? null,
      longitude: properties.lon ?? feature.geometry?.coordinates?.[0] ?? null,
      address: properties.formatted || properties.address_line1 || null,
      website: properties.website || null
    };
  });
}

async function getPlaceDetails(placeId) {
  const apiKey = getGeoapifyApiKey();

  if (typeof placeId !== 'string' || !placeId.trim()) {
    throw new TravelServiceError('A valid Geoapify place_id is required to retrieve place details.', 400);
  }

  const params = new URLSearchParams({
    id: placeId.trim(),
    apiKey
  });
  const data = await requestJson(
    `${GEOAPIFY_PLACE_DETAILS_URL}?${params}`,
    'Geoapify Place Details'
  );
  const feature = data.features?.find((item) => item.properties?.feature_type === 'details')
    || data.features?.[0];

  if (!feature) {
    throw new TravelServiceError('Geoapify returned no details for this place.', 404);
  }

  return feature;
}

async function getWeather(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new TravelServiceError('Valid latitude and longitude are required to find weather.', 400);
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
    forecast_days: '1'
  });
  const data = await requestJson(`${OPEN_METEO_FORECAST_URL}?${params}`, 'Open-Meteo weather');
  const current = data.current;

  if (!current) {
    throw new TravelServiceError('Open-Meteo returned no current weather data.', 502);
  }

  return {
    temperature: current.temperature_2m ?? null,
    precipitation: current.precipitation ?? null,
    weather_code: current.weather_code ?? null,
    wind_speed: current.wind_speed_10m ?? null,
    observed_at: current.time ?? null
  };
}

module.exports = {
  TravelServiceError,
  getCoordinates,
  getPlaces,
  getPlaceDetails,
  getWeather
};
