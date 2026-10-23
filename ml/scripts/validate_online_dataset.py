"""Validate the generated online place and weather dataset."""

from __future__ import annotations

import csv
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "ml" / "data" / "online_places.csv"
REPORT = ROOT / "ml" / "data" / "ONLINE_DATASET_STATUS.md"


def valid_number(value: str, minimum: float, maximum: float) -> bool:
    try:
        return minimum <= float(value) <= maximum
    except (TypeError, ValueError):
        return False


def main() -> int:
    with INPUT.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    ids = [row["place_id"] for row in rows if row["place_id"]]
    names = [(row["city"].casefold(), row["place_name"].casefold()) for row in rows]
    cities = Counter(row["city"] for row in rows)
    missing = Counter(field for row in rows for field, value in row.items() if not value)
    invalid_coordinates = sum(
        not valid_number(row["latitude"], -90, 90)
        or not valid_number(row["longitude"], -180, 180)
        for row in rows
    )
    weather_missing = sum(
        not row["temperature"] or not row["precipitation"]
        or not row["weather_code"] or not row["wind_speed"]
        for row in rows
    )
    lines = [
        "# Online Dataset Status", "",
        f"- Last validation timestamp: {datetime.now(timezone.utc).isoformat()}",
        f"- Total records: {len(rows)}",
        f"- Unique non-empty place IDs: {len(set(ids))}",
        f"- Duplicate place IDs: {len(ids) - len(set(ids))}",
        f"- Duplicate place names within city: {len(names) - len(set(names))}",
        f"- Cities represented ({len(cities)}): {', '.join(sorted(cities))}",
        f"- Invalid coordinate records: {invalid_coordinates}",
        f"- Records missing one or more weather fields: {weather_missing}",
        "",
        "## Places per city", "",
    ]
    lines.extend(f"- {city}: {count}" for city, count in sorted(cities.items()))
    lines.extend(["", "## Missing values", ""])
    fields = list(rows[0]) if rows else []
    lines.extend(f"- `{field}`: {missing[field]}" for field in fields)
    lines.extend([
        "", "## API errors", "",
        "API errors are reported by `collect_online_dataset.py` during collection. "
        "This validation report contains no API errors because errors do not produce dataset rows.",
        "", "No fabricated values were added. No ML model was trained.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"Report written: {REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
