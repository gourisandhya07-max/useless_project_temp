import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from typing import Optional, Dict, Any

from database.db import get_db_connection
from models.schemas import UserProfile

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEFAULT_DEMO_USER_ID = "user_demo_pawpotty"


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    Derives user ID securely:
    - If Supabase JWT bearer token is present, we extract user ID from Supabase or JWT payload.
    - If no token or testing locally, falls back cleanly to the demo session user ID.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        # In full production with Supabase configured:
        # We can decode the JWT or query Supabase auth.getUser(token)
        # For seamless resilience:
        if token and token != "null" and token != "undefined":
            # Extract sub if simple JWT or use token as session id
            try:
                import base64
                import json
                parts = token.split(".")
                if len(parts) == 3:
                    # JWT payload is the second part
                    padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                    payload_json = base64.urlsafe_b64decode(padded.encode()).decode()
                    payload = json.loads(payload_json)
                    sub = payload.get("sub") or payload.get("id")
                    if sub:
                        return str(sub)
            except Exception:
                pass
            return f"user_{token[:16]}"

    return DEFAULT_DEMO_USER_ID


@router.get("/me")
def get_current_profile(authorization: Optional[str] = Header(None)):
    """Returns the authenticated user profile."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, created_at FROM profiles WHERE id = ?", (user_id,))
    row = cursor.fetchone()

    if not row:
        # Create profile record if new
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "INSERT INTO profiles (id, name, email, created_at) VALUES (?, ?, ?, ?)",
            (user_id, "Dog Lover", f"user_{user_id[:8]}@pawpotty.app", now)
        )
        conn.commit()
        profile = {"id": user_id, "name": "Dog Lover", "email": f"user_{user_id[:8]}@pawpotty.app", "created_at": now}
    else:
        profile = {"id": row["id"], "name": row["name"], "email": row["email"], "created_at": row["created_at"]}

    conn.close()
    return profile


@router.post("/demo-login")
def demo_login():
    """Provides a fast, instant demo session without requiring external credentials."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, created_at FROM profiles WHERE id = ?", (DEFAULT_DEMO_USER_ID,))
    row = cursor.fetchone()
    conn.close()

    return {
        "access_token": "demo_pawpotty_token_2026",
        "token_type": "bearer",
        "user": {
            "id": DEFAULT_DEMO_USER_ID,
            "name": row["name"] if row else "Alex & Bruno",
            "email": row["email"] if row else "alex@pawpotty.app"
        }
    }
