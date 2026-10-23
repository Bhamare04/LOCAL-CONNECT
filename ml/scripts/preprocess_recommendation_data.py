from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.recommendation.feature_engineering import preprocess_recommendation_data

RAW_PATH = ROOT / "ml" / "data" / "online_places.csv"
OUTPUT_PATH = ROOT / "ml" / "data" / "processed_places.csv"


def main() -> int:
    raw = pd.read_csv(RAW_PATH)
    cleaned = preprocess_recommendation_data(raw)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(OUTPUT_PATH, index=False)

    print(f"Raw rows: {len(raw)}")
    print(f"Clean rows: {len(cleaned)}")
    print(f"Processed dataset: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
