from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List


ACTIVITY_SCORES = {
    "Low": 5,
    "Moderate": 12,
    "High": 20
}

MOOD_SCORES = {
    "Calm": 0,
    "Happy": 3,
    "Excited": 8,
    "Restless": 18,
    "Sleepy": -5,
    "Suspicious 😂": 16,
    "Suspicious": 16
}

WATER_SCORES = {
    "Low": 2,
    "Moderate": 8,
    "High": 16
}


def calculate_prediction(
    age: Optional[float] = 2.0,
    weight: Optional[float] = 20.0,
    food: Optional[str] = "Standard Kibble",
    water: Optional[str] = "Moderate",
    activity_level: Optional[str] = "Moderate",
    mood: Optional[str] = "Calm",
    last_potty_time: Optional[Any] = None,
    vision: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Transparent, deterministic prediction heuristic for PawPotty.
    This is an experimental/fun estimator, NOT a medical or veterinary algorithm.
    """
    now = datetime.now(timezone.utc)

    # Parse last potty time
    if last_potty_time:
        if isinstance(last_potty_time, str):
            try:
                clean_time = last_potty_time.replace("Z", "+00:00")
                last_potty_dt = datetime.fromisoformat(clean_time)
            except Exception:
                last_potty_dt = now - timedelta(hours=3)
        elif isinstance(last_potty_time, datetime):
            last_potty_dt = last_potty_time
        else:
            last_potty_dt = now - timedelta(hours=3)

        if last_potty_dt.tzinfo is None:
            last_potty_dt = last_potty_dt.replace(tzinfo=timezone.utc)

        hours_since_potty = max(0.05, (now - last_potty_dt).total_seconds() / 3600.0)
    else:
        hours_since_potty = 3.5

    score = 15.0  # Base baseline
    factors: List[str] = []

    # 1. Time since last potty break
    # Typical adult dogs need breaks every 4-6 hours, puppies/seniors sooner
    time_multiplier = 8.5
    if age and (age < 1.0 or age > 10.0):
        time_multiplier = 10.5  # Younger or older pups need more frequent breaks

    time_score = min(hours_since_potty * time_multiplier, 40.0)
    score += time_score

    if hours_since_potty >= 4.0:
        factors.append(f"⏰ {hours_since_potty:.1f}h since last break (potty gap getting wide)")
    elif hours_since_potty >= 2.5:
        factors.append(f"⏰ {hours_since_potty:.1f}h since last break")

    # 2. Activity Level
    act_score = ACTIVITY_SCORES.get(activity_level, 10)
    score += act_score
    if activity_level == "High":
        factors.append("🏃 High activity level (zoomies stimulate the digestion)")
    elif activity_level == "Moderate":
        factors.append("🏃 Moderate afternoon activity")

    # 3. Water & Hydration
    if isinstance(water, str) and water in WATER_SCORES:
        w_score = WATER_SCORES[water]
    else:
        try:
            num_w = float(water or 0)
            w_score = min(num_w * 4.0, 16.0)
        except (ValueError, TypeError):
            w_score = 8.0

    score += w_score
    if w_score >= 14:
        factors.append("💧 High water bowl intake detected")
    elif w_score >= 8:
        factors.append("💧 Standard hydration level")

    # 4. Mood & Disposition
    m_score = MOOD_SCORES.get(mood, 4)
    score += m_score
    if mood in ["Restless", "Suspicious 😂", "Suspicious"]:
        factors.append(f"😏 {mood} vibes (classic pre-potty restlessness)")
    elif mood == "Excited":
        factors.append("✨ Excited and alert energy")

    # 5. Vision / Camera signals (if available)
    if vision:
        if vision.get("dog_detected"):
            score += 4.0
            factors.append("● Dog detected in camera frame")

        restlessness = vision.get("restlessness", 0.0)
        if isinstance(restlessness, (int, float)) and restlessness > 0.6:
            score += 12.0
            factors.append(f"🐾 High restlessness signal ({int(restlessness * 100)}%)")

        movement = vision.get("movement", 0.0)
        if isinstance(movement, (int, float)) and movement > 0.65:
            score += 8.0
            factors.append("📹 Pacing / frequent movement in view")

        if vision.get("circling"):
            score += 18.0
            factors.append("🔄 Suspicious tight circling movement detected!")

        if vision.get("squatting"):
            score += 30.0
            factors.append("🚨 Squat posture detected — immediate potty alert!")

        posture = vision.get("posture")
        if posture == "sniffing_ground":
            score += 10.0
            factors.append("👃 Intense ground-sniffing behavior")

    # Probability clamp (1% to 99%)
    probability = int(max(1, min(round(score), 99)))

    # Estimate minutes remaining
    if probability >= 92:
        minutes = 5
    elif probability >= 85:
        minutes = 12
    elif probability >= 75:
        minutes = 20
    elif probability >= 65:
        minutes = 35
    elif probability >= 50:
        minutes = 55
    elif probability >= 35:
        minutes = 80
    else:
        minutes = 120

    predicted_time = now + timedelta(minutes=minutes)

    # Confidence calculation: grows with known data points
    factor_count = len(factors)
    confidence = int(min(96, max(42, 50 + factor_count * 7)))

    if not factors:
        factors.append("🐾 Routine baseline estimate")

    # Recommended action
    if probability >= 85:
        recommended_action = "Leash up now! A prompt potty trip is highly recommended. 🐕💩"
    elif probability >= 70:
        recommended_action = "Keep one eye on the door — a short walk wouldn't be a bad idea. 👀"
    elif probability >= 50:
        recommended_action = "Pup is entering the warmup phase. Plan a break in the next hour."
    else:
        recommended_action = "Your pup looks pretty relaxed right now. No emergency potty vibes detected. 🛋️"

    return {
        "probability": probability,
        "confidence": confidence,
        "minutes_until": minutes,
        "predicted_time": predicted_time.isoformat(),
        "factors": factors,
        "recommended_action": recommended_action,
        "hours_since_potty": round(hours_since_potty, 2)
    }
