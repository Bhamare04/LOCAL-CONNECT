from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.recommendation.recommender import TravelRecommender

DATA_PATH = ROOT / "ml" / "data" / "processed_places.csv"
MODEL_PATH = ROOT / "ml" / "models" / "travel_recommender.pkl"


def main() -> int:
    data = pd.read_csv(DATA_PATH)
    model = TravelRecommender(data)
    model.save(MODEL_PATH)
    sample = model.recommend(
        user_interests=["Nature", "Historical"],
        selected_city="Mumbai",
        user_latitude=19.0760,
        user_longitude=72.8777,
        top_n=5,
    )
    print(f"Model saved to: {MODEL_PATH}")
    print(f"Sample recommendations: {sample[:2]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
