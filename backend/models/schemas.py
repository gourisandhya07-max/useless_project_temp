from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    created_at: Optional[str] = None


class DogBase(BaseModel):
    name: str = Field(..., min_length=1)
    age: Optional[float] = Field(default=2.0, ge=0.1, le=25.0)
    weight: Optional[float] = Field(default=20.0, ge=0.5, le=120.0)
    breed: Optional[str] = "Mixed Breed"
    gender: Optional[str] = "Unknown"
    food: Optional[str] = "Standard Kibble"
    water_consumption: Optional[str] = "Moderate"  # Low, Moderate, High
    activity_level: Optional[str] = "Moderate"      # Low, Moderate, High
    current_mood: Optional[str] = "Calm"           # Calm, Happy, Excited, Restless, Sleepy, Suspicious 😂
    last_potty_time: Optional[str] = None


class DogCreate(DogBase):
    pass


class DogUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[float] = None
    weight: Optional[float] = None
    breed: Optional[str] = None
    gender: Optional[str] = None
    food: Optional[str] = None
    water_consumption: Optional[str] = None
    activity_level: Optional[str] = None
    current_mood: Optional[str] = None
    last_potty_time: Optional[str] = None
    is_active: Optional[bool] = None


class DogResponse(DogBase):
    id: str
    user_id: Optional[str] = None
    is_active: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PottyEventCreate(BaseModel):
    dog_id: str
    potty_time: Optional[str] = None
    food: Optional[str] = None
    water: Optional[str] = None
    activity_level: Optional[str] = None
    notes: Optional[str] = None


class PottyEventResponse(BaseModel):
    id: str
    dog_id: str
    potty_time: str
    food: Optional[str] = None
    water: Optional[str] = None
    activity_level: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None


class PredictionRequest(BaseModel):
    dog_id: Optional[str] = None
    dog_name: Optional[str] = "Your pup"
    age: Optional[float] = 2.0
    weight: Optional[float] = 20.0
    food: Optional[str] = "Regular food"
    water: Optional[str] = "Moderate"
    activity_level: Optional[str] = "Moderate"
    mood: Optional[str] = "Calm"
    last_potty_time: Optional[str] = None
    vision: Optional[Dict[str, Any]] = None


class PredictionResponse(BaseModel):
    probability: int
    confidence: int
    minutes_until: int
    predicted_time: str
    factors: List[str]
    recommended_action: str
    hours_since_potty: float
    explanation: Optional[str] = None


class ScannerFrameRequest(BaseModel):
    dog_id: Optional[str] = None
    image_base64: str
    previous_movement: Optional[float] = 0.0


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    confidence: float
    label: str


class ScannerFrameResponse(BaseModel):
    dog_detected: bool
    dog_count: int
    bounding_boxes: List[BoundingBox] = []
    human_detected: bool = False
    human_count: int = 0
    human_bounding_boxes: List[BoundingBox] = []
    posture: Optional[str] = None
    movement: float
    restlessness: float
    circling: bool
    squatting: bool
    facial_signal: Optional[str] = None
    capability_state: str  # full_ai, dog_detection, experimental, routine
    status_message: str
    potty_probability: int
    estimated_minutes: int


class GroqExplanationRequest(BaseModel):
    dog_name: str = "Luna"
    probability: int = 85
    minutes: int = 15
    restlessness: Optional[str] = "moderate"
    circling: Optional[bool] = False
    last_potty_hours: Optional[float] = 4.0
    water: Optional[str] = "high"
    activity: Optional[str] = "high"
    mood: Optional[str] = "Suspicious 😂"


class GroqExplanationResponse(BaseModel):
    explanation: str
    recommended_action: str
    source: str  # "groq" or "fallback"
