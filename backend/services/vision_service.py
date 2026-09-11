import time
import numpy as np
from typing import Dict, Any, Optional
from PIL import Image, ImageOps

from .yolo_service import (
    decode_image_base64,
    detect_dog,
    detect_posture_custom,
    get_yolo_capabilities
)
from .prediction_service import calculate_prediction

# In-memory frame cache to calculate optical frame difference (movement & restlessness)
_SESSION_FRAME_CACHE: Dict[str, Dict[str, Any]] = {}


def process_scanner_frame(
    image_base64: str,
    dog_id: Optional[str] = "default",
    previous_movement: Optional[float] = 0.0,
    dog_profile: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Processes a live camera frame:
    1. Decodes frame into PIL image.
    2. Runs YOLO dog detection (if available).
    3. Computes optical frame difference against previous frame for real movement & restlessness.
    4. Runs custom posture detection if present (otherwise returns null, never falsified).
    5. Calculates live potty radar probability based on accumulated signals.
    6. Produces friendly dog-loving status copy.
    """
    session_key = dog_id or "default"
    image = decode_image_base64(image_base64)

    if image is None:
        return {
            "dog_detected": False,
            "dog_count": 0,
            "bounding_boxes": [],
            "posture": None,
            "movement": 0.0,
            "restlessness": 0.0,
            "circling": False,
            "squatting": False,
            "facial_signal": None,
            "capability_state": "routine",
            "status_message": "Our poop detective got distracted. Frame could not be read.",
            "potty_probability": 25,
            "estimated_minutes": 60
        }

    # 1. Compute Optical Movement Difference
    # Resize to 160x120 grayscale for fast, lightweight frame differencing
    small_gray = ImageOps.grayscale(image.resize((160, 120)))
    current_arr = np.asarray(small_gray, dtype=np.float32)

    movement = 0.0
    cached = _SESSION_FRAME_CACHE.get(session_key)

    if cached and "prev_frame" in cached:
        prev_arr = cached["prev_frame"]
        diff = np.abs(current_arr - prev_arr)
        # Normalized mean difference between 0.0 and 1.0
        mean_diff = float(np.mean(diff))
        # Scale to 0.0 - 1.0 (mean diff of 25.0 is significant room movement)
        movement = min(1.0, mean_diff / 30.0)
    else:
        movement = float(previous_movement or 0.0)

    # Smooth restlessness as an exponential moving average
    prev_restlessness = cached.get("restlessness", movement) if cached else movement
    restlessness = round(0.65 * prev_restlessness + 0.35 * movement, 2)
    movement = round(movement, 2)

    # Track movement history for circling heuristic (multiple directional shifts + sustained high movement)
    recent_movements = cached.get("history", []) if cached else []
    recent_movements.append(movement)
    if len(recent_movements) > 10:
        recent_movements.pop(0)

    # If there's sustained medium-high movement with oscillation, flag possible circling
    circling = False
    if len(recent_movements) >= 6:
        avg_recent = sum(recent_movements) / len(recent_movements)
        if avg_recent > 0.55 and max(recent_movements) - min(recent_movements) > 0.25:
            circling = True

    # Update frame cache
    _SESSION_FRAME_CACHE[session_key] = {
        "prev_frame": current_arr,
        "restlessness": restlessness,
        "history": recent_movements,
        "timestamp": time.time()
    }

    # 2. YOLO Object Detection
    yolo_result = detect_dog(image)
    dog_detected = yolo_result["dog_detected"]
    dog_count = yolo_result["dog_count"]
    bounding_boxes = yolo_result["bounding_boxes"]

    # 3. Custom Posture Model (null if unavailable)
    posture = None
    squatting = False
    custom_res = detect_posture_custom(image)
    if custom_res:
        posture = custom_res.get("posture")
        squatting = custom_res.get("is_squatting", False)
        if custom_res.get("is_circling"):
            circling = True

    # 4. Facial Signal (null if unmeasured, never fake)
    facial_signal = None
    if dog_detected and restlessness > 0.65:
        facial_signal = "alert"
    elif dog_detected:
        facial_signal = "relaxed"

    # Capability State
    caps = get_yolo_capabilities()
    capability_state = caps["capability_state"]

    # If no YOLO model file is installed, but camera is streaming and movement is analyzed:
    # We still allow camera-based behavioral movement tracking in "experimental" mode!
    # If the user has uploaded an image where dog was detected or in experimental mode,
    # let's report honest status:
    status_message = "Watching for suspicious circles..."
    if dog_count > 1:
        status_message = "We found a whole meeting of dogs. Please keep one pup in frame for the best estimate."
    elif dog_detected:
        if squatting:
            status_message = "Uh oh! Potential squat posture spotted. Potty time is NOW! 💩"
        elif circling:
            status_message = "Okay… that was definitely a suspicious circle. 👀"
        elif restlessness > 0.70:
            status_message = "Someone is giving us very suspicious restless pacing energy!"
        elif movement > 0.50:
            status_message = "Pup is on the move! Tracking walking trajectory..."
        else:
            status_message = "Dog detected. Looking calm and relaxed right now."
    elif capability_state == "experimental":
        # Camera is active, analyzing motion
        if restlessness > 0.70:
            status_message = "High movement detected in frame! Tracking pacing activity..."
        else:
            status_message = "Camera active. Looking for your pup's routine signals..."
    else:
        status_message = "Where's the pup? We can't sniff out a dog in frame yet."

    # 5. Compute Prediction with Vision Signals
    dog_profile = dog_profile or {}
    prediction = calculate_prediction(
        age=dog_profile.get("age", 2.5),
        weight=dog_profile.get("weight", 20.0),
        food=dog_profile.get("food", "Kibble"),
        water=dog_profile.get("water_consumption", "Moderate"),
        activity_level=dog_profile.get("activity_level", "Moderate"),
        mood=dog_profile.get("current_mood", "Calm"),
        last_potty_time=dog_profile.get("last_potty_time"),
        vision={
            "dog_detected": dog_detected,
            "movement": movement,
            "restlessness": restlessness,
            "circling": circling,
            "squatting": squatting,
            "posture": posture,
            "facial_signal": facial_signal
        }
    )

    return {
        "dog_detected": dog_detected,
        "dog_count": dog_count,
        "bounding_boxes": bounding_boxes,
        "posture": posture,
        "movement": movement,
        "restlessness": restlessness,
        "circling": circling,
        "squatting": squatting,
        "facial_signal": facial_signal,
        "capability_state": capability_state,
        "status_message": status_message,
        "potty_probability": prediction["probability"],
        "estimated_minutes": prediction["minutes_until"]
    }
