import os
import json
import random
import httpx
from typing import Dict, Any, Tuple


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


LOCAL_FALLBACK_TEMPLATES = [
    (
        "{name} has definitely entered the suspicious pacing phase! With {hours:.1f} hours since the last bathroom trip and {activity} activity, the potty radar is tingling.",
        "A short leash walk right about now wouldn't hurt. 🐕"
    ),
    (
        "Look at that focused look. {name} has drank plenty of water, had lots of fun, and the potty countdown is getting serious.",
        "Grab the poop bags and head toward the grass! 💩"
    ),
    (
        "Okay… {name} is showing some classic pre-potty vibes. It's been {hours:.1f} hours and that water bowl didn't drink itself!",
        "Keep one paw on the door handle and the leash within arm's reach."
    ),
    (
        "Our potty radar detectives are keeping a very close watch on {name}. High energy + time elapsed = the stars are aligning for a potty mission.",
        "Time for a gentle backyard stroll."
    ),
    (
        "No major emergency alarm bells yet, but {name} is steadily creeping toward go-time. {hours:.1f} hours since the last break.",
        "Relax for now, but don't wander too far from home."
    )
]


async def generate_groq_explanation(
    dog_name: str,
    probability: int,
    minutes: int,
    restlessness: str = "moderate",
    circling: bool = False,
    last_potty_hours: float = 4.0,
    water: str = "moderate",
    activity: str = "moderate",
    mood: str = "Suspicious 😂"
) -> Tuple[str, str, str]:
    """
    Calls Groq with summarized dog behavioral & routine signals to produce
    a charming, witty, natural-language explanation.
    Returns (explanation, recommended_action, source).
    """
    # If no GROQ_API_KEY configured, use charming local fallback
    if not GROQ_API_KEY or GROQ_API_KEY.strip() == "YOUR_GROQ_API_KEY":
        return _generate_local_fallback(dog_name, probability, minutes, last_potty_hours, activity, mood, circling)

    system_prompt = (
        "You are PawPotty AI, a charming, witty, warm, dog-loving companion living inside a dog app. "
        "Your job is to give a short (2-3 sentences max) playful, intuitive explanation for why a dog might "
        "need a potty break based on provided signals. "
        "STRICT GUIDELINES: "
        "- NEVER say 'As an AI...', 'The model predicts...', 'Based on machine learning...', or robotic terms. "
        "- Speak warmly and playfully like a caring dog parent with good humor. "
        "- Use phrases like 'potty radar', 'suspicious pacing', 'leash nearby', 'giving us suspicious energy'. "
        "- NEVER make scientific, medical, or veterinary claims. "
        "- Output valid JSON with two fields: 'explanation' and 'recommended_action'."
    )

    user_payload = {
        "dog_name": dog_name,
        "potty_probability_percent": probability,
        "estimated_minutes_remaining": minutes,
        "hours_since_last_potty": last_potty_hours,
        "water_intake": water,
        "activity_level": activity,
        "current_mood": mood,
        "circling_detected": circling,
        "restlessness": restlessness
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Dog signals: {json.dumps(user_payload)}. Return JSON format."}
                    ],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"}
                }
            )

            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                explanation = parsed.get("explanation", "")
                action = parsed.get("recommended_action", "A short walk wouldn't be a bad idea. 🐕")
                if explanation:
                    return explanation, action, "groq"
    except Exception as e:
        # Graceful fallback without crashing
        pass

    return _generate_local_fallback(dog_name, probability, minutes, last_potty_hours, activity, mood, circling)


def _generate_local_fallback(
    dog_name: str,
    probability: int,
    minutes: int,
    last_potty_hours: float,
    activity: str,
    mood: str,
    circling: bool
) -> Tuple[str, str, str]:
    """Generates playful, tasteful fallback explanations."""
    if circling:
        return (
            f"Okay… {dog_name} is doing the sacred pre-potty circle dance! We're not saying it's definitely happening right this second, but the radar is practically glowing.",
            "Grab the leash immediately! 🐕💩",
            "fallback"
        )

    if probability >= 85:
        return (
            f"{dog_name} has entered high-alert territory. It's been {last_potty_hours:.1f} hours since the last break, activity is humming, and that look says 'the grass is calling'.",
            "A short walk wouldn't be a bad idea right about now. 🐕",
            "fallback"
        )
    elif probability >= 65:
        return (
            f"{dog_name} is giving us some gently suspicious wandering energy. With {last_potty_hours:.1f} hours elapsed, things are warming up nicely on the potty radar.",
            "Keep one eye on the back door over the next ~{minutes} minutes.",
            "fallback"
        )
    else:
        return (
            f"{dog_name} looks pretty relaxed and content. No emergency potty vibes detected on the radar for now.",
            "Safe to lounge together on the sofa for a while. 🛋️",
            "fallback"
        )
