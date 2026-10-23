from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.recommendation.recommender import TravelRecommender

MODEL_PATH = ROOT / "ml" / "models" / "travel_recommender.pkl"


def main() -> int:
    model = TravelRecommender.load(MODEL_PATH)
    profiles = [
        {"user_interests": ["Nature", "Historical"], "selected_city": "Mumbai", "user_latitude": 19.0760, "user_longitude": 72.8777},
        {"user_interests": ["Cultural", "Religious"], "selected_city": "Jaipur", "user_latitude": 26.9124, "user_longitude": 75.7873},
        {"user_interests": ["Sightseeing"], "selected_city": "Bangalore"},
    ]
    for profile in profiles:
        recommendations = model.recommend(top_n=5, **profile)
        print(profile)
        print(f"Top score: {recommendations[0]['score'] if recommendations else 0.0}")
        print(f"Top result: {recommendations[0]['place_name'] if recommendations else 'None'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
