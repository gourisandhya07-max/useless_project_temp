import os
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_PATH = Path(__file__).resolve().parent.parent / "pawpotty.db"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables and seeds default demo data if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dogs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        age REAL,
        weight REAL,
        breed TEXT,
        gender TEXT,
        food TEXT,
        water_consumption TEXT,
        activity_level TEXT,
        current_mood TEXT,
        last_potty_time TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS potty_events (
        id TEXT PRIMARY KEY,
        dog_id TEXT NOT NULL,
        potty_time TEXT NOT NULL,
        food TEXT,
        water TEXT,
        activity_level TEXT,
        notes TEXT,
        created_at TEXT,
        FOREIGN KEY (dog_id) REFERENCES dogs(id)
    );

    CREATE TABLE IF NOT EXISTS predictions (
        id TEXT PRIMARY KEY,
        dog_id TEXT NOT NULL,
        predicted_time TEXT NOT NULL,
        probability INTEGER NOT NULL,
        confidence INTEGER NOT NULL,
        posture_signal TEXT,
        facial_signal TEXT,
        movement_signal REAL,
        restlessness REAL,
        explanation TEXT,
        created_at TEXT,
        FOREIGN KEY (dog_id) REFERENCES dogs(id)
    );

    CREATE TABLE IF NOT EXISTS scanner_sessions (
        id TEXT PRIMARY KEY,
        dog_id TEXT,
        started_at TEXT,
        ended_at TEXT,
        detection_count INTEGER DEFAULT 0,
        created_at TEXT,
        FOREIGN KEY (dog_id) REFERENCES dogs(id)
    );
    """)

    # Check if we should seed demo profile and dogs
    cursor.execute("SELECT COUNT(*) FROM profiles")
    if cursor.fetchone()[0] == 0:
        demo_user_id = "user_demo_pawpotty"
        cursor.execute(
            "INSERT INTO profiles (id, name, email, created_at) VALUES (?, ?, ?, ?)",
            (demo_user_id, "Alex & Bruno", "alex@pawpotty.app", datetime.now(timezone.utc).isoformat())
        )

        luna_id = "dog_luna_demo"
        now = datetime.now(timezone.utc)
        past_potty = (now - timedelta(hours=4, minutes=48)).isoformat()

        cursor.execute("""
            INSERT INTO dogs (
                id, user_id, name, age, weight, breed, gender, food, 
                water_consumption, activity_level, current_mood, 
                last_potty_time, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            luna_id, demo_user_id, "Luna", 3.0, 24.5, "French Bulldog", "Female",
            "Salmon Kibble + Blueberries", "High", "High", "Suspicious 😂",
            past_potty, 1, now.isoformat(), now.isoformat()
        ))

        # Seed sample potty events for Luna
        for hrs_ago, notes in [
            (28, "Morning stroll in park - brisk clean break"),
            (21, "Afternoon backyard check"),
            (14, "Evening post-dinner walk"),
            (5, "Quick midday potty break before nap")
        ]:
            evt_time = (now - timedelta(hours=hrs_ago)).isoformat()
            cursor.execute("""
                INSERT INTO potty_events (id, dog_id, potty_time, food, water, activity_level, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), luna_id, evt_time, "Standard Kibble", "Moderate", "Moderate", notes, evt_time))

        # Seed a sample prediction
        cursor.execute("""
            INSERT INTO predictions (
                id, dog_id, predicted_time, probability, confidence, 
                posture_signal, facial_signal, movement_signal, restlessness, 
                explanation, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()), luna_id, (now + timedelta(minutes=17)).isoformat(), 87, 74,
            "standing", "alert", 0.60, 0.70,
            "Luna is giving us some very suspicious walking energy. It's been over 4 hours since her last break and activity was high!",
            now.isoformat()
        ))

    conn.commit()
    conn.close()


init_db()
