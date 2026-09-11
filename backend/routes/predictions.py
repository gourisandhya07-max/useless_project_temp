from datetime import datetime, timedelta, timezone


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
    "Sleepy": -3,
    "Suspicious 😂": 15
}


def calculate_prediction(
    age,
    weight,
    food,
    water,
    activity_level,
    mood,
    last_potty_time,
    vision=None
):
    """
    Fun/experimental prediction engine.

    This is NOT a veterinary model.
    """

    now = datetime.now(timezone.utc)

    if last_potty_time:
        if isinstance(last_potty_time, str):
            last_potty_time = datetime.fromisoformat(
                last_potty_time.replace("Z", "+00:00")
            )

        if last_potty_time.tzinfo is None:
            last_potty_time = last_potty_time.replace(tzinfo=timezone.utc)

        hours_since_potty = (
            now - last_potty_time
        ).total_seconds() / 3600

    else:
        hours_since_potty = 3

    score = 20

    factors = []

    # Time factor
    time_score = min(hours_since_potty * 8, 35)
    score += time_score

    if hours_since_potty >= 4:
        factors.append(
            f"{hours_since_potty:.1f} hours since the last potty"
        )

    # Activity
    activity_score = ACTIVITY_SCORES.get(activity_level, 10)
    score += activity_score

    if activity_level == "High":
        factors.append("High activity level")

    # Mood
    mood_score = MOOD_SCORES.get(mood, 0)
    score += mood_score

    if mood in ["Restless", "Suspicious 😂"]:
        factors.append(f"{mood} behavior")

    # Water
    try:
        water_value = float(water or 0)
    except (TypeError, ValueError):
        water_value = 0

    water_score = min(water_value * 2, 15)
    score += water_score

    if water_value > 2:
        factors.append("Higher reported water consumption")

    # Vision signals
    vision = vision or {}

    if vision.get("dog_detected"):
        score += 5
        factors.append("Dog detected by camera")

    if vision.get("restlessness"):
        score += 15
        factors.append("Camera detected increased movement")

    if vision.get("circling"):
        score += 20
        factors.append("Possible circling behavior detected")

    if vision.get("squatting"):
        score += 30
        factors.append("Possible squatting posture detected")

    # Clamp probability
    probability = max(1, min(round(score), 99))

    # Estimate minutes
    if probability >= 90:
        minutes = 8
    elif probability >= 80:
        minutes = 15
    elif probability >= 70:
        minutes = 25
    elif probability >= 60:
        minutes = 40
    elif probability >= 50:
        minutes = 60
    else:
        minutes = 90

    predicted_time = now + timedelta(minutes=minutes)

    confidence = min(
        95,
        max(
            35,
            50 + len(factors) * 8
        )
    )

    if not factors:
        factors.append("Routine-based estimate")

    if probability >= 85:
        action = "Get ready for a possible potty trip!"
    elif probability >= 65:
        action = "Keep an eye on your dog."
    else:
        action = "Probably safe to relax for now."

    return {
        "probability": probability,
        "confidence": confidence,
        "minutes_until": minutes,
        "predicted_time": predicted_time.isoformat(),
        "factors": factors,
        "recommended_action": action,
        "hours_since_potty": round(hours_since_potty, 2)
    }