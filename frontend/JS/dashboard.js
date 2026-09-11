// PawPotty Dashboard Manager

let currentDog = null;
let currentPrediction = null;

async function initDashboard() {
    try {
        await loadGreeting();
        await loadDogsAndActive();
        await refreshPottyRadar();
        setupDashboardEventListeners();
    } catch (err) {
        console.error("Dashboard init error:", err);
    }
}

async function loadGreeting() {
    const user = PawAPI.getUser();
    const greetingEl = document.getElementById("userGreeting");
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17) timeGreeting = "Good evening";

    const firstName = user.name ? user.name.split(" ")[0] : "Friend";
    greetingEl.textContent = `${timeGreeting}, ${firstName} 👋`;
}

async function loadDogsAndActive() {
    try {
        const dogs = await PawAPI.getDogs();
        const activeDog = dogs.find(d => d.is_active) || dogs[0];
        currentDog = activeDog;

        if (activeDog) {
            PawAPI.setActiveDogId(activeDog.id);
            renderActiveDogDetails(activeDog);
        }

        // Render dog switcher dropdown if present
        const switcher = document.getElementById("dogSwitcher");
        if (switcher && dogs.length > 0) {
            switcher.innerHTML = dogs.map(d => `
                <option value="${d.id}" ${d.id === (activeDog?.id) ? 'selected' : ''}>
                    🐶 ${d.name} (${d.breed || 'Pup'})
                </option>
            `).join("");

            switcher.onchange = async (e) => {
                await PawAPI.activateDog(e.target.value);
                PawAPI.showToast(`Switched to ${e.target.selectedOptions[0].text}`, "info");
                await initDashboard();
            };
        }
    } catch (err) {
        console.warn("Could not load dogs:", err);
    }
}

function renderActiveDogDetails(dog) {
    const nameEls = document.querySelectorAll(".dog-name-display");
    nameEls.forEach(el => el.textContent = dog.name);

    const breedEl = document.getElementById("dogBreedDisplay");
    if (breedEl) breedEl.textContent = dog.breed || "Good Pup";

    // Last potty display
    const lastPottyEl = document.getElementById("lastPottyTimeDisplay");
    if (lastPottyEl && dog.last_potty_time) {
        const diffHours = ((Date.now() - new Date(dog.last_potty_time).getTime()) / 3600000);
        const hrs = Math.floor(diffHours);
        const mins = Math.floor((diffHours - hrs) * 60);
        lastPottyEl.textContent = `${hrs}h ${mins}m ago`;
    }
}

async function refreshPottyRadar() {
    if (!currentDog) return;

    try {
        // Run prediction calculation
        const prediction = await PawAPI.predict({
            dog_id: currentDog.id,
            dog_name: currentDog.name,
            food: currentDog.food,
            water: currentDog.water_consumption,
            activity_level: currentDog.activity_level,
            mood: currentDog.current_mood,
            last_potty_time: currentDog.last_potty_time
        });

        currentPrediction = prediction;
        renderRadarCard(prediction);
        checkAlertThreshold(prediction.probability);

        // Also fetch stats for today's count
        const stats = await PawAPI.getPottyStats(currentDog.id);
        const todayCountEl = document.getElementById("todayPottyCount");
        if (todayCountEl && stats) {
            todayCountEl.textContent = stats.today_count;
        }
    } catch (err) {
        console.error("Radar refresh failed:", err);
    }
}

function renderRadarCard(pred) {
    const percentEl = document.getElementById("radarPercent");
    const statusTitleEl = document.getElementById("radarStatusTitle");
    const estTimeEl = document.getElementById("radarEstTime");
    const countdownEl = document.getElementById("radarCountdownMins");
    const explanationEl = document.getElementById("radarExplanation");
    const gaugePath = document.getElementById("gaugeCircle");

    if (percentEl) percentEl.textContent = `${pred.probability}%`;

    // Calculate stroke offset for circular dial (circumference = 2 * PI * 45 ≈ 283)
    if (gaugePath) {
        const circ = 283;
        const offset = circ - (circ * (pred.probability / 100));
        gaugePath.style.strokeDashoffset = offset;

        // Change color based on severity
        if (pred.probability >= 85) gaugePath.style.stroke = "var(--danger)";
        else if (pred.probability >= 65) gaugePath.style.stroke = "var(--accent)";
        else gaugePath.style.stroke = "var(--primary)";
    }

    if (statusTitleEl) {
        if (pred.probability >= 85) statusTitleEl.textContent = "Looking very suspicious 👀";
        else if (pred.probability >= 65) statusTitleEl.textContent = "Warming up nicely 🐕";
        else statusTitleEl.textContent = "Safe and relaxed 🛋️";
    }

    if (estTimeEl && pred.predicted_time) {
        const d = new Date(pred.predicted_time);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        estTimeEl.textContent = `Estimated Potty Time: ~${timeStr}`;
    }

    if (countdownEl) {
        countdownEl.textContent = `~${pred.minutes_until} minutes remaining`;
    }

    if (explanationEl && pred.explanation) {
        explanationEl.textContent = `"${pred.explanation}"`;
    }

    // Render factor pills
    const signalsList = document.getElementById("radarSignalsList");
    if (signalsList && pred.factors) {
        signalsList.innerHTML = pred.factors.slice(0, 3).map(f => `
            <div class="radar-signal-pill">
                <span class="dot dot-green"></span>
                <span>${f}</span>
            </div>
        `).join("");
    }
}

function checkAlertThreshold(prob) {
    const threshold = parseInt(localStorage.getItem("pawpotty_alert_threshold") || "85", 10);
    const soundEnabled = localStorage.getItem("pawpotty_sound_enabled") !== "false";

    if (prob >= threshold) {
        // Show visual alert if not already dismissed in this session
        const alertBanner = document.getElementById("dashboardAlertBanner");
        if (alertBanner) {
            alertBanner.style.display = "flex";
            const alertProb = document.getElementById("bannerAlertProb");
            if (alertProb) alertProb.textContent = `${prob}%`;
        }

        if (soundEnabled && !window._alertSoundPlayed) {
            playSoftPottyChime();
            window._alertSoundPlayed = true;
        }
    }
}

function playSoftPottyChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        // Friendly playful chime: two notes C5 -> G5
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.85);
    } catch (e) {}
}

function setupDashboardEventListeners() {
    // Quick log potty break
    const quickLogBtn = document.getElementById("btnQuickLogPotty");
    if (quickLogBtn) {
        quickLogBtn.onclick = async () => {
            if (!currentDog) return;
            try {
                await PawAPI.logPottyEvent({
                    dog_id: currentDog.id,
                    notes: "Quick break logged from dashboard"
                });
                PawAPI.showToast(`Potty break recorded for ${currentDog.name}! 💩`, "success");
                await initDashboard();
            } catch (err) {
                PawAPI.showToast("Could not record potty break", "danger");
            }
        };
    }
}

document.addEventListener("DOMContentLoaded", initDashboard);