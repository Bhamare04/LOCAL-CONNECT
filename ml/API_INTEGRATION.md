# Travel API integration

This is a backend-only, test-route integration for live city data. It does not connect to the React UI or perform ML training.

## APIs used

- **Geoapify Geocoding API**: resolves a city to latitude, longitude, city, state, and country.
- **Geoapify Places API**: retrieves nearby tourist attractions and place details.
- **Open-Meteo Forecast API**: retrieves current weather for the resolved coordinates. Open-Meteo does not require an API key.

## Required environment variable

Set this server-side value in the project-root `.env` file. Do not use a `VITE_` prefix and do not expose it to the client.

```env
GEOAPIFY_API_KEY=your_geoapify_key
```

The endpoint returns HTTP `503` with a configuration message until this value is set.

## Endpoint

`GET /api/travel/test?city=Nashik`

`city` is optional and defaults to `Nashik, Maharashtra, India`. A city must be geocodable in India for this test route.

Example requests:

```text
http://localhost:5001/api/travel/test?city=Nashik
http://localhost:5001/api/travel/test?city=Mumbai
```

## Response structure

```json
{
  "city": {
    "name": "...",
    "state": "...",
    "country": "...",
    "latitude": 0,
    "longitude": 0
  },
  "weather": {
    "temperature": 0,
    "precipitation": 0,
    "weather_code": 0,
    "wind_speed": 0,
    "observed_at": "..."
  },
  "places": [
    {
      "name": "...",
      "category": "...",
      "categories": ["..."],
      "latitude": 0,
      "longitude": 0,
      "address": "...",
      "website": "..."
    }
  ]
}
```

Fields without API values are returned as `null` or an empty array; no values are invented. An empty Places response is returned as `places: []` with a warning. Missing configuration, invalid cities, upstream API errors, timeouts, and network errors return a useful JSON `error` and an appropriate HTTP status.

## Data provenance

Geoapify provides the city location and the place `name`, `category`, `categories`, coordinates, address, and website when available. Open-Meteo provides `temperature`, `precipitation`, `weather_code`, `wind_speed`, and `observed_at`.

## Run and test

From the project root, start the existing backend with:

```powershell
node server/index.js
```

After adding a valid Geoapify key, test from a second terminal:

```powershell
Invoke-RestMethod "http://localhost:5001/api/travel/test?city=Nashik"
Invoke-RestMethod "http://localhost:5001/api/travel/test?city=Mumbai"
```
