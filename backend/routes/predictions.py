import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header

from database.db import get_db_connection
from models.schemas import (
    PredictionRequest,
    PredictionResponse,
    GroqExplanationRequest,
    GroqExplanationResponse
)
from services.prediction_service import calculate_prediction
from services.groq_service import generate_groq_explanation
from routes.auth import get_current_user_id

router = APIRouter(tags=["predictions"])


@router.post("/api/predictions", response_model=PredictionResponse)
async def create_prediction(payload: PredictionRequest, authorization: Optional[str] = Header(None)):
    """
    Computes a deterministic potty time prediction and enriches it
    with a server-side Groq natural-language explanation.
    """
    user_id = get_current_user_id(authorization)

    # If dog_id provided, look up saved info for any missing attributes
    dog_name = payload.dog_name or "Your pup"
    age = payload.age
    weight = payload.weight
    food = payload.food
    water = payload.water
    activity_level = payload.activity_level
    mood = payload.mood
    last_potty_time = payload.last_potty_time

    conn = get_db_connection()
    cursor = conn.cursor()

    if payload.dog_id:
        cursor.execute("SELECT * FROM dogs WHERE id = ?", (payload.dog_id,))
        dog_row = cursor.fetchone()
        if dog_row:
            dog_name = dog_row["name"]
            if age is None:
                age = dog_row["age"]
            if weight is None:
                weight = dog_row["weight"]
            if not food or food == "Regular food":
                food = dog_row["food"]
            if not water or water == "Moderate":
                water = dog_row["water_consumption"]
            if not activity_level or activity_level == "Moderate":
                activity_level = dog_row["activity_level"]
            if not mood or mood == "Calm":
                mood = dog_row["current_mood"]
            if not last_potty_time:
                last_potty_time = dog_row["last_potty_time"]

    # 1. Deterministic Calculation
    result = calculate_prediction(
        age=age,
        weight=weight,
        food=food,
        water=water,
        activity_level=activity_level,
        mood=mood,
        last_potty_time=last_potty_time,
        vision=payload.vision
    )

    # 2. Server-side Groq explanation
    vision_data = payload.vision or {}
    restlessness_label = "moderate"
    if vision_data.get("restlessness", 0) > 0.65:
        restlessness_label = "high"
    elif vision_data.get("restlessness", 0) < 0.3:
        restlessness_label = "calm"

    explanation, action, _ = await generate_groq_explanation(
        dog_name=dog_name,
        probability=result["probability"],
        minutes=result["minutes_until"],
        restlessness=restlessness_label,
        circling=bool(vision_data.get("circling", False)),
        last_potty_hours=result["hours_since_potty"],
        water=str(water),
        activity=str(activity_level),
        mood=str(mood)
    )

    result["explanation"] = explanation
    result["recommended_action"] = action

    # 3. Store prediction in DB
    pred_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    dog_ref_id = payload.dog_id or "dog_adhoc"

    cursor.execute("""
        INSERT INTO predictions (
            id, dog_id, predicted_time, probability, confidence,
            posture_signal, facial_signal, movement_signal, restlessness,
            explanation, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pred_id, dog_ref_id, result["predicted_time"],
        result["probability"], result["confidence"],
        vision_data.get("posture"), vision_data.get("facial_signal"),
        float(vision_data.get("movement") or 0.0),
        float(vision_data.get("restlessness") or 0.0),
        explanation, now
    ))
    conn.commit()
    conn.close()

    return PredictionResponse(**result)


@router.get("/api/predictions/{dog_id}")
def get_dog_predictions(dog_id: str, authorization: Optional[str] = Header(None)):
    """Retrieves prediction history for a specific dog."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM predictions WHERE dog_id = ? ORDER BY created_at DESC LIMIT 20
    """, (dog_id,))
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]


@router.post("/api/ai/explanation", response_model=GroqExplanationResponse)
async def get_ai_explanation(payload: GroqExplanationRequest):
    """Direct API to request a fresh Groq-generated funny dog behavior summary."""
    explanation, action, source = await generate_groq_explanation(
        dog_name=payload.dog_name,
        probability=payload.probability,
        minutes=payload.minutes,
        restlessness=payload.restlessness or "moderate",
        circling=bool(payload.circling),
        last_potty_hours=payload.last_potty_hours or 4.0,
        water=payload.water or "moderate",
        activity=payload.activity or "moderate",
        mood=payload.mood or "Suspicious 😂"
    )

    return GroqExplanationResponse(
        explanation=explanation,
        recommended_action=action,
        source=source
    )