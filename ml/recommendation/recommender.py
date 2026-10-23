from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from .feature_engineering import prepare_recommendation_dataset
from .utils import (
    calculate_interest_match,
    calculate_weather_suitability,
    haversine_distance_km,
    normalize_text,
)


class TravelRecommender:
    """Content-based travel recommender built from the real online dataset."""

    def __init__(self, data: pd.DataFrame | None = None):
        self.data: pd.DataFrame | None = None
        self.vectorizer = None
        self.text_matrix = None
        self._model_path: str | None = None
        if data is not None:
            self.fit(data)

    def fit(self, data: pd.DataFrame) -> "TravelRecommender":
        cleaned = prepare_recommendation_dataset(data)
        from sklearn.feature_extraction.text import TfidfVectorizer

        self.data = cleaned.copy()
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        self.text_matrix = self.vectorizer.fit_transform(self.data["text_representation"])
        return self

    def _ensure_fitted(self) -> None:
        if self.data is None or self.vectorizer is None or self.text_matrix is None:
            raise ValueError("The recommender must be fitted before calling recommend().")

    def _build_user_profile_text(
        self,
        user_interests: list[str] | str | None,
        selected_city: str | None = None,
    ) -> str:
        text_parts = []
        if selected_city:
            text_parts.append(normalize_text(selected_city))
        for interest in user_interests if isinstance(user_interests, (list, tuple, set)) else [user_interests]:
            interest_text = normalize_text(interest)
            if interest_text:
                text_parts.append(interest_text)
        return " ".join(text_parts)

    def recommend(
        self,
        user_interests: list[str] | str | None,
        selected_city: str | None = None,
        user_latitude: float | None = None,
        user_longitude: float | None = None,
        weather_context: dict[str, Any] | None = None,
        top_n: int = 10,
        candidate_places: pd.DataFrame | None = None,
    ) -> list[dict[str, Any]]:
        self._ensure_fitted()

        candidates = (
            prepare_recommendation_dataset(candidate_places)
            if candidate_places is not None
            else self.data.copy()
        )
        user_interests_list = user_interests if isinstance(user_interests, (list, tuple, set)) else [user_interests] if user_interests else []
        user_interests_list = [normalize_text(item) for item in user_interests_list if normalize_text(item)]

        user_vector = self.vectorizer.transform([self._build_user_profile_text(user_interests_list, selected_city)])
        candidate_text_matrix = self.vectorizer.transform(candidates["text_representation"])
        text_similarity = cosine_similarity(user_vector, candidate_text_matrix).ravel()
        candidates["text_similarity"] = text_similarity
        candidates["interest_match"] = candidates["category"].map(
            lambda category: calculate_interest_match(user_interests_list, category)
        )

        if weather_context is not None:
            candidates["weather_suitability"] = candidates.apply(
                lambda row: calculate_weather_suitability({
                    "precipitation": weather_context.get("precipitation", row.get("precipitation", 0)),
                    "weather_code": weather_context.get("weather_code", row.get("weather_code", 0)),
                    "wind_speed": weather_context.get("wind_speed", row.get("wind_speed", 0)),
                }), axis=1
            )
        else:
            candidates["weather_suitability"] = candidates.get("weather_suitability", 0.0)

        if user_latitude is not None and user_longitude is not None:
            candidates["distance_km"] = candidates.apply(
                lambda row: haversine_distance_km(
                    float(row["latitude"]),
                    float(row["longitude"]),
                    float(user_latitude),
                    float(user_longitude),
                ), axis=1
            )
            candidates["distance_suitability"] = candidates["distance_km"].apply(
                lambda distance: max(0.0, 1.0 - distance / 200.0)
            )
        else:
            candidates["distance_suitability"] = 0.5

        candidates["city_match"] = candidates["city"].map(
            lambda city: 1.0 if normalize_text(city).casefold() == normalize_text(selected_city).casefold() and selected_city else 0.0
        )

        candidates["final_score"] = (
            0.45 * candidates["text_similarity"]
            + 0.25 * candidates["interest_match"]
            + 0.20 * candidates["weather_suitability"]
            + 0.05 * candidates["distance_suitability"]
            + 0.05 * candidates["city_match"]
        )

        top_candidates = candidates.sort_values("final_score", ascending=False).head(max(1, int(top_n))).copy()
        results: list[dict[str, Any]] = []
        for _, row in top_candidates.iterrows():
            results.append(
                {
                    "place_id": row.get("place_id", ""),
                    "place_name": row.get("place_name", ""),
                    "city": row.get("city", ""),
                    "category": row.get("category", ""),
                    "score": float(row["final_score"]),
                    "distance_km": (
                        float(row["distance_km"])
                        if pd.notna(row.get("distance_km"))
                        else None
                    ),
                    "components": {
                        "text_similarity": float(row["text_similarity"]),
                        "interest_match": float(row["interest_match"]),
                        "weather_suitability": float(row["weather_suitability"]),
                        "distance_suitability": float(row.get("distance_suitability", 0.0)),
                        "city_match": float(row.get("city_match", 0.0)),
                    },
                }
            )
        return results

    @classmethod
    def load(cls, path: str | Path) -> "TravelRecommender":
        model_path = Path(path)
        with model_path.open("rb") as handle:
            recommender = pickle.load(handle)
        if not isinstance(recommender, cls):
            raise TypeError(f"Stored object at {model_path} is not a {cls.__name__}.")
        return recommender

    def save(self, path: str | Path) -> str:
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("wb") as handle:
            pickle.dump(self, handle)
        self._model_path = str(output_path)
        return str(output_path)
