import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Header

from database.db import get_db_connection
from models.schemas import ScannerFrameRequest, ScannerFrameResponse
from services.vision_service import process_scanner_frame
from services.yolo_service import get_yolo_capabilities
from routes.auth import get_current_user_id

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.get("/capabilities")
def get_capabilities():
    """Returns the current state of computer vision and model loading."""
    return get_yolo_capabilities()


@router.post("/start")
def start_scanner_session(dog_id: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Starts a new camera scanner session."""
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scanner_sessions (id, dog_id, started_at, detection_count, created_at)
        VALUES (?, ?, ?, 0, ?)
    """, (session_id, dog_id, now, now))
    conn.commit()
    conn.close()

    caps = get_yolo_capabilities()
    return {
        "session_id": session_id,
        "started_at": now,
        "capabilities": caps,
        "message": "AI Scanner session started. Watching for suspicious pup signals! 🐾"
    }


@router.post("/frame", response_model=ScannerFrameResponse)
def analyze_frame(payload: ScannerFrameRequest, authorization: Optional[str] = Header(None)):
    """
    Analyzes a single camera frame from the browser.
    Returns dog detection, motion diff, restlessness, circling, and live potty radar.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    dog_profile = {}
    if payload.dog_id:
        cursor.execute("SELECT * FROM dogs WHERE id = ?", (payload.dog_id,))
        row = cursor.fetchone()
        if row:
            dog_profile = dict(row)

    conn.close()

    result = process_scanner_frame(
        image_base64=payload.image_base64,
        dog_id=payload.dog_id,
        previous_movement=payload.previous_movement,
        dog_profile=dog_profile
    )

    return ScannerFrameResponse(**result)


@router.post("/end")
def end_scanner_session(session_id: str, detection_count: int = 0):
    """Marks a scanner session as finished."""
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE scanner_sessions SET ended_at = ?, detection_count = ? WHERE id = ?
    """, (now, detection_count, session_id))
    conn.commit()
    conn.close()

    return {"message": "Scanner session ended. Case closed! 🐾"}
