import os
import io
import base64
from typing import Dict, Any, List, Optional
from PIL import Image

# Pluggable custom model path if provided
CUSTOM_POSTURE_MODEL_PATH = os.getenv("CUSTOM_POSTURE_MODEL_PATH", "")

# Flag to track whether Ultralytics YOLO is importable
YOLO_AVAILABLE = False
CUSTOM_MODEL_AVAILABLE = False
yolo_model = None
custom_posture_model = None

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
    # Attempt to load standard YOLOv8n for COCO dog detection
    try:
        # Standard lightweight model
        yolo_model = YOLO("yolov8n.pt")
    except Exception as e:
        # If download or model load fails, keep as None
        yolo_model = None

    if CUSTOM_POSTURE_MODEL_PATH and os.path.exists(CUSTOM_POSTURE_MODEL_PATH):
        try:
            custom_posture_model = YOLO(CUSTOM_POSTURE_MODEL_PATH)
            CUSTOM_MODEL_AVAILABLE = True
        except Exception:
            custom_posture_model = None
except ImportError:
    # PyTorch/Ultralytics not installed or not supported in this Python build
    YOLO_AVAILABLE = False


def decode_image_base64(image_base64: str) -> Optional[Image.Image]:
    """Decodes base64 string (with or without data:image/jpeg;base64, prefix) to PIL Image."""
    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return image
    except Exception:
        return None


def get_yolo_capabilities() -> Dict[str, Any]:
    """Returns current capability status of the computer vision subsystem."""
    if CUSTOM_MODEL_AVAILABLE and custom_posture_model is not None:
        return {
            "capability_state": "full_ai",
            "state_label": "Full AI (YOLO + Posture Model)",
            "yolo_available": True,
            "custom_model_available": True
        }
    elif YOLO_AVAILABLE and yolo_model is not None:
        return {
            "capability_state": "dog_detection",
            "state_label": "Dog Detection (COCO YOLOv8)",
            "yolo_available": True,
            "custom_model_available": False
        }
    else:
        return {
            "capability_state": "experimental",
            "state_label": "Experimental (Optical Motion Analysis)",
            "yolo_available": False,
            "custom_model_available": False
        }


def detect_dog(image: Image.Image) -> Dict[str, Any]:
    """
    Runs YOLO inference on the image for dog detection (COCO class 16: 'dog')
    and human detection (COCO class 0: 'person').
    If YOLO is unavailable, returns clean fallback indicating detection model status.
    """
    if yolo_model is None:
        # Return fallback without pretending detection occurred
        return {
            "dog_detected": False,
            "dog_count": 0,
            "bounding_boxes": [],
            "max_confidence": 0.0,
            "human_detected": False,
            "human_count": 0,
            "human_bounding_boxes": [],
            "model_used": "none (ultralytics not loaded)"
        }

    try:
        results = yolo_model(image, verbose=False)
        boxes_out = []
        dog_count = 0
        max_conf = 0.0
        human_boxes_out = []
        human_count = 0

        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())

                # COCO dataset class 16 is 'dog'
                if cls_id == 16 and conf > 0.40:
                    dog_count += 1
                    max_conf = max(max_conf, conf)
                    xywh = box.xywh[0].tolist()
                    boxes_out.append({
                        "x": round(xywh[0], 2),
                        "y": round(xywh[1], 2),
                        "width": round(xywh[2], 2),
                        "height": round(xywh[3], 2),
                        "confidence": round(conf, 2),
                        "label": "Dog"
                    })

                # COCO dataset class 0 is 'person'
                elif cls_id == 0 and conf > 0.45:
                    human_count += 1
                    xywh = box.xywh[0].tolist()
                    human_boxes_out.append({
                        "x": round(xywh[0], 2),
                        "y": round(xywh[1], 2),
                        "width": round(xywh[2], 2),
                        "height": round(xywh[3], 2),
                        "confidence": round(conf, 2),
                        "label": "Human"
                    })

        return {
            "dog_detected": dog_count > 0,
            "dog_count": dog_count,
            "bounding_boxes": boxes_out,
            "max_confidence": round(max_conf, 2),
            "human_detected": human_count > 0,
            "human_count": human_count,
            "human_bounding_boxes": human_boxes_out,
            "model_used": "yolov8n-coco"
        }
    except Exception as e:
        return {
            "dog_detected": False,
            "dog_count": 0,
            "bounding_boxes": [],
            "max_confidence": 0.0,
            "human_detected": False,
            "human_count": 0,
            "human_bounding_boxes": [],
            "model_used": f"error: {str(e)}"
        }


def detect_posture_custom(image: Image.Image) -> Optional[Dict[str, Any]]:
    """
    Interface for custom dog posture model.
    If a custom model is loaded, infers postures: squatting, circling, standing, sitting, lying.
    Otherwise returns None (never fabricates).
    """
    if not CUSTOM_MODEL_AVAILABLE or custom_posture_model is None:
        return None

    try:
        results = custom_posture_model(image, verbose=False)
        # Custom model inference parsing
        if results and len(results) > 0 and len(results[0].boxes) > 0:
            top_box = results[0].boxes[0]
            cls_name = custom_posture_model.names.get(int(top_box.cls[0].item()), "unknown")
            conf = float(top_box.conf[0].item())
            return {
                "posture": cls_name,
                "confidence": round(conf, 2),
                "is_squatting": cls_name.lower() in ["squat", "squatting"],
                "is_circling": cls_name.lower() in ["circle", "circling"]
            }
    except Exception:
        pass

    return None
