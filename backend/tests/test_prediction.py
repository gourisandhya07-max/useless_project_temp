import pytest
import builtins
import importlib
from datetime import datetime, timezone, timedelta
from services.prediction_service import calculate_prediction
import services.yolo_service as yolo_service


def test_yolo_service_handles_non_import_errors(monkeypatch):
    """The optional YOLO dependency must degrade safely for any import-time exception, not just ImportError."""
    real_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "ultralytics":
            raise RuntimeError("simulated optional YOLO import failure")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    reloaded = importlib.reload(yolo_service)

    caps = reloaded.get_yolo_capabilities()
    assert caps["yolo_available"] is False
    assert caps["capability_state"] == "experimental"


def test_prediction_clamping():
    """Ensure prediction probabilities are always bounded between 1 and 99."""
    # Extreme low inputs
    now = datetime.now(timezone.utc)
    res_low = calculate_prediction(
        age=5.0,
        weight=30.0,
        food="Kibble",
        water="Low",
        activity_level="Low",
        mood="Sleepy",
        last_potty_time=now.isoformat()  # Just went 0 mins ago
    )
    assert 1 <= res_low["probability"] <= 99
    assert res_low["minutes_until"] >= 60

    # Extreme high inputs (many hours ago, high water, zoomies, circling, squatting)
    past_time = (now - timedelta(hours=12)).isoformat()
    res_high = calculate_prediction(
        age=0.5,
        weight=10.0,
        food="High Protein",
        water="High",
        activity_level="High",
        mood="Suspicious 😂",
        last_potty_time=past_time,
        vision={
            "dog_detected": True,
            "movement": 0.9,
            "restlessness": 0.85,
            "circling": True,
            "squatting": True
        }
    )
    assert 1 <= res_high["probability"] <= 99
    assert res_high["probability"] >= 85
    assert res_high["minutes_until"] <= 15


def test_potty_gap_scaling():
    """Verifies that longer gap since last potty increases the probability."""
    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    five_hours_ago = (now - timedelta(hours=5)).isoformat()

    p1 = calculate_prediction(last_potty_time=one_hour_ago)
    p2 = calculate_prediction(last_potty_time=five_hours_ago)

    assert p2["probability"] > p1["probability"]
    assert p2["hours_since_potty"] > p1["hours_since_potty"]


def test_vision_signals_boost():
    """Verifies that suspicious vision signals (circling, restlessness) increase the score."""
    p_baseline = calculate_prediction()
    p_vision = calculate_prediction(vision={
        "dog_detected": True,
        "restlessness": 0.8,
        "circling": True
    })

    assert p_vision["probability"] > p_baseline["probability"]
    assert any("circling" in f.lower() for f in p_vision["factors"])
