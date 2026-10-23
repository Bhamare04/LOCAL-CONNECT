# Online data pipeline

This pipeline uses the existing server-side integrations without changing the
React frontend or application authentication/chat features:

1. Geoapify geocodes the requested city and discovers tourist places.
2. `placeProcessor.js` applies the existing irrelevant-place filtering and
   duplicate handling.
3. Open-Meteo supplies current city weather (`temperature`, `precipitation`,
   `weather_code`, and `wind_speed`).
4. `collect_online_dataset.py` refreshes `ml/data/online_places.csv`.
5. `validate_online_dataset.py` writes `ml/data/ONLINE_DATASET_STATUS.md`.

Run the collection and validation scripts from the repository root:

```text
python ml/scripts/collect_online_dataset.py
python ml/scripts/validate_online_dataset.py
```

Cities can be changed without editing the script:

```text
python ml/scripts/collect_online_dataset.py --cities Nashik Mumbai Jaipur
```

The baseline endpoint is:

```text
GET /api/travel/recommendations?city=Nashik&interests=Historical,Nature&budget=1000&duration_hours=6
```

It fetches live Geoapify places and Open-Meteo weather, calculates transparent
interest, weather, and optional origin-distance features, then ranks places
with the baseline recommendation engine. Budget and duration preferences are
accepted and returned, but no score is fabricated while verified fee and visit
duration data is unavailable. The endpoint reports weather availability and
continues with weather-dependent score components omitted if Open-Meteo fails.

This is a baseline weighted scoring system, not a trained ML model. No Google
Places API data is used, and no ratings, rating counts, fees, or visit
durations are invented. A future trained model can replace the ranking service
without changing the Geoapify collection contract.
