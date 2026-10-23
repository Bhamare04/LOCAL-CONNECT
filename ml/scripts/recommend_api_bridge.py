from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.recommendation.recommender import TravelRecommender

MODEL_PATH = ROOT / "ml" / "models" / "travel_recommender.pkl"


def error(message: str, exit_code: int = 1) -> int:
    print(message, file=sys.stderr)
    return exit_code


def normalize_place(raw_place: dict[str, Any]) -> dict[str, Any]:
    place = dict(raw_place)
    place.pop("categories", None)
    place["place_id"] = place.get("place_id")
    place["place_name"] = place.get("place_name") or place.get("name") or ""
    place["city"] = place.get("city") or ""
    place["category"] = place.get("category") or "Other"
    place["latitude"] = place.get("latitude")
    place["longitude"] = place.get("longitude")
    place["address"] = place.get("address") or ""
    place["website"] = place.get("website") or ""
    place["google_maps_url"] = place.get("google_maps_url") or ""
    place["temperature"] = place.get("temperature")
    place["precipitation"] = place.get("precipitation")
    place["weather_code"] = place.get("weather_code")
    place["wind_speed"] = place.get("wind_speed")
    return place


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Input JSON must be an object.")

    required_fields = ["user_interests", "selected_city", "top_n", "places"]
    missing = [field for field in required_fields if field not in payload]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    if not isinstance(payload["user_interests"], list):
        raise ValueError("user_interests must be a list.")
    if not isinstance(payload["selected_city"], str) or not payload["selected_city"].strip():
        raise ValueError("selected_city must be a non-empty string.")
    if not isinstance(payload["places"], list):
        raise ValueError("places must be a list.")
    if not isinstance(payload["top_n"], int) or payload["top_n"] <= 0:
        raise ValueError("top_n must be a positive integer.")

    coordinates = payload.get("user_latitude"), payload.get("user_longitude")
    if (coordinates[0] is None) != (coordinates[1] is None):
        raise ValueError("user_latitude and user_longitude must be supplied together.")

    if payload.get("user_latitude") is not None and payload.get("user_longitude") is not None:
        try:
            float(payload["user_latitude"])
            float(payload["user_longitude"])
        except (TypeError, ValueError):
            raise ValueError("user_latitude and user_longitude must be numeric.")

    if payload.get("weather_context") is not None and not isinstance(payload["weather_context"], dict):
        raise ValueError("weather_context must be an object when provided.")

    return payload


def build_recommendation_result(raw_recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for item in raw_recommendations:
        if not isinstance(item, dict):
            continue
        result = {
            "place_id": item.get("place_id"),
            "place_name": item.get("place_name"),
            "city": item.get("city"),
            "category": item.get("category"),
            "recommendation_score": item.get("score"),
            "text_similarity": item.get("components", {}).get("text_similarity"),
            "interest_match": item.get("components", {}).get("interest_match"),
            "weather_suitability": item.get("components", {}).get("weather_suitability"),
            "distance_suitability": item.get("components", {}).get("distance_suitability"),
            "city_match": item.get("components", {}).get("city_match"),
            "distance_km": item.get("distance_km"),
        }
        results.append(result)
    return results


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        validated = validate_payload(payload)

        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

        model = TravelRecommender.load(MODEL_PATH)
        candidate_places = [normalize_place(place) for place in validated["places"]]

        recommendation_payload = model.recommend(
            user_interests=validated["user_interests"],
            selected_city=validated["selected_city"],
            user_latitude=float(validated["user_latitude"]) if validated.get("user_latitude") is not None else None,
            user_longitude=float(validated["user_longitude"]) if validated.get("user_longitude") is not None else None,
            weather_context=validated.get("weather_context"),
            top_n=int(validated["top_n"]),
            candidate_places=pd.DataFrame(candidate_places),
        )

        response = {
            "recommendations": build_recommendation_result(recommendation_payload),
            "model_used": MODEL_PATH.name,
        }

        json.dump(response, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    except Exception as exc:  # pragma: no cover - fails loudly to stderr
        return error(f"ML recommendation bridge failed: {exc}", 1)


if __name__ == "__main__":
    raise SystemExit(main())
