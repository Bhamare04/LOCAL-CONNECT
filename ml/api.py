from typing import Any

from pydantic import BaseModel

from pathlib import Path

from fastapi import FastAPI

from ml.recommendation.recommender import TravelRecommender


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "ml" / "models" / "travel_recommender.pkl"

app = FastAPI(
    title="LOCAL-CONNECT ML Recommendation API",
    description="Travel place recommendation service",
    version="1.0.0",
)


# Load the trained model when FastAPI starts
model = TravelRecommender.load(MODEL_PATH)
class RecommendationRequest(BaseModel):
    user_interests: list[str]
    selected_city: str
    user_latitude: float | None = None
    user_longitude: float | None = None
    weather_context: dict[str, Any] | None = None
    top_n: int = 5
    places: list[dict[str, Any]]

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "LOCAL-CONNECT ML Recommendation API"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model": MODEL_PATH.name
    }

@app.post("/recommend")
def recommend(request: RecommendationRequest):
    candidate_places = request.places

    recommendations = model.recommend(
        user_interests=request.user_interests,
        selected_city=request.selected_city,
        user_latitude=request.user_latitude,
        user_longitude=request.user_longitude,
        weather_context=request.weather_context,
        top_n=request.top_n,
        candidate_places=__import__("pandas").DataFrame(candidate_places),
    )

    return {
        "model_used": MODEL_PATH.name,
        "recommendations": recommendations,
    }