// PawPotty AI Scanner Controller
// WebRTC Camera + Canvas Throttling + Telemetry & Alerts

let cameraStream = null;
let scannerInterval = null;
let isScanning = false;
let activeDogId = null;
let lastMovementVal = 0.0;
let alertSoundPlayedForSession = false;

async function initScanner() {
    activeDogId = PawAPI.getActiveDogId();
    setupScannerUI();
    await checkScannerCapabilities();
}

async function checkScannerCapabilities() {
    try {
        const caps = await PawAPI.getScannerCapabilities();
        const badgeEl = document.getElementById("scannerCapabilityBadge");
        if (badgeEl) {
            if (caps.capability_state === "full_ai") {
                badgeEl.className = "badge badge-success";
                badgeEl.innerHTML = `<span class="dot dot-green"></span> Full AI (YOLO + Posture)`;
            } else if (caps.capability_state === "dog_detection") {
                badgeEl.className = "badge badge-warning";
                badgeEl.innerHTML = `<span class="dot dot-yellow"></span> Dog Detection (YOLOv8)`;
            } else {
                badgeEl.className = "badge badge-neutral";
                badgeEl.innerHTML = `<span class="dot dot-gray"></span> Experimental (Motion Radar)`;
            }
        }
    } catch (e) {
        console.warn("Capability check error:", e);
    }
}

function setupScannerUI() {
    const startBtn = document.getElementById("btnToggleScanner");
    if (startBtn) {
        startBtn.onclick = () => {
            if (!isScanning) {
                startScanner();
            } else {
                stopScanner();
            }
        };
    }

    const alertCloseBtn = document.getElementById("btnCloseAlertModal");
    if (alertCloseBtn) {
        alertCloseBtn.onclick = () => {
            document.getElementById("pottyAlertModal").style.display = "none";
        };
    }
}

async function startScanner() {
    const video = document.getElementById("cameraVideo");
    const placeholder = document.getElementById("scannerPlaceholder");
    const startBtn = document.getElementById("btnToggleScanner");
    const statusMsgEl = document.getElementById("scannerStatusMsg");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        PawAPI.showToast("Your browser does not support camera streaming. You can still use the Potty Calculator! 💩", "warning");
        return;
    }

    try {
        // Attempt 1: Standard constraints with flexible ideal dimensions
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
        } catch (e1) {
            // Attempt 2: Minimal generic constraint fallback (works on all desktop/USB webcams)
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
        }

        video.srcObject = cameraStream;
        await video.play();

        isScanning = true;
        if (placeholder) placeholder.style.display = "none";
        if (startBtn) {
            startBtn.className = "btn btn-danger";
            startBtn.innerHTML = `<span>⏹</span> Stop Scanner`;
        }

        if (statusMsgEl) statusMsgEl.textContent = "Watching for suspicious circles...";
        PawAPI.showToast("Camera active! Sniffing out dog signals... 🐾", "success");

        // Start throttled frame processing (approx 3 FPS = every 350ms)
        scannerInterval = setInterval(captureAndSendFrame, 350);

        // Start session on backend
        await PawAPI.startScanner(activeDogId).catch(() => {});
    } catch (err) {
        console.error("Camera access error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            PawAPI.showToast("Camera access was blocked. Click the lock/camera icon in your address bar to Allow camera! 📹", "warning");
            if (statusMsgEl) {
                statusMsgEl.innerHTML = `⚠️ <strong>Camera blocked in browser:</strong> Click the camera icon in your address bar (or site settings) and select <em>Allow</em>, then click Start Scanner.`;
            }
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            PawAPI.showToast("No webcam detected. Routine-based prediction is still fully active!", "warning");
        } else {
            PawAPI.showToast("Camera could not be opened. You can still use the Potty Calculator! 💩", "warning");
        }
    }
}

function stopScanner() {
    isScanning = false;
    if (scannerInterval) {
        clearInterval(scannerInterval);
        scannerInterval = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    const video = document.getElementById("cameraVideo");
    if (video) video.srcObject = null;

    const placeholder = document.getElementById("scannerPlaceholder");
    if (placeholder) placeholder.style.display = "flex";

    const startBtn = document.getElementById("btnToggleScanner");
    if (startBtn) {
        startBtn.className = "btn btn-primary";
        startBtn.innerHTML = `<span>📷</span> Start Scanner`;
    }

    const canvas = document.getElementById("overlayCanvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const targetBadge = document.getElementById("scannerTargetBadge");
    if (targetBadge) targetBadge.style.display = "none";

    PawAPI.showToast("Scanner paused.", "info");
}

async function captureAndSendFrame() {
    if (!isScanning) return;

    const video = document.getElementById("cameraVideo");
    if (!video || video.videoWidth === 0) return;

    // Off-screen canvas to capture snapshot
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = 320;
    captureCanvas.height = 240;
    const ctx = captureCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    const base64Data = captureCanvas.toDataURL("image/jpeg", 0.65);

    try {
        const telemetry = await PawAPI.sendFrame({
            dog_id: activeDogId,
            image_base64: base64Data,
            previous_movement: lastMovementVal
        });

        lastMovementVal = telemetry.movement;
        updateScannerTelemetry(telemetry);
    } catch (e) {
        // Silent catch for network drops during live scan
    }
}

function updateScannerTelemetry(data) {
    const canvas = document.getElementById("overlayCanvas");
    const video = document.getElementById("cameraVideo");
    const targetBadge = document.getElementById("scannerTargetBadge");
    const statusMsgEl = document.getElementById("scannerStatusMsg");

    // Update Status Message
    if (statusMsgEl && data.status_message) {
        statusMsgEl.textContent = data.status_message;
    }

    // Telemetry Meters
    const restlessFill = document.getElementById("meterRestlessnessFill");
    const restlessText = document.getElementById("meterRestlessnessText");
    const moveFill = document.getElementById("meterMovementFill");
    const moveText = document.getElementById("meterMovementText");
    const radarFill = document.getElementById("meterRadarFill");
    const radarText = document.getElementById("meterRadarText");

    const rPercent = Math.round(data.restlessness * 100);
    const mPercent = Math.round(data.movement * 100);
    const pPercent = data.potty_probability;

    if (restlessFill) {
        restlessFill.style.width = `${rPercent}%`;
        restlessFill.style.background = rPercent > 65 ? "var(--warning)" : "var(--primary)";
    }
    if (restlessText) restlessText.textContent = `${rPercent}%`;

    if (moveFill) {
        moveFill.style.width = `${mPercent}%`;
        moveFill.style.background = mPercent > 65 ? "var(--warning)" : "var(--primary)";
    }
    if (moveText) moveText.textContent = `${mPercent}%`;

    if (radarFill) {
        radarFill.style.width = `${pPercent}%`;
        radarFill.style.background = pPercent > 80 ? "var(--danger)" : (pPercent > 60 ? "var(--accent)" : "var(--primary)");
    }
    if (radarText) radarText.textContent = `${pPercent}%`;

    // Overlay Canvas Rendering (Bounding Boxes)
    if (canvas && video) {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (data.dog_detected && data.bounding_boxes && data.bounding_boxes.length > 0) {
            if (targetBadge) {
                targetBadge.style.display = "flex";
                targetBadge.innerHTML = `<span>🐶</span> Dog Detected`;
            }

            // Draw bounding boxes scaled to video dimensions
            data.bounding_boxes.forEach(box => {
                const scaleX = canvas.width / 320;
                const scaleY = canvas.height / 240;
                const bx = (box.x - box.width / 2) * scaleX;
                const by = (box.y - box.height / 2) * scaleY;
                const bw = box.width * scaleX;
                const bh = box.height * scaleY;

                ctx.strokeStyle = "#6FAF72";
                ctx.lineWidth = 3;
                ctx.strokeRect(bx, by, bw, bh);

                // Label tag
                ctx.fillStyle = "rgba(111, 175, 114, 0.9)";
                ctx.fillRect(bx, by - 24, 90, 24);
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 12px sans-serif";
                ctx.fillText(`Dog ${(box.confidence * 100).toFixed(0)}%`, bx + 6, by - 7);
            });
        } else {
            if (targetBadge) targetBadge.style.display = "none";
        }
    }

    // Check alert threshold
    const threshold = parseInt(localStorage.getItem("pawpotty_alert_threshold") || "85", 10);
    if (pPercent >= threshold && !alertSoundPlayedForSession) {
        triggerPottyAlertModal(pPercent, data.estimated_minutes);
    }
}

function triggerPottyAlertModal(prob, minutes) {
    const modal = document.getElementById("pottyAlertModal");
    const probEl = document.getElementById("alertModalProb");
    const estEl = document.getElementById("alertModalEst");

    if (probEl) probEl.textContent = `${prob}%`;
    if (estEl) estEl.textContent = `~${minutes} minutes`;
    if (modal) modal.style.display = "flex";

    alertSoundPlayedForSession = true;

    // Play chime if enabled
    if (localStorage.getItem("pawpotty_sound_enabled") !== "false") {
        playChime();
    }

    // Trigger browser notification if granted
    if (Notification.permission === "granted" && localStorage.getItem("pawpotty_notifs_enabled") === "true") {
        new Notification("🚨 PawPotty Alert!", {
            body: `Your pup's potty radar is at ${prob}%! Estimated time: ~${minutes} minutes.`,
            icon: "/favicon.ico"
        });
    }
}

function playChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.95);
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", initScanner);