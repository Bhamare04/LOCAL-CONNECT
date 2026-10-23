const CATEGORY_RULES = [
  { prefix: 'tourism.sights.archaeological_site', value: 'Historical' },
  { prefix: 'tourism.sights.ruines', value: 'Historical' },
  { prefix: 'tourism.sights.fort', value: 'Historical' },
  { prefix: 'tourism.sights.castle', value: 'Historical' },
  { prefix: 'tourism.sights.monastery', value: 'Historical' },
  { prefix: 'tourism.attraction.artwork', value: 'Cultural' },
  { prefix: 'religion', value: 'Religious' },
  { prefix: 'tourism.sights.place_of_worship', value: 'Religious' },
  { prefix: 'natural', value: 'Nature' },
  { prefix: 'leisure.park', value: 'Nature' },
  { prefix: 'beach', value: 'Nature' },
  { prefix: 'tourism.attraction', value: 'Attraction' },
  { prefix: 'tourism.sights', value: 'Sightseeing' }
];

const IRRELEVANT_CATEGORY_PREFIXES = [
  'amenity',
  'service',
  'public_transport',
  'healthcare',
  'commercial',
  'utility'
];

const GENERIC_NAME_PATTERN = /^(statue|memorial|monument|marker|unnamed|unknown)$/i;
const GENERIC_SCULPTURE_NAME_PATTERN = /\b(statue|putala)\b/i;
const DUPLICATE_DISTANCE_KM = 0.1;

function buildGoogleMapsUrl(latitude, longitude) {
  if (!Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function getCategoryList(place) {
  const categories = Array.isArray(place?.categories) ? place.categories : [];
  const fallbackCategory = typeof place?.category === 'string' ? [place.category] : [];

  return [...new Set([...categories, ...fallbackCategory]
    .filter((category) => typeof category === 'string' && category.trim())
    .map((category) => category.trim()))];
}

function classifyCategory(categories) {
  for (const rule of CATEGORY_RULES) {
    if (categories.some((category) => category === rule.prefix || category.startsWith(`${rule.prefix}.`))) {
      return rule.value;
    }
  }

  return 'Other';
}

function normalisePlaceName(name) {
  return name
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function haversineDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB))
    * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function roundDistance(distance) {
  return Math.round(distance * 1000) / 1000;
}

function hasCoordinates(place) {
  return Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

function shouldFilterPlace(name, categories) {
  if (!name || GENERIC_NAME_PATTERN.test(name.trim())) {
    return 'irrelevant';
  }

  const isGenericSculpture = categories.includes('tourism.attraction.artwork.statue')
    && GENERIC_SCULPTURE_NAME_PATTERN.test(name);
  if (isGenericSculpture) {
    return 'irrelevant';
  }

  if (categories.some((category) => IRRELEVANT_CATEGORY_PREFIXES
    .some((prefix) => category === prefix || category.startsWith(`${prefix}.`)))) {
    return 'irrelevant';
  }

  return null;
}

function getWeatherConditionScore(cityWeather) {
  const weatherCode = cityWeather?.weather_code;
  const precipitation = cityWeather?.precipitation;
  const windSpeed = cityWeather?.wind_speed;
  const hasWeatherSignal = Number.isFinite(weatherCode)
    || Number.isFinite(precipitation)
    || Number.isFinite(windSpeed);

  if (!hasWeatherSignal) {
    return null;
  }

  const severeWeatherCodes = new Set([65, 67, 75, 82, 86, 96, 99]);
  const moderateWeatherCodes = new Set([3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 66, 71, 73, 77, 80, 81, 85]);
  const isSevere = severeWeatherCodes.has(weatherCode)
    || (Number.isFinite(precipitation) && precipitation > 5)
    || (Number.isFinite(windSpeed) && windSpeed > 60);

  if (isSevere) {
    return 0;
  }

  const isModerate = moderateWeatherCodes.has(weatherCode)
    || (Number.isFinite(precipitation) && precipitation > 0.5)
    || (Number.isFinite(windSpeed) && windSpeed >= 30);

  return isModerate ? 0.5 : 1;
}

function getInterestMatch(category, interests) {
  if (!Array.isArray(interests) || interests.length === 0) {
    return null;
  }

  const normalizedInterests = interests
    .filter((interest) => typeof interest === 'string')
    .map((interest) => interest.trim().toLocaleLowerCase())
    .filter(Boolean);

  if (normalizedInterests.length === 0) {
    return null;
  }

  return normalizedInterests.includes(category.toLocaleLowerCase()) ? 1 : 0;
}

function getDistanceFromOrigin(place, origin) {
  if (!hasCoordinates(place)
    || !Number.isFinite(origin?.latitude)
    || !Number.isFinite(origin?.longitude)) {
    return null;
  }

  return roundDistance(haversineDistanceKm(
    origin.latitude,
    origin.longitude,
    place.latitude,
    place.longitude
  ));
}

function processPlaces(rawPlaces, cityWeather, userPreferences = {}) {
  const places = Array.isArray(rawPlaces) ? rawPlaces : [];
  const processedPlaces = [];
  const summary = {
    raw_place_count: places.length,
    processed_place_count: 0,
    filtered_place_count: 0,
    filtered_irrelevant_count: 0,
    filtered_duplicate_count: 0
  };
  const weatherConditionScore = getWeatherConditionScore(cityWeather);

  for (const rawPlace of places) {
    const name = typeof rawPlace?.name === 'string' && rawPlace.name.trim()
      ? rawPlace.name.trim()
      : null;
    const categories = getCategoryList(rawPlace);
    const filterReason = shouldFilterPlace(name, categories);

    if (filterReason) {
      summary.filtered_place_count += 1;
      summary.filtered_irrelevant_count += 1;
      continue;
    }

    const place = {
      name,
      latitude: Number.isFinite(rawPlace.latitude) ? rawPlace.latitude : null,
      longitude: Number.isFinite(rawPlace.longitude) ? rawPlace.longitude : null,
      google_maps_url: buildGoogleMapsUrl(rawPlace.latitude, rawPlace.longitude),
      address: typeof rawPlace.address === 'string' && rawPlace.address.trim() ? rawPlace.address.trim() : null,
      website: typeof rawPlace.website === 'string' && rawPlace.website.trim() ? rawPlace.website.trim() : null,
      categories,
      category: classifyCategory(categories),
      entry_fee: null,
      average_rating: null,
      rating_count: null,
      estimated_visit_hours: null,
      weather_condition_score: weatherConditionScore,
      interest_match: null,
      distance_km: null
    };
    const normalizedName = normalisePlaceName(place.name);
    const isDuplicate = processedPlaces.some((keptPlace) => (
      normalisePlaceName(keptPlace.name) === normalizedName
      && hasCoordinates(keptPlace)
      && hasCoordinates(place)
      && haversineDistanceKm(
        keptPlace.latitude,
        keptPlace.longitude,
        place.latitude,
        place.longitude
      ) <= DUPLICATE_DISTANCE_KM
    ));

    if (isDuplicate) {
      summary.filtered_place_count += 1;
      summary.filtered_duplicate_count += 1;
      continue;
    }

    place.interest_match = getInterestMatch(place.category, userPreferences.interests);
    place.distance_km = getDistanceFromOrigin(place, userPreferences.origin);
    processedPlaces.push(place);
  }

  summary.processed_place_count = processedPlaces.length;
  return { places: processedPlaces, summary };
}

module.exports = {
  CATEGORY_RULES,
  classifyCategory,
  getWeatherConditionScore,
  haversineDistanceKm,
  processPlaces
};
