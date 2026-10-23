"""Collect a real tourist-place dataset through the existing Geoapify service."""

from __future__ import annotations

import csv
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "server" / "services" / "datasetCollectionBridge.js"
OUTPUT = ROOT / "ml" / "data" / "places_real.csv"
NODE_COMMAND = "node"
CITIES = [
    "Mumbai",
    "Jaipur",
    "Surat",
    "Nashik",
    "Vadodara",
    "Bangalore",
    "New Delhi",
    "Chennai",
    "Hyderabad",
    "Kolkata",
]
FIELDNAMES = [
    "place_id",
    "place_name",
    "city",
    "category",
    "latitude",
    "longitude",
    "indoor_outdoor",
    "rain_suitability",
    "heat_suitability",
    "best_season",
]
UNKNOWN_FIELDS = {
    "indoor_outdoor": "Unknown",
    "rain_suitability": "Unknown",
    "heat_suitability": "Unknown",
    "best_season": "Unknown",
}


def run_city(city: str) -> dict[str, Any]:
    """Call the existing Node Geoapify service and return its processed result."""
    completed = subprocess.run(
        [NODE_COMMAND, str(BRIDGE), city],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=90,
        check=False,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or "unknown Geoapify collection error"
        raise RuntimeError(detail)
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("Geoapify bridge returned malformed JSON.") from error
    if not isinstance(result.get("places"), list):
        raise RuntimeError("Geoapify bridge returned no places list.")
    return result


def normalise_name(value: str) -> str:
    return " ".join(value.casefold().split())


def is_valid_coordinate(value: Any, minimum: float, maximum: float) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and minimum <= value <= maximum


def deduplication_key(place: dict[str, Any]) -> tuple[Any, ...]:
    place_id = place.get("place_id")
    if place_id:
        return ("place_id", place_id)
    return (
        "fallback",
        normalise_name(str(place.get("place_name") or "")),
        round(float(place["latitude"]), 5) if is_valid_coordinate(place.get("latitude"), -90, 90) else None,
        round(float(place["longitude"]), 5) if is_valid_coordinate(place.get("longitude"), -180, 180) else None,
    )


def make_row(place: dict[str, Any], city: str) -> dict[str, Any]:
    row = {
        "place_id": place.get("place_id") or "",
        "place_name": place.get("place_name") or "",
        "city": city,
        "category": place.get("category") or "",
        "latitude": place.get("latitude") if place.get("latitude") is not None else "",
        "longitude": place.get("longitude") if place.get("longitude") is not None else "",
        **UNKNOWN_FIELDS,
    }
    return row


def write_dataset(rows: list[dict[str, Any]]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def print_summary(city_counts: dict[str, int], rows: list[dict[str, Any]], errors: dict[str, str]) -> None:
    missing = Counter(
        field
        for row in rows
        for field in FIELDNAMES
        if row[field] == ""
    )
    print(f"Cities processed: {len(CITIES) - len(errors)}/{len(CITIES)}")
    print("Places collected per city:")
    for city in CITIES:
        suffix = f" (error: {errors[city]})" if city in errors else ""
        print(f"  {city}: {city_counts.get(city, 0)}{suffix}")
    print(f"Total unique places: {len(rows)}")
    print("Missing values by column:")
    for field in FIELDNAMES:
        print(f"  {field}: {missing[field]}")


def main() -> int:
    rows_by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
    city_counts: dict[str, int] = {}
    errors: dict[str, str] = {}

    for city in CITIES:
        try:
            result = run_city(city)
            city_rows = [
                make_row(place, city)
                for place in result["places"]
                if isinstance(place, dict) and place.get("place_name")
            ]
            for row in city_rows:
                rows_by_key.setdefault(deduplication_key(row), row)
            city_counts[city] = len(city_rows)
        except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
            errors[city] = str(error)
            city_counts[city] = 0

    rows = list(rows_by_key.values())
    write_dataset(rows)
    print_summary(city_counts, rows, errors)
    print(f"Dataset written: {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
