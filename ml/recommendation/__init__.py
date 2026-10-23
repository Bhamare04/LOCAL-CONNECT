"""Content-based travel recommendation model package."""

from .feature_engineering import (
    build_text_feature_matrix,
    build_weather_feature_frame,
    create_place_text_representation,
    prepare_recommendation_dataset,
)
from .recommender import TravelRecommender
from .utils import (
    calculate_interest_match,
    calculate_weather_suitability,
    haversine_distance_km,
    normalize_text,
)

__all__ = [
    "TravelRecommender",
    "build_text_feature_matrix",
    "build_weather_feature_frame",
    "calculate_interest_match",
    "calculate_weather_suitability",
    "create_place_text_representation",
    "haversine_distance_km",
    "normalize_text",
    "prepare_recommendation_dataset",
]
