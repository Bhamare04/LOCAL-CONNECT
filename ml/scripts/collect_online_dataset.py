"""Refresh an online Geoapify/Open-Meteo dataset through the existing services."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "server" / "services" / "datasetCollectionBridge.js"
OUTPUT = ROOT / "ml" / "data" / "online_places.csv"
DEFAULT_CITIES = [
    "Mumbai", "Jaipur", "Surat", "Nashik", "Vadodara",
    "Bangalore", "New Delhi", "Chennai", "Hyderabad", "Kolkata",
]
FIELDS = [
    "place_id", "place_name", "city", "category", "latitude", "longitude",
    "address", "website", "google_maps_url", "temperature",
    "precipitation", "weather_code", "wind_speed",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", nargs="+", default=DEFAULT_CITIES)
    args = parser.parse_args()
    rows = []
    errors = []
    collected_at = datetime.now(timezone.utc).isoformat()

    for city in args.cities:
        completed = subprocess.run(
            ["node", str(BRIDGE), city, "--weather"],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=90, check=False,
        )
        if completed.returncode != 0:
            errors.append(f"{city}: {completed.stderr.strip() or 'collection failed'}")
            continue
        try:
            result = json.loads(completed.stdout)
        except json.JSONDecodeError:
            errors.append(f"{city}: bridge returned malformed JSON")
            continue
        weather = result.get("weather") or {}
        for place in result.get("places", []):
            rows.append({
                "place_id": place.get("place_id") or "",
                "place_name": place.get("place_name") or "",
                "city": result.get("city") or city,
                "category": place.get("category") or "",
                "latitude": place.get("latitude") if place.get("latitude") is not None else "",
                "longitude": place.get("longitude") if place.get("longitude") is not None else "",
                "address": place.get("address") or "",
                "website": place.get("website") or "",
                "google_maps_url": place.get("google_maps_url") or "",
                "temperature": weather.get("temperature", ""),
                "precipitation": weather.get("precipitation", ""),
                "weather_code": weather.get("weather_code", ""),
                "wind_speed": weather.get("wind_speed", ""),
            })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Collected {len(rows)} places across {len(args.cities) - len(errors)}/{len(args.cities)} cities.")
    print(f"Dataset written: {OUTPUT}")
    if errors:
        print("API errors:")
        print("\n".join(errors))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
