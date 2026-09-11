import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Header

from database.db import get_db_connection
from models.schemas import DogCreate, DogUpdate, DogResponse
from routes.auth import get_current_user_id

router = APIRouter(prefix="/api/dogs", tags=["dogs"])


@router.get("", response_model=List[DogResponse])
def list_dogs(authorization: Optional[str] = Header(None)):
    """Lists all dogs for the current user."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, user_id, name, age, weight, breed, gender, food,
               water_consumption, activity_level, current_mood,
               last_potty_time, is_active, created_at, updated_at
        FROM dogs
        WHERE user_id = ?
        ORDER BY is_active DESC, created_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    dogs = []
    for r in rows:
        dogs.append(DogResponse(
            id=r["id"],
            user_id=r["user_id"],
            name=r["name"],
            age=r["age"],
            weight=r["weight"],
            breed=r["breed"],
            gender=r["gender"],
            food=r["food"],
            water_consumption=r["water_consumption"],
            activity_level=r["activity_level"],
            current_mood=r["current_mood"],
            last_potty_time=r["last_potty_time"],
            is_active=bool(r["is_active"]),
            created_at=r["created_at"],
            updated_at=r["updated_at"]
        ))
    return dogs


@router.get("/active", response_model=Optional[DogResponse])
def get_active_dog(authorization: Optional[str] = Header(None)):
    """Returns the currently active dog."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM dogs WHERE user_id = ? AND is_active = 1 LIMIT 1
    """, (user_id,))
    row = cursor.fetchone()

    if not row:
        # Fall back to first dog for this user
        cursor.execute("""
            SELECT * FROM dogs WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
        """, (user_id,))
        row = cursor.fetchone()

    conn.close()

    if not row:
        return None

    return DogResponse(
        id=row["id"],
        user_id=row["user_id"],
        name=row["name"],
        age=row["age"],
        weight=row["weight"],
        breed=row["breed"],
        gender=row["gender"],
        food=row["food"],
        water_consumption=row["water_consumption"],
        activity_level=row["activity_level"],
        current_mood=row["current_mood"],
        last_potty_time=row["last_potty_time"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )


@router.post("", response_model=DogResponse)
def create_dog(payload: DogCreate, authorization: Optional[str] = Header(None)):
    """Creates a new dog profile."""
    user_id = get_current_user_id(authorization)
    dog_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if this is the first dog, make it active if so
    cursor.execute("SELECT COUNT(*) FROM dogs WHERE user_id = ?", (user_id,))
    count = cursor.fetchone()[0]
    is_active = 1 if count == 0 else 0

    cursor.execute("""
        INSERT INTO dogs (
            id, user_id, name, age, weight, breed, gender, food,
            water_consumption, activity_level, current_mood,
            last_potty_time, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        dog_id, user_id, payload.name, payload.age, payload.weight,
        payload.breed, payload.gender, payload.food,
        payload.water_consumption, payload.activity_level, payload.current_mood,
        payload.last_potty_time or now, is_active, now, now
    ))
    conn.commit()
    conn.close()

    return DogResponse(
        id=dog_id,
        user_id=user_id,
        name=payload.name,
        age=payload.age,
        weight=payload.weight,
        breed=payload.breed,
        gender=payload.gender,
        food=payload.food,
        water_consumption=payload.water_consumption,
        activity_level=payload.activity_level,
        current_mood=payload.current_mood,
        last_potty_time=payload.last_potty_time or now,
        is_active=bool(is_active),
        created_at=now,
        updated_at=now
    )


@router.get("/{id}", response_model=DogResponse)
def get_dog(id: str, authorization: Optional[str] = Header(None)):
    """Retrieves a single dog profile by ID."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dogs WHERE id = ? AND user_id = ?", (id, user_id))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Where's the pup? Dog profile not found.")

    return DogResponse(
        id=row["id"],
        user_id=row["user_id"],
        name=row["name"],
        age=row["age"],
        weight=row["weight"],
        breed=row["breed"],
        gender=row["gender"],
        food=row["food"],
        water_consumption=row["water_consumption"],
        activity_level=row["activity_level"],
        current_mood=row["current_mood"],
        last_potty_time=row["last_potty_time"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )


@router.put("/{id}", response_model=DogResponse)
def update_dog(id: str, payload: DogUpdate, authorization: Optional[str] = Header(None)):
    """Updates an existing dog profile."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dogs WHERE id = ? AND user_id = ?", (id, user_id))
    existing = cursor.fetchone()

    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Dog profile not found.")

    now = datetime.now(timezone.utc).isoformat()
    fields = []
    values = []

    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "is_active" and val:
            # Unset active on other dogs for this user
            cursor.execute("UPDATE dogs SET is_active = 0 WHERE user_id = ?", (user_id,))
            fields.append("is_active = ?")
            values.append(1)
        elif field != "is_active":
            fields.append(f"{field} = ?")
            values.append(val)

    fields.append("updated_at = ?")
    values.append(now)

    values.append(id)
    values.append(user_id)

    query = f"UPDATE dogs SET {', '.join(fields)} WHERE id = ? AND user_id = ?"
    cursor.execute(query, values)
    conn.commit()

    cursor.execute("SELECT * FROM dogs WHERE id = ?", (id,))
    updated = cursor.fetchone()
    conn.close()

    return DogResponse(
        id=updated["id"],
        user_id=updated["user_id"],
        name=updated["name"],
        age=updated["age"],
        weight=updated["weight"],
        breed=updated["breed"],
        gender=updated["gender"],
        food=updated["food"],
        water_consumption=updated["water_consumption"],
        activity_level=updated["activity_level"],
        current_mood=updated["current_mood"],
        last_potty_time=updated["last_potty_time"],
        is_active=bool(updated["is_active"]),
        created_at=updated["created_at"],
        updated_at=updated["updated_at"]
    )


@router.post("/{id}/activate")
def activate_dog(id: str, authorization: Optional[str] = Header(None)):
    """Sets a dog as the primary active dog."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE dogs SET is_active = 0 WHERE user_id = ?", (user_id,))
    cursor.execute("UPDATE dogs SET is_active = 1 WHERE id = ? AND user_id = ?", (id, user_id))
    conn.commit()
    conn.close()

    return {"message": "Active pup updated!", "active_dog_id": id}


@router.delete("/{id}")
def delete_dog(id: str, authorization: Optional[str] = Header(None)):
    """Deletes a dog profile."""
    user_id = get_current_user_id(authorization)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM dogs WHERE id = ? AND user_id = ?", (id, user_id))
    cursor.execute("DELETE FROM potty_events WHERE dog_id = ?", (id,))
    cursor.execute("DELETE FROM predictions WHERE dog_id = ?", (id,))
    conn.commit()
    conn.close()

    return {"message": "Dog profile removed successfully."}
