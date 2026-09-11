const video = document.getElementById("camera");
const startButton = document.getElementById("startCamera");
const stopButton = document.getElementById("stopCamera");
const scanButton = document.getElementById("scanNow");
const status = document.getElementById("scannerStatus");
const resultBox = document.getElementById("visionResult");

let stream = null;
let scanInterval = null;
let isAnalyzing = false;


// -----------------------------
// BUTTON EVENTS
// -----------------------------

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
scanButton.addEventListener("click", analyzeDog);


// -----------------------------
// START CAMERA
// -----------------------------

async function startCamera() {

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            throw new Error("Camera API not supported");
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;

        status.textContent =
            "🟢 Camera active — point it at your dog";

        resultBox.innerHTML = `
            <h3>🐶 Camera Ready</h3>
            <p>
                Point the camera at your dog and click
                <strong>Analyze Dog</strong>.
            </p>
        `;

        startButton.disabled = true;
        stopButton.disabled = false;
        scanButton.disabled = false;

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Camera permission denied or unavailable";

        resultBox.innerHTML = `
            <h3>⚠️ Camera unavailable</h3>

            <p>
                PawPotty couldn't access your camera.
            </p>

            <p>
                Don't worry — the normal potty calculator
                still works without the camera.
            </p>

            <a href="calculator.html"
               class="btn primary">
                💩 Use Calculator
            </a>
        `;
    }
}


// -----------------------------
// STOP CAMERA
// -----------------------------

function stopCamera() {

    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }

    if (stream) {

        stream
            .getTracks()
            .forEach(track => track.stop());

        stream = null;
    }

    video.srcObject = null;

    status.textContent = "Camera stopped";

    startButton.disabled = false;
    stopButton.disabled = true;

    resultBox.innerHTML = `
        <h3>📷 Camera stopped</h3>
        <p>Start the camera whenever you're ready.</p>
    `;
}


// -----------------------------
// ANALYZE CURRENT CAMERA FRAME
// -----------------------------

async function analyzeDog() {

    if (!stream) {

        resultBox.innerHTML = `
            <h3>⚠️ Camera not started</h3>
            <p>Start the camera first.</p>
        `;

        return;
    }

    if (isAnalyzing) return;

    isAnalyzing = true;

    scanButton.disabled = true;

    status.textContent = "🧠 Analyzing your dog...";

    resultBox.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>

            <h3>🤖 AI is looking...</h3>

            <p>
                Checking for a suspicious amount of dog.
            </p>
        </div>
    `;


    try {

        // Make sure video has loaded
        if (!video.videoWidth || !video.videoHeight) {

            throw new Error(
                "Camera frame is not ready yet."
            );
        }


        // Create canvas
        const canvas =
            document.createElement("canvas");

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        const context =
            canvas.getContext("2d");

        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );


        // Convert image to Blob
        const blob =
            await new Promise(resolve => {

                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    0.85
                );

            });


        if (!blob) {
            throw new Error(
                "Could not capture camera image."
            );
        }


        // Send image to backend
        const formData =
            new FormData();

        formData.append(
            "file",
            blob,
            "dog.jpg"
        );


        const response =
            await fetch(
                `${API_URL}/api/scanner/analyze`,
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                "Scanner API request failed."
            );
        }


        const data =
            await response.json();


        displayScannerResult(data);


    } catch (error) {

        console.error(error);

        status.textContent =
            "⚠️ Scanner error";

        resultBox.innerHTML = `
            <h3>⚠️ AI Scanner unavailable</h3>

            <p>
                Something went wrong while analyzing
                the camera image.
            </p>

            <p>
                Switching to routine-based prediction.
            </p>

            <a href="calculator.html"
               class="btn primary">
                💩 Calculate Potty Time
            </a>
        `;

    } finally {

        isAnalyzing = false;

        scanButton.disabled = false;
    }
}


// -----------------------------
// DISPLAY SCANNER RESULT
// -----------------------------

function displayScannerResult(data) {

    if (!data.available) {

        status.textContent =
            "⚠️ AI Scanner unavailable";

        resultBox.innerHTML = `
            <div class="scanner-warning">

                <h3>
                    ⚠️ AI Scanner unavailable
                </h3>

                <p>
                    YOLO could not be loaded.
                    Switching to routine-based prediction.
                </p>

                <a href="calculator.html"
                   class="btn primary">
                    💩 Use Calculator
                </a>

            </div>
        `;

        return;
    }


    status.textContent =
        data.dog_detected
            ? "🟢 Dog detected"
            : "🟡 Looking for a dog...";


    const dogStatus =
        data.dog_detected
            ? "🐶 Dog detected!"
            : "🔎 No dog detected";


    const dogCount =
        Number(data.dog_count || 0);


    const restlessness =
        data.restlessness
            ? "High"
            : "Not detected";


    const circling =
        data.circling
            ? "Detected"
            : "Not detected";


    const squatting =
        data.squatting
            ? "Detected"
            : "Not detected";


    resultBox.innerHTML = `

        <div class="scanner-result">

            <h2>${dogStatus}</h2>

            <div class="vision-grid">

                <div class="vision-item">
                    <span>🐶</span>
                    <small>Dogs detected</small>
                    <strong>${dogCount}</strong>
                </div>


                <div class="vision-item">
                    <span>🏃</span>
                    <small>Restlessness</small>
                    <strong>${restlessness}</strong>
                </div>


                <div class="vision-item">
                    <span>🔄</span>
                    <small>Circling</small>
                    <strong>${circling}</strong>
                </div>


                <div class="vision-item">
                    <span>🧎</span>
                    <small>Squatting</small>
                    <strong>${squatting}</strong>
                </div>

            </div>


            ${
                dogCount > 1
                ? `
                    <div class="scanner-warning">
                        ⚠️ Multiple dogs detected.
                        Make sure you're analyzing the correct dog.
                    </div>
                `
                : ""
            }


            ${
                data.dog_detected
                ? `
                    <div class="scanner-success">

                        <h3>
                            🧠 Behavioral Analysis
                        </h3>

                        <p>
                            ${
                                data.message ||
                                "Dog detected successfully."
                            }
                        </p>

                    </div>
                `
                : `
                    <div class="scanner-warning">

                        <p>
                            🐕 No dog detected in this frame.
                        </p>

                        <p>
                            Try moving the camera closer
                            or changing the angle.
                        </p>

                    </div>
                `
            }

        </div>
    `;
}


// -----------------------------
// CLEANUP WHEN LEAVING PAGE
// -----------------------------

window.addEventListener(
    "beforeunload",
    stopCamera
);