require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env'),
  quiet: true
});

const { getCoordinates, getPlaces, getWeather } = require('./travelService');
const { processPlaces } = require('./placeProcessor');

function findSourcePlace(processedPlace, rawPlaces) {
  return rawPlaces.find((rawPlace) => (
    rawPlace.name === processedPlace.name
    && rawPlace.latitude === processedPlace.latitude
    && rawPlace.longitude === processedPlace.longitude
  )) || rawPlaces.find((rawPlace) => rawPlace.name === processedPlace.name);
}

async function collectCity(cityName) {
  const city = await getCoordinates(cityName);
  const rawPlaces = await getPlaces(city.city, {
    latitude: city.latitude,
    longitude: city.longitude
  });
  const weather = process.argv.includes('--weather')
    ? await getWeather(city.latitude, city.longitude)
    : null;
  const processed = processPlaces(rawPlaces, null);

  return {
    city: city.city,
    places: processed.places.map((place) => {
      const sourcePlace = findSourcePlace(place, rawPlaces);
      return {
        place_id: sourcePlace?.place_id || null,
        place_name: place.name,
        city: city.city,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address,
        website: place.website,
        google_maps_url: place.google_maps_url
      };
    }),
    processing: processed.summary,
    weather
  };
}

async function main() {
  const cityName = process.argv[2];
  if (!cityName) {
    throw new Error('A city name is required.');
  }

  const result = await collectCity(cityName);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
