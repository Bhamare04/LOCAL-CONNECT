# ML data catalogue

The `ml` directory is reserved for data and later machine-learning work that can support travel recommendations without changing the existing application.

`data/places.csv` is the initial place catalogue. It contains five places for each city already represented in `src/data/mockData.js`, beginning with every existing `topPlaces` entry and adding well-known locations to form a more useful future catalogue.

## Columns

| Column | Meaning |
| --- | --- |
| `place_id` | Stable numeric identifier for a place. |
| `place_name` | Name of the place. |
| `city` | City associated with the place. |
| `category` | Consistent high-level type such as `Historical`, `Nature`, or `Shopping`. |
| `entry_fee` | Numeric admission fee when a verified value is available. |
| `estimated_visit_hours` | Numeric expected visit length in hours when a verified value is available. |
| `average_rating` | Numeric average visitor rating when a verified value is available. |
| `rating_count` | Numeric number of ratings when a verified value is available. |
| `indoor_outdoor` | Whether the place is `Indoor`, `Outdoor`, or `Mixed`. |
| `rain_suitability` | Suitability in rain: `Low`, `Medium`, `High`, or `Unknown`. |
| `heat_suitability` | Suitability in heat: `Low`, `Medium`, `High`, or `Unknown`. |
| `best_season` | `Summer`, `Monsoon`, `Winter`, `All`, or `Unknown`. |

The current project data does not provide place-level fees, visit durations, ratings, rating counts, or weather/season suitability. Those numeric values are intentionally empty and the unsupported categorical values are marked `Unknown` rather than fabricated.

## Content-based recommendation model

The project now includes a first content-based model that uses the real online place catalogue in `ml/data/online_places.csv`.

- `ml/scripts/preprocess_recommendation_data.py` creates `ml/data/processed_places.csv` by cleaning and normalizing the online records without modifying the raw data.
- `ml/scripts/train_recommender.py` trains a TF-IDF + cosine-similarity recommender and saves it to `ml/models/travel_recommender.pkl`.
- `ml/scripts/evaluate_recommender.py` runs a quick sample evaluation for a few user profiles.
- `ml/recommendation/feature_engineering.py` contains the reusable feature engineering utilities.
- `ml/recommendation/recommender.py` contains the `TravelRecommender` implementation.

The scoring is transparent and explainable:

- text similarity: category + city + place name similarity via TF-IDF and cosine similarity;
- interest match: a case-insensitive match between user interests and the place category;
- weather suitability: current weather suitability based on precipitation, wind, and WMO-like weather codes;
- distance suitability: Haversine distance when user coordinates are supplied.

The model intentionally avoids fabricated labels and does not invent ratings, prices, or visit durations.
