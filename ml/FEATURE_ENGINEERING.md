# Place processing and feature engineering

This backend-only layer turns the raw place objects returned by the travel API service into deterministic, recommendation-ready records. It does not modify the raw response available from `/api/travel/test`, write to the dataset, or perform an ML prediction.

## Data flow

```text
Geoapify + Open-Meteo -> raw API objects -> placeProcessor.js -> processed API objects -> future ML model
```

## Raw API fields

The current travel service passes these Geoapify-derived fields into the processor when available: `name`, `category`, `categories`, `latitude`, `longitude`, `address`, and `website`. Open-Meteo supplies `temperature`, `precipitation`, `weather_code`, `wind_speed`, and `observed_at` in the city-weather object.

## Processed fields

Each retained place contains:

- API-derived fields: `name`, `latitude`, `longitude`, `address`, `website`, `categories`
- `category`: a deterministic normalized category
- Future-data fields: `entry_fee`, `average_rating`, `rating_count`, `estimated_visit_hours`, all currently `null`
- Deterministic features: `weather_condition_score`, `interest_match`, and `distance_km`

The response also includes `processing` totals for raw, processed, irrelevant-filtered, and duplicate-filtered places.

## Category mapping

The ordered `CATEGORY_RULES` mapping in [placeProcessor.js](../server/services/placeProcessor.js) is the single source of truth:

| Geoapify category prefix | Normalized category |
| --- | --- |
| `tourism.sights.archaeological_site`, `.ruines`, `.fort`, `.castle`, `.monastery` | `Historical` |
| `tourism.attraction.artwork` | `Cultural` |
| `religion`, `tourism.sights.place_of_worship` | `Religious` |
| `natural`, `leisure.park`, `beach` | `Nature` |
| `tourism.attraction` | `Attraction` |
| `tourism.sights` | `Sightseeing` |
| No confident mapping | `Other` |

The first matching rule wins; the mapping intentionally avoids guessing beyond the API category data.

## Conservative filtering and duplicate handling

The processor filters only:

- places with no meaningful name;
- exactly generic names such as `Statue`, `Memorial`, `Monument`, `Marker`, `Unnamed`, or `Unknown`;
- statue-category POIs whose name explicitly identifies only a public statue or `putala`;
- utility-oriented category prefixes (`amenity`, `service`, `public_transport`, `healthcare`, `commercial`, `utility`);
- duplicates only when the normalized names are identical **and** valid coordinates are within 0.1 km.

Nearby places with different names, or same-named places without verifiable coordinates, are retained.

## Weather condition score

`weather_condition_score` is a transparent current-weather suitability feature, not a prediction:

- `1`: no severe/moderate condition is reported.
- `0.5`: moderate WMO weather codes (overcast, fog, drizzle, light/moderate rain or snow), precipitation above 0.5 mm, or wind at least 30 km/h.
- `0`: severe WMO codes (heavy rain/snow, violent showers, thunderstorms), precipitation above 5 mm, or wind above 60 km/h.
- `null`: no usable weather code, precipitation, or wind-speed value is supplied.

Severe rules take precedence over moderate rules. These rules apply to any city and do not hardcode Nashik weather.

## Preferences and distance

`interests` is an optional comma-separated query parameter. `interest_match` is `1` when the normalized category exactly matches one supplied interest, `0` when interests are supplied but do not match, and `null` when no usable interests are supplied.

`budget` and `duration_hours` are accepted and validated but do not currently affect ranking because fee and duration facts are unavailable. A caller may also supply both `origin_latitude` and `origin_longitude`; `distance_km` is then calculated using the Haversine formula and rounded to three decimals. It remains `null` without both origin coordinates or place coordinates. The service never reads browser or device location.

## Data still unavailable

`entry_fee`, `average_rating`, `rating_count`, and `estimated_visit_hours` remain `null`. They require an independently reliable source such as an official attraction/tourism site for fees and duration, and one consistently identified public rating source for rating and count. No factual data is invented or inferred.

## Endpoint

```text
GET /api/travel/processed?city=Nashik
GET /api/travel/processed?city=Nashik&budget=1000&duration_hours=6&interests=Historical,Nature
GET /api/travel/processed?city=Nashik&origin_latitude=19.9975&origin_longitude=73.7898
```

No ML model has been trained or loaded. This layer only prepares deterministic features for a later, explicitly designed training step.

## Offline ML dataset preparation

`ml/scripts/prepare_ml_dataset.py` validates `ml/data/places_real.csv`, excludes
the unusable `shrutisharma` row, and writes `ml/data/ml_places.csv`. It retains
provider-derived identity, category, and coordinates, and adds a deterministic
`category_encoded` value. `distance_km` is calculated only when an explicit
origin is passed to the script:

```text
python ml/scripts/prepare_ml_dataset.py --origin-latitude 19.9975 --origin-longitude 73.7898
```

Without an origin, `distance_km` remains blank because a city-centre distance
would be an invented proxy. `interest_match`, `weather_score`, `budget_score`,
and `duration_score` remain dynamic request-time features rather than fixed
training labels.
