import pytest
import io
import base64
from PIL import Image
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "PawPotty"
    assert "capabilities" in data


def test_dogs_crud():
    # 1. List dogs (seeded Luna should exist)
    list_res = client.get("/api/dogs")
    assert list_res.status_code == 200
    dogs = list_res.json()
    assert len(dogs) >= 1
    assert any(d["name"] == "Luna" for d in dogs)

    # 2. Create a new dog
    new_dog = {
        "name": "Milo",
        "age": 2.0,
        "weight": 18.5,
        "breed": "Beagle",
        "gender": "Male",
        "food": "Chicken & Rice",
        "water_consumption": "High",
        "activity_level": "High",
        "current_mood": "Excited"
    }
    create_res = client.post("/api/dogs", json=new_dog)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["name"] == "Milo"
    dog_id = created["id"]

    # 3. Get single dog
    get_res = client.get(f"/api/dogs/{dog_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Milo"

    # 4. Update dog
    update_res = client.put(f"/api/dogs/{dog_id}", json={"current_mood": "Suspicious 😂"})
    assert update_res.status_code == 200
    assert update_res.json()["current_mood"] == "Suspicious 😂"

    # 5. Delete dog
    del_res = client.delete(f"/api/dogs/{dog_id}")
    assert del_res.status_code == 200


def test_prediction_api_with_fallback():
    payload = {
        "dog_name": "Bruno",
        "age": 4.0,
        "weight": 25.0,
        "food": "Kibble",
        "water": "High",
        "activity_level": "High",
        "mood": "Suspicious 😂"
    }
    res = client.post("/api/predictions", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "probability" in data
    assert "minutes_until" in data
    assert "explanation" in data
    assert len(data["explanation"]) > 10


def test_potty_event_and_stats():
    # Fetch active dog
    active_dog = client.get("/api/dogs/active").json()
    dog_id = active_dog["id"]

    # Log potty break
    event_payload = {
        "dog_id": dog_id,
        "food": "Fresh bowl",
        "water": "Moderate",
        "activity_level": "Moderate",
        "notes": "Test potty break in grass"
    }
    post_res = client.post("/api/potty-events", json=event_payload)
    assert post_res.status_code == 200
    created_event = post_res.json()
    assert created_event["dog_id"] == dog_id

    # Check stats
    stats_res = client.get(f"/api/potty-events/stats/{dog_id}")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_events"] >= 1
    assert "average_accuracy" in stats
    assert "hourly_distribution" in stats


def test_scanner_frame_processing():
    # Create a small dummy JPEG image base64
    img = Image.new("RGB", (100, 100), color=(120, 140, 160))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64_str = base64.b64encode(buf.getvalue()).decode()

    frame_payload = {
        "image_base64": f"data:image/jpeg;base64,{b64_str}",
        "previous_movement": 0.2
    }
    res = client.post("/api/scanner/frame", json=frame_payload)
    assert res.status_code == 200
    data = res.json()
    assert "movement" in data
    assert "restlessness" in data
    assert "status_message" in data
    assert "capability_state" in data
