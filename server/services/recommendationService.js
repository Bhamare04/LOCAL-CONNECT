const SCORE_WEIGHTS = {
  interest: 0.5,
  weather: 0.3,
  distance: 0.2
};

function getDistanceScore(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }

  return 1 / (1 + distanceKm / 10);
}

function getRecommendationScore(place) {
  const components = [];
  if (Number.isFinite(place.interest_match)) {
    components.push([SCORE_WEIGHTS.interest, place.interest_match]);
  }
  if (Number.isFinite(place.weather_condition_score)) {
    components.push([SCORE_WEIGHTS.weather, place.weather_condition_score]);
  }
  const distanceScore = getDistanceScore(place.distance_km);
  if (Number.isFinite(distanceScore)) {
    components.push([SCORE_WEIGHTS.distance, distanceScore]);
  }

  if (components.length === 0) {
    return 0;
  }

  const totalWeight = components.reduce((sum, [weight]) => sum + weight, 0);
  return Math.round(
    components.reduce((sum, [weight, value]) => sum + weight * value, 0) / totalWeight * 1000
  ) / 1000;
}

function rankRecommendations(places) {
  return places
    .map((place) => ({
      place_id: place.place_id || null,
      place_name: place.name,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      website: place.website,
      google_maps_url: place.google_maps_url,
      recommendation_score: getRecommendationScore(place),
      interest_match: place.interest_match,
      weather_score: place.weather_condition_score,
      distance_km: place.distance_km
    }))
    .sort((left, right) => right.recommendation_score - left.recommendation_score);
}

module.exports = { rankRecommendations };
