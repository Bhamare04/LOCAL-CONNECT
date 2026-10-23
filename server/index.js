async function invokeRecommendationFastAPI(payload) {
  const response = await fetch('http://127.0.0.1:8000/recommend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FastAPI recommendation request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}
require('dotenv').config();
const express = require('express');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const {
  TravelServiceError,
  getCoordinates,
  getPlaces,
  getPlaceDetails,
  getWeather
} = require('./services/travelService');
const { processPlaces } = require('./services/placeProcessor');
const { rankRecommendations } = require('./services/recommendationService');
const {
  GooglePlacesServiceError,
  getGooglePlaceDetails,
  searchGooglePlace
} = require('./services/googlePlacesService');

const travelCache = new Map();
const placesCache = new Map();
const weatherCache = new Map();
const CACHE_TTL_MS = 60 * 1000;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ML_BRIDGE_PATH = path.join(PROJECT_ROOT, 'ml', 'scripts', 'recommend_api_bridge.py');

async function getCachedValue(cache, key, loader) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function invokeRecommendationBridge(payload) {
  return new Promise((resolve, reject) => {
    const pythonCommand = process.env.PYTHON_PATH || 'python';
    const child = spawn(pythonCommand, [ML_BRIDGE_PATH], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      reject(new Error(`Unable to start Python recommendation bridge: ${error.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(
          `Python recommendation bridge exited with code ${code}: ${stderr.trim() || 'No diagnostic output.'}`
        ));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (!result || !Array.isArray(result.recommendations)) {
          throw new Error('Bridge response does not contain a recommendations array.');
        }
        resolve(result);
      } catch (error) {
        reject(new Error(`Python recommendation bridge returned invalid JSON: ${error.message}`));
      }
    });

    child.stdin.on('error', (error) => {
      reject(new Error(`Unable to send input to Python recommendation bridge: ${error.message}`));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

const app = express();
app.use(cors());
app.use(express.json()); // Add JSON body parsing

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict this to the frontend URL
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a specific chat room
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat room: ${chatId}`);
  });

  // Leave a specific chat room (optional, but good practice)
  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat room: ${chatId}`);
  });

  // Handle incoming messages
  socket.on('send_message', (data) => {
    // data should contain { chatId, message: { id, senderId, text, createdAt, ... } }
    console.log(`Message received in room ${data.chatId}:`, data.message.text);

  // Broadcast the message to everyone in the room EXCEPT the sender
    socket.to(data.chatId).emit('receive_message', data.message);
  });

  socket.on('webrtc_call_request', (data) => {
    socket.to(data.chatId).emit('webrtc_call_request', data);
  });

  socket.on('webrtc_call_accepted', (data) => {
    socket.to(data.chatId).emit('webrtc_call_accepted', data);
  });

  socket.on('webrtc_call_rejected', (data) => {
    socket.to(data.chatId).emit('webrtc_call_rejected', data);
  });

  socket.on('webrtc_offer', (data) => {
    // data should contain { chatId, offer, senderId }
    socket.to(data.chatId).emit('webrtc_offer', data);
  });

  socket.on('webrtc_answer', (data) => {
    // data should contain { chatId, answer, senderId }
    socket.to(data.chatId).emit('webrtc_answer', data);
  });

  socket.on('webrtc_ice_candidate', (data) => {
    // data should contain { chatId, candidate, senderId }
    socket.to(data.chatId).emit('webrtc_ice_candidate', data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Initialize Gemini Client
let ai;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// AI Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!ai) {
       return res.status(500).json({ 
         error: 'AI is not configured.', 
         reply: 'I am currently offline. Please set the GEMINI_API_KEY in the server to wake me up!' 
       });
    }

    // You can add a system prompt or adjust the model here
    const systemInstruction = "You are a helpful travel assistant for an app called LocalConnect. You help travelers find locals, get city recommendations, and plan itineraries. Keep your responses concise, friendly, and formatted nicely with markdown if possible.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
      }
    });

    res.json({ reply: response.text });
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to process AI request', reply: 'Sorry, I encountered an error while thinking about that.' });
  }
});

// Test-only travel data integration. This route does not change existing application flows.
app.get('/api/travel/test', async (req, res) => {
  const requestedCity = typeof req.query.city === 'string' && req.query.city.trim()
    ? req.query.city.trim()
    : 'Nashik, Maharashtra, India';

  try {
    const city = await getCoordinates(requestedCity);
    const [places, weather] = await Promise.all([
      getPlaces(city.city, { latitude: city.latitude, longitude: city.longitude }),
      getWeather(city.latitude, city.longitude)
    ]);

    return res.json({
      city: {
        name: city.city,
        state: city.state,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude
      },
      weather,
      places,
      ...(places.length === 0 ? { warning: 'No tourist places were returned for this location.' } : {})
    });
  } catch (error) {
    const statusCode = error instanceof TravelServiceError ? error.statusCode : 500;
    const message = error instanceof TravelServiceError
      ? error.message
      : 'Unable to retrieve travel data.';

    console.error('Travel API Error:', error);
    return res.status(statusCode).json({ error: message });
  }
});

function pickDetailFields(feature) {
  const properties = feature.properties || {};

  return {
    place_id: properties.place_id || null,
    name: properties.name || null,
    name_international: properties.name_international || null,
    address: properties.formatted || properties.address_line1 || null,
    latitude: properties.lat ?? feature.geometry?.coordinates?.[1] ?? null,
    longitude: properties.lon ?? feature.geometry?.coordinates?.[0] ?? null,
    website: properties.website || null,
    categories: properties.categories || [],
    opening_hours: properties.opening_hours || null,
    description: properties.description || properties.datasource?.raw?.description || null,
    contact: properties.contact || null,
    facilities: properties.facilities || null
  };
}

// Test one Place Details lookup only; bulk enrichment is intentionally out of scope.
app.get('/api/travel/details-test', async (req, res) => {
  const requestedCity = typeof req.query.city === 'string' && req.query.city.trim()
    ? req.query.city.trim()
    : 'Nashik, Maharashtra, India';

  try {
    const city = await getCoordinates(requestedCity);
    const places = await getPlaces(city.city, {
      latitude: city.latitude,
      longitude: city.longitude
    });

    const basicPlace = places.find((place) => (
      place.place_id && place.categories?.includes('tourism.sights.archaeological_site')
    )) || places.find((place) => place.place_id);

    if (!basicPlace) {
      return res.status(404).json({
        error: 'No Geoapify place_id was returned for places in this city.'
      });
    }

    const providerFeature = await getPlaceDetails(basicPlace.place_id);

    return res.json({
      city: {
        name: city.city,
        state: city.state,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude
      },
      basic_place: basicPlace,
      details: pickDetailFields(providerFeature),
      geoapify_details_feature: providerFeature
    });
  } catch (error) {
    const statusCode = error instanceof TravelServiceError ? error.statusCode : 500;
    const message = error instanceof TravelServiceError
      ? error.message
      : 'Unable to retrieve Geoapify place details.';

    console.error('Travel Details API Error:', error);
    return res.status(statusCode).json({ error: message });
  }
});

app.get('/api/travel/google-details-test', async (req, res) => {
  const requestedCity = typeof req.query.city === 'string' && req.query.city.trim()
    ? req.query.city.trim()
    : 'Nashik, Maharashtra, India';

  try {
    const city = await getCoordinates(requestedCity);
    const places = await getPlaces(city.city, {
      latitude: city.latitude,
      longitude: city.longitude
    });
    const sourcePlace = places.find((place) => (
      place.name?.toLocaleLowerCase() === 'pandav leni caves'
    )) || places.find((place) => (
      place.place_id && place.categories?.includes('tourism.sights.archaeological_site')
    )) || places.find((place) => place.place_id);

    if (!sourcePlace) {
      return res.status(404).json({
        error: 'No suitable Geoapify place was returned for Google Places testing.'
      });
    }

    const googleSearchResult = await searchGooglePlace(sourcePlace, city);
    const googlePlace = await getGooglePlaceDetails(googleSearchResult.id);

    if (!googlePlace.google_maps_url && Number.isFinite(sourcePlace.latitude)
      && Number.isFinite(sourcePlace.longitude)) {
      googlePlace.google_maps_url = `https://www.google.com/maps/search/?api=1&query=${sourcePlace.latitude},${sourcePlace.longitude}`;
    }

    return res.json({
      city: {
        name: city.city,
        state: city.state,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude
      },
      source_place: {
        name: sourcePlace.name,
        geoapify_place_id: sourcePlace.place_id,
        latitude: sourcePlace.latitude,
        longitude: sourcePlace.longitude
      },
      google_place: googlePlace
    });
  } catch (error) {
    const statusCode = error instanceof TravelServiceError || error instanceof GooglePlacesServiceError
      ? error.statusCode
      : 500;
    const message = error instanceof TravelServiceError || error instanceof GooglePlacesServiceError
      ? error.message
      : 'Unable to retrieve Google Place Details.';

    console.error('Google Places Test API Error:', error);
    return res.status(statusCode).json({ error: message });
  }
});

function parseOptionalNumber(value, parameterName, minimum, maximum) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new TravelServiceError(`${parameterName} must be a number.`, 400);
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new TravelServiceError(`${parameterName} must be between ${minimum} and ${maximum}.`, 400);
  }

  return number;
}

function parseTravelPreferences(query) {
  const budget = parseOptionalNumber(query.budget, 'budget', 0, 10000000);
  const durationHours = parseOptionalNumber(query.duration_hours, 'duration_hours', 0, 168);
  const originLatitude = parseOptionalNumber(query.origin_latitude, 'origin_latitude', -90, 90);
  const originLongitude = parseOptionalNumber(query.origin_longitude, 'origin_longitude', -180, 180);

  if ((originLatitude === null) !== (originLongitude === null)) {
    throw new TravelServiceError('origin_latitude and origin_longitude must be provided together.', 400);
  }

  const interests = typeof query.interests === 'string'
    ? query.interests.split(',').map((interest) => interest.trim()).filter(Boolean)
    : [];

  return {
    budget,
    duration_hours: durationHours,
    interests,
    origin: originLatitude === null ? null : { latitude: originLatitude, longitude: originLongitude }
  };
}

// Processed recommendation features remain separate from the raw /api/travel/test response.
app.get('/api/travel/processed', async (req, res) => {
  const requestedCity = typeof req.query.city === 'string' && req.query.city.trim()
    ? req.query.city.trim()
    : 'Nashik, Maharashtra, India';

  try {
    const userPreferences = parseTravelPreferences(req.query);
    const city = await getCoordinates(requestedCity);
    const [rawPlaces, weather] = await Promise.all([
      getPlaces(city.city, { latitude: city.latitude, longitude: city.longitude }),
      getWeather(city.latitude, city.longitude)
    ]);
    const processed = processPlaces(rawPlaces, weather, userPreferences);

    return res.json({
      city: {
        name: city.city,
        state: city.state,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude
      },
      weather,
      places: processed.places,
      processing: processed.summary
    });
  } catch (error) {
    const statusCode = error instanceof TravelServiceError ? error.statusCode : 500;
    const message = error instanceof TravelServiceError
      ? error.message
      : 'Unable to process travel data.';

    console.error('Processed Travel API Error:', error);
    return res.status(statusCode).json({ error: message });
  }
});

app.get('/api/travel/fastapi-test', async (req, res) => {
  const payload = {
    user_interests: ['Nature', 'Historical'],
    selected_city: 'Nashik',
    user_latitude: null,
    user_longitude: null,
    weather_context: null,
    top_n: 3,
    places: [
      {
        place_name: 'Pandav Leni Caves',
        city: 'Nashik',
        category: 'Historical',
        latitude: 19.9405513,
        longitude: 73.7496264,
        temperature: 31.3,
        precipitation: 0,
        weather_code: 0,
        wind_speed: 8.7
      },
      {
        place_name: 'Dolphin',
        city: 'Nashik',
        category: 'Sightseeing',
        latitude: 20.0069605,
        longitude: 73.7848788,
        temperature: 31.3,
        precipitation: 0,
        weather_code: 0,
        wind_speed: 8.7
      },
      {
        place_name: 'Buddha Smarak',
        city: 'Nashik',
        category: 'Religious',
        latitude: 19.9440207,
        longitude: 73.7480635,
        temperature: 31.3,
        precipitation: 0,
        weather_code: 0,
        wind_speed: 8.7
      }
    ]
  };

  try {
    const result = await invokeRecommendationFastAPI(payload);
    return res.json(result);
  } catch (error) {
    console.error('FastAPI Test Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

function normalizeModelRecommendations(modelResult, candidatePlaces) {
  const candidateById = new Map(
    candidatePlaces
      .filter((place) => place.place_id)
      .map((place) => [place.place_id, place])
  );
  const candidateByName = new Map(
    candidatePlaces
      .filter((place) => place.place_name)
      .map((place) => [place.place_name, place])
  );

  return (Array.isArray(modelResult?.recommendations) ? modelResult.recommendations : [])
    .map((recommendation) => {
      const components = recommendation.components || {};
      const candidate = candidateById.get(recommendation.place_id)
        || candidateByName.get(recommendation.place_name)
        || {};

      return {
        ...candidate,
        place_id: recommendation.place_id ?? candidate.place_id ?? null,
        place_name: recommendation.place_name ?? candidate.place_name ?? candidate.name ?? null,
        city: recommendation.city ?? candidate.city ?? null,
        category: recommendation.category ?? candidate.category ?? null,
        recommendation_score: recommendation.score ?? recommendation.recommendation_score ?? null,
        text_similarity: recommendation.text_similarity ?? components.text_similarity ?? null,
        interest_match: recommendation.interest_match ?? components.interest_match ?? null,
        weather_suitability: recommendation.weather_suitability
          ?? components.weather_suitability
          ?? null,
        distance_suitability: recommendation.distance_suitability
          ?? components.distance_suitability
          ?? null,
        city_match: recommendation.city_match ?? components.city_match ?? null,
        distance_km: recommendation.distance_km ?? candidate.distance_km ?? null,
        google_maps_url: candidate.google_maps_url || null
      };
    });
}

app.get('/api/travel/recommendations', async (req, res) => {
  const requestedCity = typeof req.query.city === 'string' && req.query.city.trim()
    ? req.query.city.trim()
    : 'Nashik, Maharashtra, India';

  try {
    const userPreferences = parseTravelPreferences(req.query);
    const city = await getCachedValue(travelCache, requestedCity.toLocaleLowerCase(), () => (
      getCoordinates(requestedCity)
    ));
    const rawPlaces = await getCachedValue(placesCache, `places:${city.city.toLocaleLowerCase()}`, () => (
      getPlaces(city.city, { latitude: city.latitude, longitude: city.longitude })
    ));
    let weather = null;
    let weatherUnavailable = false;
    try {
      weather = await getCachedValue(weatherCache, `weather:${city.city.toLocaleLowerCase()}`, () => (
        getWeather(city.latitude, city.longitude)
      ));
    } catch (error) {
      if (!(error instanceof TravelServiceError)) {
        throw error;
      }
      weatherUnavailable = true;
      console.error('Recommendation weather unavailable:', error.message);
    }

    const processed = processPlaces(rawPlaces, weather, userPreferences);
    const candidatePlaces = processed.places.map((place) => {
      const source = rawPlaces.find((rawPlace) => (
        rawPlace.name === place.name
        && rawPlace.latitude === place.latitude
        && rawPlace.longitude === place.longitude
      ));
      return {
        ...place,
        place_id: source?.place_id || null,
        place_name: place.name,
        city: city.city
      };
    });
    const recommendationPayload = {
      user_interests: userPreferences.interests,
      selected_city: city.city,
      user_latitude: userPreferences.origin?.latitude ?? null,
      user_longitude: userPreferences.origin?.longitude ?? null,
      weather_context: weather
        ? {
          temperature: weather.temperature,
          precipitation: weather.precipitation,
          weather_code: weather.weather_code,
          wind_speed: weather.wind_speed
        }
        : null,
      top_n: 10,
      places: candidatePlaces.map((place) => ({
        place_id: place.place_id,
        place_name: place.place_name,
        city: place.city,
        category: place.category,
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address,
        website: place.website,
        temperature: place.temperature,
        precipitation: place.precipitation,
        weather_code: place.weather_code,
        wind_speed: place.wind_speed
      }))
    };

    let recommendationResult;
    try {
      recommendationResult = await invokeRecommendationFastAPI(recommendationPayload);
    } catch (fastApiError) {
      console.error(
        'FastAPI recommendation failed, falling back to Python bridge:',
        fastApiError
      );
      try {
        recommendationResult = await invokeRecommendationBridge(recommendationPayload);
      } catch (bridgeError) {
        console.error('Python bridge recommendation fallback failed:', bridgeError);
        return res.status(500).json({
          error: 'Recommendation service failed',
          details: bridgeError.message
        });
      }
    }

    const recommendations = normalizeModelRecommendations(
      recommendationResult,
      candidatePlaces
    );

    return res.json({
      city: city.city,
      weather,
      weather_available: !weatherUnavailable,
      preferences: userPreferences,
      model_used: recommendationResult.model_used,
      recommendations,
      processing: processed.summary
    });
  } catch (error) {
    const statusCode = error instanceof TravelServiceError ? error.statusCode : 500;
    const message = error instanceof TravelServiceError
      ? error.message
      : 'Unable to generate travel recommendations.';

    console.error('Recommendations API Error:', error);
    return res.status(statusCode).json({ error: message });
  }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Socket.io server is running on port ${PORT}`);
});
