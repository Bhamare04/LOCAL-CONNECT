"""Validate and prepare the real Geoapify catalogue for future ML work."""

from __future__ import annotations

import argparse
import csv
import math
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "ml" / "data" / "places_real.csv"
OUTPUT = ROOT / "ml" / "data" / "ml_places.csv"
STATUS = ROOT / "ml" / "data" / "ML_DATASET_STATUS.md"
INPUT_FIELDS = [
    "place_id",
    "place_name",
    "city",
    "category",
    "latitude",
    "longitude",
]
OUTPUT_FIELDS = INPUT_FIELDS + ["distance_km", "category_encoded"]
UNKNOWN_ROW_NAME = "shrutisharma"
EARTH_RADIUS_KM = 6371.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin-latitude", type=float)
    parser.add_argument("--origin-longitude", type=float)
    args = parser.parse_args()
    if (args.origin_latitude is None) != (args.origin_longitude is None):
        parser.error("--origin-latitude and --origin-longitude must be supplied together.")
    if args.origin_latitude is not None and not -90 <= args.origin_latitude <= 90:
        parser.error("--origin-latitude must be between -90 and 90.")
    if args.origin_longitude is not None and not -180 <= args.origin_longitude <= 180:
        parser.error("--origin-longitude must be between -180 and 180.")
    return args


def parse_coordinate(value: str, minimum: float, maximum: float) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and minimum <= number <= maximum else None


def haversine_km(
    latitude: float,
    longitude: float,
    origin_latitude: float,
    origin_longitude: float,
) -> float:
    radians = math.pi / 180
    delta_latitude = (latitude - origin_latitude) * radians
    delta_longitude = (longitude - origin_longitude) * radians
    latitude_a = origin_latitude * radians
    latitude_b = latitude * radians
    value = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(latitude_a)
        * math.cos(latitude_b)
        * math.sin(delta_longitude / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def normalise_name(value: str) -> str:
    return " ".join(value.casefold().split())


def read_rows() -> list[dict[str, str]]:
    with INPUT.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing_columns = [field for field in INPUT_FIELDS if field not in (reader.fieldnames or [])]
        if missing_columns:
            raise ValueError(f"Input dataset is missing columns: {', '.join(missing_columns)}")
        return list(reader)


def write_rows(rows: list[dict[str, str]]) -> None:
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def prepare_rows(
    source_rows: list[dict[str, str]],
    origin_latitude: float | None,
    origin_longitude: float | None,
) -> tuple[
    list[dict[str, str]],
    list[str],
    Counter[str],
    Counter[str],
    list[str],
    Counter[str],
    Counter[str],
]:
    removed: list[str] = []
    invalid_coordinates = Counter()
    blank_required = Counter()
    duplicate_ids = Counter()
    duplicate_names = Counter()
    usable_candidates: list[dict[str, str]] = []

    for index, row in enumerate(source_rows, start=2):
        name = row["place_name"].strip()
        city = row["city"].strip()
        place_id = row["place_id"].strip()
        reasons: list[str] = []
        if normalise_name(name) == UNKNOWN_ROW_NAME:
            reasons.append(
                "excluded shrutisharma: opaque personal-name-like label, blank Geoapify place_id, "
                "and no verifiable tourist/place identity"
            )
        for field in ("place_name", "city", "category"):
            if not row[field].strip():
                blank_required[field] += 1
                reasons.append(f"blank required field: {field}")
        latitude = parse_coordinate(row["latitude"], -90, 90)
        longitude = parse_coordinate(row["longitude"], -180, 180)
        if latitude is None or longitude is None:
            invalid_coordinates["invalid latitude/longitude"] += 1
            reasons.append("invalid latitude/longitude")
        if reasons:
            removed.append(f"row {index} ({name or '<blank>'}): {'; '.join(reasons)}")
            continue
        candidate = dict(row)
        candidate["latitude"] = str(latitude)
        candidate["longitude"] = str(longitude)
        usable_candidates.append(candidate)

    seen_ids: set[str] = set()
    seen_names: set[tuple[str, str]] = set()
    usable: list[dict[str, str]] = []
    for row in usable_candidates:
        place_id = row["place_id"].strip()
        name_key = (normalise_name(row["place_name"]), normalise_name(row["city"]))
        reasons: list[str] = []
        if place_id and place_id in seen_ids:
            duplicate_ids[place_id] += 1
            reasons.append(f"duplicate place_id: {place_id}")
        if name_key in seen_names:
            duplicate_names[f"{row['place_name']} ({row['city']})"] += 1
            reasons.append("duplicate place name within city")
        if reasons:
            removed.append(f"{row['place_name']} ({row['city']}): {'; '.join(reasons)}")
            continue
        if place_id:
            seen_ids.add(place_id)
        seen_names.add(name_key)
        usable.append(row)

    categories = sorted({row["category"].strip() for row in usable})
    category_codes = {category: code for code, category in enumerate(categories)}
    output: list[dict[str, str]] = []
    for row in usable:
        distance = ""
        if origin_latitude is not None and origin_longitude is not None:
            distance = f"{haversine_km(float(row['latitude']), float(row['longitude']), origin_latitude, origin_longitude):.3f}"
        output.append({
            **{field: row[field].strip() for field in INPUT_FIELDS},
            "distance_km": distance,
            "category_encoded": str(category_codes[row["category"].strip()]),
        })
    return output, removed, duplicate_ids, duplicate_names, categories, invalid_coordinates, blank_required


def missing_values(rows: list[dict[str, str]]) -> Counter[str]:
    return Counter(field for row in rows for field in OUTPUT_FIELDS if not row[field].strip())


def write_status(
    source_rows: list[dict[str, str]],
    output_rows: list[dict[str, str]],
    removed: list[str],
    duplicate_ids: Counter[str],
    duplicate_names: Counter[str],
    categories: list[str],
    origin_supplied: bool,
    invalid_coordinates: Counter[str],
    blank_required: Counter[str],
) -> None:
    cities = sorted({row["city"] for row in output_rows})
    category_counts = Counter(row["category"] for row in output_rows)
    missing = missing_values(output_rows)
    lines = [
        "# ML Dataset Status",
        "",
        "Generated by `ml/scripts/prepare_ml_dataset.py` from `ml/data/places_real.csv`.",
        "",
        "## Statistics",
        "",
        f"- Original row count: {len(source_rows)}",
        f"- Final usable row count: {len(output_rows)}",
        f"- Cities represented ({len(cities)}): {', '.join(cities)}",
        f"- Unique non-empty place IDs: {len({row['place_id'] for row in output_rows if row['place_id']})}",
        "",
        "## Removed rows and reasons",
        "",
    ]
    lines.extend(f"- {reason}" for reason in removed or ["None"])
    lines.extend([
        "",
        "## Categories represented",
        "",
    ])
    lines.extend(f"- `{category}`: {category_counts[category]}" for category in sorted(category_counts))
    lines.extend([
        "",
        "## Validation",
        "",
        f"- Duplicate place IDs removed: {sum(duplicate_ids.values())}",
        f"- Duplicate place names within a city removed: {sum(duplicate_names.values())}",
        f"- Invalid coordinate rows removed: {sum(invalid_coordinates.values())}",
        f"- Rows with blank required fields removed: {sum(blank_required.values())}",
        "",
        "## Missing values",
        "",
    ])
    lines.extend(f"- `{field}`: {missing[field]}" for field in OUTPUT_FIELDS)
    lines.extend([
        "",
        "## Engineered features",
        "",
        "- `category_encoded`: deterministic integer code from alphabetically sorted categories.",
        (
            "- `distance_km`: Haversine distance from the optional CLI origin. "
            "It is blank when no user origin is supplied; it is not a fabricated city-centre distance."
        ),
        "",
        "## Dynamic preference features",
        "",
        "`interest_match`, `weather_score`, `budget_score`, and `duration_score` are intentionally not fixed dataset labels. They must be calculated at request time from user preferences, current weather, and verified place facts. The existing server processor already calculates dynamic interest and distance features; unavailable fee and duration facts remain unavailable.",
        "",
        "## Intentionally excluded features",
        "",
        "- `rating`, `rating_count`, `entry_fee`, and `estimated_visit_hours`: no reliable values are present.",
        "- `rain_suitability`, `heat_suitability`, and `best_season`: not reliably supported by this source.",
        "- No Google Places API data is used.",
        "",
        "No fabricated values were added. No ML model was trained.",
    ])
    STATUS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    source_rows = read_rows()
    (
        output_rows,
        removed,
        duplicate_ids,
        duplicate_names,
        categories,
        invalid_coordinates,
        blank_required,
    ) = prepare_rows(
        source_rows, args.origin_latitude, args.origin_longitude
    )
    write_rows(output_rows)
    write_status(
        source_rows,
        output_rows,
        removed,
        duplicate_ids,
        duplicate_names,
        categories,
        args.origin_latitude is not None,
        invalid_coordinates,
        blank_required,
    )
    print(f"Original rows: {len(source_rows)}")
    print(f"Final usable rows: {len(output_rows)}")
    print(f"Cities represented: {len({row['city'] for row in output_rows})}")
    print(f"Categories represented: {len(categories)}")
    print(f"Removed rows: {len(removed)}")
    print(f"Duplicate place IDs removed: {sum(duplicate_ids.values())}")
    print(f"Duplicate names within city removed: {sum(duplicate_names.values())}")
    print(f"Output: {OUTPUT}")
    print(f"Status report: {STATUS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
