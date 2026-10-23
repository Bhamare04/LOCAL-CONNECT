from __future__ import annotations

import math
from collections.abc import Iterable
from typing import Any


def normalize_text(value: Any, default: str = "") -> str:
    """Return a cleaned text value without unnecessary whitespace."""
    if value is None:
        return default
    if isinstance(value, float) and math.isnan(value):
        return default
    text = str(value).strip()
    if not text:
        return default
    return " ".join(text.split())


def safe_float(value: Any, default: float | None = None) -> float | None:
    if value is None:
        return default
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return default
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    return numeric if math.isfinite(numeric) else default


def normalize_category(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    return text.title()


def _coerce_interests(user_interests: Any) -> list[str]:
    if user_interests is None:
        return []
    if isinstance(user_interests, str):
        items = [part.strip() for part in user_interests.split(",")]
    elif isinstance(user_interests, Iterable):
        items = [str(part).strip() for part in user_interests]
    else:
        items = [str(user_interests).strip()]
    return [item for item in items if item]


def calculate_interest_match(user_interests: Any, place_category: Any) -> float:
    """Return a case-insensitive match score for the supplied interests."""
    place_label = normalize_text(place_category).casefold()
    if not place_label:
        return 0.0

    interests = _coerce_interests(user_interests)
    if not interests:
        return 0.0

    for interest in interests:
        normalized_interest = normalize_text(interest).casefold()
        if not normalized_interest:
            continue
        if normalized_interest == place_label:
            return 1.0
        if normalized_interest in place_label or place_label in normalized_interest:
            return 0.75
    return 0.0


def haversine_distance_km(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:
    """Distance in kilometres between two coordinates using the Haversine formula."""
    radius_km = 6371.0
    latitude_delta = math.radians(latitude_2 - latitude_1)
    longitude_delta = math.radians(longitude_2 - longitude_1)
    start_lat = math.radians(latitude_1)
    end_lat = math.radians(latitude_2)

    a = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(start_lat) * math.cos(end_lat) * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_weather_suitability(place_weather: dict[str, Any] | None, rule_config: dict[str, Any] | None = None) -> float:
    """Return a transparent weather suitability score in the [0, 1] range.

    Rules are intentionally simple and configurable:
    - 1.0: mild or dry conditions
    - 0.5: moderate rain, drizzle, fog, or elevated wind
    - 0.0: severe precipitation or strong wind/extreme conditions
    """
    config = {
        "moderate_codes": {45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82},
        "severe_codes": {2, 3, 4, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 95, 96, 99},
        "moderate_precipitation_mm": 0.5,
        "severe_precipitation_mm": 5.0,
        "moderate_wind_kmh": 30.0,
        "severe_wind_kmh": 60.0,
        **(rule_config or {}),
    }

    if not place_weather:
        return 0.0

    precipitation = safe_float(place_weather.get("precipitation"), 0.0) or 0.0
    wind_speed = safe_float(place_weather.get("wind_speed"), 0.0) or 0.0
    raw_code = place_weather.get("weather_code")
    weather_code = safe_float(raw_code, 0.0)
    if weather_code is None:
        weather_code = 0.0

    if (
        weather_code in config["severe_codes"]
        or precipitation >= config["severe_precipitation_mm"]
        or wind_speed >= config["severe_wind_kmh"]
    ):
        return 0.0

    if (
        weather_code in config["moderate_codes"]
        or precipitation >= config["moderate_precipitation_mm"]
        or wind_speed >= config["moderate_wind_kmh"]
    ):
        return 0.5

    if precipitation > 0:
        return 0.75

    return 1.0
