from __future__ import annotations

import math
from typing import Any

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

from .utils import (
    calculate_interest_match,
    calculate_weather_suitability,
    haversine_distance_km,
    normalize_category,
    normalize_text,
    safe_float,
)


def _normalise_coordinate(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce")
    return values.where(values.between(-90, 90) | values.between(-180, 180), pd.NA)


def preprocess_recommendation_data(data: pd.DataFrame) -> pd.DataFrame:
    """Clean the dataset without altering the raw CSV file on disk."""
    if data is None or data.empty:
        return pd.DataFrame()

    df = data.copy()
    for column in ["place_name", "city", "category", "address", "website", "google_maps_url"]:
        if column in df.columns:
            df[column] = df[column].map(lambda value: normalize_text(value))

    if "category" in df.columns:
        df["category"] = df["category"].map(normalize_category)
    if "city" in df.columns:
        df["city"] = df["city"].map(lambda value: normalize_text(value).title())
    if "place_name" in df.columns:
        df["place_name"] = df["place_name"].map(lambda value: normalize_text(value))

    df = df.drop_duplicates().reset_index(drop=True)

    for column in ["latitude", "longitude"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    if {"latitude", "longitude"}.issubset(df.columns):
        valid_coordinates = df["latitude"].between(-90, 90) & df["longitude"].between(-180, 180)
        df = df.loc[valid_coordinates].reset_index(drop=True)

    for column in ["temperature", "precipitation", "wind_speed", "weather_code"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    df["weather_suitability"] = df.apply(
        lambda row: calculate_weather_suitability({
            "temperature": row.get("temperature"),
            "precipitation": row.get("precipitation"),
            "weather_code": row.get("weather_code"),
            "wind_speed": row.get("wind_speed"),
        }), axis=1
    )
    return df


def create_place_text_representation(data: pd.DataFrame) -> list[str]:
    """Create a combined text representation for each place."""
    if data is None or data.empty:
        return []

    rows: list[str] = []
    for _, row in data.iterrows():
        parts = [
            row.get("category", ""),
            row.get("city", ""),
            row.get("place_name", ""),
        ]
        cleaned = " ".join(normalize_text(part) for part in parts if normalize_text(part))
        rows.append(cleaned)
    return rows


def build_text_feature_matrix(data: pd.DataFrame) -> tuple[TfidfVectorizer, Any]:
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    texts = create_place_text_representation(data)
    return vectorizer, vectorizer.fit_transform(texts)


def build_weather_feature_frame(data: pd.DataFrame) -> pd.DataFrame:
    frame = data.copy()
    for column in ["temperature", "precipitation", "weather_code", "wind_speed"]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
    if "weather_suitability" not in frame.columns:
        frame["weather_suitability"] = frame.apply(
            lambda row: calculate_weather_suitability({
                "precipitation": row.get("precipitation"),
                "weather_code": row.get("weather_code"),
                "wind_speed": row.get("wind_speed"),
            }), axis=1
        )
    return frame


def prepare_recommendation_dataset(
    data: pd.DataFrame,
    user_city: str | None = None,
    user_interests: list[str] | str | None = None,
    user_latitude: float | None = None,
    user_longitude: float | None = None,
) -> pd.DataFrame:
    """Add the user-aware contextual features used by the content-based recommender."""
    frame = preprocess_recommendation_data(data)
    frame = build_weather_feature_frame(frame)
    frame["interest_match"] = frame["category"].map(
        lambda category: calculate_interest_match(user_interests, category)
    )

    if user_city is not None:
        frame["city_match"] = frame["city"].map(
            lambda city: 1.0 if normalize_text(city).casefold() == normalize_text(user_city).casefold() else 0.0
        )
    else:
        frame["city_match"] = 0.0

    if user_latitude is not None and user_longitude is not None:
        if {"latitude", "longitude"}.issubset(frame.columns):
            frame["distance_km"] = frame.apply(
                lambda row: haversine_distance_km(
                    float(row["latitude"]),
                    float(row["longitude"]),
                    float(user_latitude),
                    float(user_longitude),
                ), axis=1
            )
            frame["distance_suitability"] = frame["distance_km"].apply(
                lambda distance: max(0.0, 1.0 - distance / 200.0)
            )
        else:
            frame["distance_km"] = math.nan
            frame["distance_suitability"] = 0.0
    else:
        frame["distance_km"] = math.nan
        frame["distance_suitability"] = 0.0

    frame["text_representation"] = create_place_text_representation(frame)
    return frame.reset_index(drop=True)
