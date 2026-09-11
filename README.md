# 🐾 PawPotty — AI Dog Potty Time Predictor 💩

> **Tagline:** *Know Before They Go.* 🐾  
> **TinkerHub Useless Projects Hackathon Edition**

PawPotty is a fun, polished hackathon product that playfully estimates when a dog might need to take a potty break by combining routine history, dietary and hydration factors, time elapsed, and real-time camera computer vision (optical frame differencing & YOLO detection), enriched with witty, dog-loving commentary from Groq AI.

---

## 🎯 Basic Details
### Team Name: PawDetectives
### Project Description
An experimental full-stack AI potty radar that combines your dog's daily routine, potty history, and real-time behavioral cues to make a playful guess about when they might need to go outside.

### The Problem (that doesn't exist)
Dog parents waste precious minutes trying to guess whether their dog's suspicious hallway pacing is just boredom, a craving for treats, or an imminent indoor biohazard situation.

### The Solution (that nobody asked for)
An AI "potty radar" with real-time camera scanning, optical movement differencing, deterministic potty probability heuristics, and Groq-powered witty commentary to alert pet parents before emergency accidents happen!

---

## 🏗️ Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            PawPotty Frontend           │
                      │ (Vanilla HTML5 / CSS3 / JavaScript ES6)│
                      └───────────────────┬────────────────────┘
                                          │
                        REST API & WebRTC │ (Throttled Frame POSTs)
                                          ▼
                      ┌────────────────────────────────────────┐
                      │          FastAPI Python Backend        │
                      │         (Uvicorn ASGI Server)          │
                      └─────┬────────────────┬───────────┬─────┘
                            │                │           │
                            ▼                ▼           ▼
                   ┌────────────────┐ ┌─────────────┐ ┌────────────────┐
                   │  Prediction    │ │ YOLO/Vision │ │  Groq AI LLM   │
                   │  Engine (Math) │ │ Service     │ │ (Llama 3.3 70B)│
                   └────────────────┘ └─────────────┘ └────────────────┘
                            │                │
                            ▼                ▼
                   ┌────────────────────────────────┐
                   │     Dual Persistence Layer     │
                   │  (SQLite Local + Supabase RLS) │
                   └────────────────────────────────┘
```

---

## 🎨 Visual Design & Personality

PawPotty is intentionally designed to feel like **70% modern SaaS + 20% pet personality + 10% playful humor**:
- **Palette:** Warm cream background (`#F7F6F1`), soft green (`#6FAF72`), muted amber (`#F2B84B`), warm brown (`#8A6A52`), and deep charcoal (`#252525`).
- **No robotic AI tropes:** No neon cyberpunk gradients, no glowing neural networks, no robot faces.
- **Friendly copy:** Instead of *"Probability threshold exceeded"*, PawPotty says: *"Uh oh. The poop radar is getting serious. 💩"*.
- **Subtle micro-interactions:** Bouncing paws, animated circular SVG radar gauges, and soft synthesizer audio chimes.

---

## ⚙️ Technical Stack

- **Backend:** Python 3.10–3.14, FastAPI, Uvicorn, Pydantic, HTTPX, Pillow, NumPy, PyTest.
- **Vision Subsystem:** Modular `yolo_service.py` (Ultralytics YOLOv8n COCO dog detection) + `vision_service.py` (Optical frame differencing & restlessness index calculation).
- **AI Explanations:** Groq API (`llama-3.3-70b-versatile`) with local template fallbacks.
- **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript (Zero heavy frameworks, clean modular scripts).
- **Charts & Visuals:** Chart.js for 24-hour distribution and accuracy trend tracking.
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) + zero-config local SQLite (`pawpotty.db`).

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
- Python 3.10+ (Python 3.14 supported)
- Modern web browser (Chrome, Edge, Safari, Firefox)

### 2. Install Dependencies
```bash
cd backend
python -m pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```

Edit `backend/.env`:
```env
# Supabase (Optional - SQLite is automatically used if unconfigured)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq API (Optional - local charming fallback is used if missing)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Server Port
PORT=8000
```

### 4. Run FastAPI Backend
```bash
cd backend
python main.py
```
Backend will start at: **`http://127.0.0.1:8000`**

### 5. Open PawPotty
Visit **`http://127.0.0.1:8000`** in your browser. The landing page, dashboard, calculator, camera scanner, and history pages are all served directly!

---

## 📡 Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & CV capability report |
| `GET` | `/api/dogs` | List user dogs (Luna pre-seeded) |
| `POST` | `/api/dogs` | Create new dog profile |
| `POST` | `/api/predictions` | Calculate deterministic prediction + Groq explanation |
| `POST` | `/api/potty-events` | Record actual potty break |
| `GET` | `/api/potty-events/stats/{dog_id}` | Aggregated intervals, accuracy & hourly distribution |
| `POST` | `/api/scanner/frame` | Analyze browser camera frame & update live radar |
| `POST` | `/api/ai/explanation` | Generate standalone Groq dog behavior summary |

---

## 📷 Camera Requirements & HTTPS

- **Localhost Development:** WebRTC camera access (`navigator.mediaDevices.getUserMedia`) functions without SSL on `localhost` and `127.0.0.1`.
- **Production Deployment:** All modern mobile and desktop browsers strictly require HTTPS to stream camera video.
- **Opt-In Flow:** PawPotty never asks for camera permissions on page load. Access is only requested when the user clicks **"Start Scanner"**.

---

## 🧠 How the Prediction Heuristic Works

The numerical prediction is calculated deterministically in `backend/services/prediction_service.py`:

$$\text{Probability} = \text{Clamp}\Big( \text{Base} + S_{\text{time}} + S_{\text{activity}} + S_{\text{water}} + S_{\text{mood}} + S_{\text{vision}}, \ 1, \ 99 \Big)$$

- **Baseline:** 15 points
- **Time Factor ($S_{\text{time}}$):** Up to +40 points based on hours since last potty break ($\times 8.5$ for adults, $\times 10.5$ for young pups).
- **Activity ($S_{\text{activity}}$):** Low (+5), Moderate (+12), High (+20).
- **Water ($S_{\text{water}}$):** Low (+2), Moderate (+8), High (+16).
- **Mood ($S_{\text{mood}}$):** Calm (0), Happy (+3), Excited (+8), Restless (+18), Suspicious (+16).
- **Vision Telemetry ($S_{\text{vision}}$):** Dog in frame (+4), Restlessness > 60% (+12), Movement > 65% (+8), Circling (+18), Squatting (+30).

---

## 🧪 Running Automated Tests

Run the full PyTest suite:
```bash
cd backend
python -m pytest tests/ -v
```
Verifies probability clamping, time-gap scaling, vision signals weighting, dog CRUD, potty logging, and scanner frame analysis.

---

## ⚠️ Disclaimer
PawPotty is an experimental/fun prediction tool for pet owners. Its estimates are not scientifically validated and are not veterinary or medical advice.

---
Made with ❤️ for TinkerHub Useless Projects
