from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.prediction_service import calculate_prediction
from services.groq_service import generate_explanation


router = APIRouter(prefix="/api/predictions", tags=["predictions"])


class PredictionRequest(BaseModel):
    dog_name: str
    age: Optional[float] = None
    weight: Optional[float] = None
    food: Optional[str] = ""
    water: Optional[float] = 0
    activity_level: str = "Moderate"
    mood: str = "Calm"
    last_potty_time: Optional[str] = None

    vision: Optional[dict] = None


@router.post("/calculate")
async def calculate(request: PredictionRequest):

    prediction = calculate_prediction(
        age=request.age,
        weight=request.weight,
        food=request.food,
        water=request.water,
        activity_level=request.activity_level,
        mood=request.mood,
        last_potty_time=request.last_potty_time,
        vision=request.vision
    )

    explanation = await generate_explanation(
        prediction,
        request.dog_name
    )

    prediction["explanation"] = explanation

    return prediction