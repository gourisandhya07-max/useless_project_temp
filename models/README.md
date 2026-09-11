# 🐾 PawPotty — Computer Vision & YOLO Models

PawPotty uses a modular, layered computer vision architecture designed for browser-to-backend real-time telemetry.

---

## 1. Vision Architecture Overview

```
 Browser Camera (HTML5 getUserMedia)
                 │
                 ▼
  Canvas Snapshot Throttling (3–5 FPS)
                 │  Base64 Frame Payload
                 ▼
     POST /api/scanner/frame
                 │
        ┌────────┴────────┐
        ▼                 ▼
 1. Optical Frame   2. YOLO Detection Service
    Diff Analyzer      (Ultralytics YOLOv8n)
  (Movement & Restlessness)│
                           ├── Standard COCO (Class 16: Dog)
                           └── Custom Posture Model (Optional)
                                 (Squatting, Circling, Sitting)
        └────────┬────────┘
                 ▼
       Live Potty Radar Score & Status Copy
```

---

## 2. Model Capabilities & Capability States

PawPotty clearly reports its live CV state to the user without fabricating results:

| State Badge | Mode | Description |
| :--- | :--- | :--- |
| 🟢 **Full AI** | YOLO + Custom Posture Model | Detects dogs and infers specific postures (squatting, circling, standing, resting). |
| 🟡 **Dog Detection** | YOLOv8 COCO Active | Detects dogs in frame with bounding boxes and confidence score. |
| 🔵 **Experimental** | Optical Frame Telemetry | Tracks live movement intensity and restlessness via consecutive frame difference. |
| ⚪ **Routine Mode** | Camera Disabled | Relies entirely on diet, hydration, mood, and elapsed time factors. |

---

## 3. How to Plug In a Custom Posture Model

To add a custom dog posture model:

1. **Train or export a YOLOv8 posture model** (e.g. `dog_posture_yolov8.pt`) with class labels:
   - `0: standing`
   - `1: sitting`
   - `2: lying`
   - `3: squatting`
   - `4: circling`
   - `5: pacing`

2. **Place the weights file** in the `models/` directory:
   ```bash
   cp dog_posture_yolov8.pt models/custom_posture.pt
   ```

3. **Set the environment variable** in `backend/.env`:
   ```env
   CUSTOM_POSTURE_MODEL_PATH=../models/custom_posture.pt
   ```

4. The backend service (`backend/services/yolo_service.py`) will automatically discover and load the model on startup, upgrading the scanner capability to 🟢 **Full AI**.

---

## 4. Camera & HTTPS Requirements

- **Localhost Development**: Browser WebRTC (`navigator.mediaDevices.getUserMedia`) operates without SSL on `localhost` and `127.0.0.1`.
- **Production Deployment**: Camera APIs strictly require a secure origin (`HTTPS`) in all modern browsers.
- **Throttling**: The client transmits 3–5 FPS to optimize network latency and CPU utilization.
