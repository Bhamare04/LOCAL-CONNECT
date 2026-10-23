# Geoapify Place Details enrichment test

This backend-only test adds one Geoapify Place Details lookup to inspect provider data before any bulk enrichment. It does not alter the travel catalogue, use another provider, or create ML data or a model.

## APIs

- **Geoapify Places API** (`/v2/places`) finds nearby POIs. Its GeoJSON feature properties include `place_id`, a Geoapify identifier intended for subsequent detail lookups.
- **Geoapify Place Details API** (`/v2/place-details`) retrieves the default `details` feature for one selected `place_id`. The key remains server-side in `GEOAPIFY_API_KEY`.

## Place ID flow

`getPlaces()` now preserves `properties.place_id` as `place_id` when Geoapify supplies it. The test route selects one returned place that actually has this field and passes it as `id` to Place Details. No identifier is generated or inferred.

## Test endpoint

```text
GET /api/travel/details-test?city=Nashik
```

The response contains:

- `basic_place`: the existing Places API object, including its real `place_id`.
- `details`: selected values from the actual Place Details feature: `place_id`, `name`, `name_international`, `address`, coordinates, `website`, `categories`, `opening_hours`, `description`, `contact`, and `facilities`.
- `geoapify_details_feature`: the unmodified GeoJSON feature returned by Geoapify for this one lookup, allowing the provider payload to be inspected without inventing a schema.

Every optional value is returned as `null` or an empty array when not provided by Geoapify.
The returned Detail feature can contain a `place_id` that differs from the lookup ID while still referring to the same underlying mapped object; both values are preserved rather than replaced.

## Available and unavailable information

Place Details can provide a place’s address, categories, website, opening-hours string, descriptive text, contact data, geometry, and other OpenStreetMap-derived properties when mapped. Availability varies per place.

This integration does **not** provide a reliable recommendation dataset for:

| Field | Availability from this step |
| --- | --- |
| `average_rating` | Not provided as a standardized rating field by this endpoint. |
| `rating_count` | Not provided as a standardized review-count field by this endpoint. |
| `entry_fee` | No verified numeric entry-fee field is created or inferred. An optional OSM tag, if present, is not treated as a verified fee. |
| `estimated_visit_hours` | Not provided. Opening-hours data, if present, is not a visit-duration estimate. |
| Price information | No standardized, verified price field is added. |

No ratings, review counts, fees, prices, or visit durations are fabricated. No ML prediction or model training is performed.

## Google Maps links

Processed places include `google_maps_url`, generated only from the Geoapify latitude and longitude in the format `https://www.google.com/maps/search/?api=1&query=LATITUDE,LONGITUDE`. It requires no Google Places API call or Google API key. Places without valid coordinates return `google_maps_url: null`.

## Google Places test enrichment

Geoapify remains responsible for city geocoding, place discovery, coordinates, categories, addresses, websites, and Geoapify `place_id` values. A Geoapify `place_id` is not a Google place ID and is never sent directly to Google Places.

The proof-of-concept endpoint `GET /api/travel/google-details-test?city=Nashik` uses Google Places API (New) Text Search to find one matching Google place by place name, city, and country. It then uses the returned Google place ID with Google Place Details. The endpoint tests only one place and does not enrich the processed catalogue.

The test requests only `id`, `displayName`, `formattedAddress`, and `location` from Text Search, followed by `id`, `displayName`, `formattedAddress`, `rating`, `userRatingCount`, `priceLevel`, and `googleMapsUri` from Place Details. Missing Google fields are returned as `null`; no ratings, review counts, prices, or other values are inferred.

Google Places values exposed by the test include:

- `rating`
- `userRatingCount` as `rating_count`
- `priceLevel` as `price_level`
- `googleMapsUri` as `google_maps_url`

The server reads `GOOGLE_PLACES_API_KEY` from the server-side environment only. Google Places requires billing and the relevant API to be enabled. Missing configuration, authorization failures, billing/API configuration errors, no reliable search match, HTTP errors, and malformed responses are reported without exposing the API key.
