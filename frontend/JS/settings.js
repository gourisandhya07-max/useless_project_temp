// PawPotty Settings Controller

function initSettings() {
    loadSettingsValues();
    setupSettingsListeners();
}

function loadSettingsValues() {
    const user = PawAPI.getUser();
    const nameInput = document.getElementById("settingsUserName");
    const emailInput = document.getElementById("settingsUserEmail");

    if (nameInput) nameInput.value = user.name || "Alex & Bruno";
    if (emailInput) emailInput.value = user.email || "alex@pawpotty.app";

    // Threshold
    const threshold = localStorage.getItem("pawpotty_alert_threshold") || "85";
    const slider = document.getElementById("thresholdSlider");
    const valDisplay = document.getElementById("thresholdValDisplay");
    if (slider) slider.value = threshold;
    if (valDisplay) valDisplay.textContent = `${threshold}%`;

    // Sound toggle
    const soundToggle = document.getElementById("toggleSoundAlerts");
    if (soundToggle) {
        soundToggle.checked = localStorage.getItem("pawpotty_sound_enabled") !== "false";
    }

    // Browser Notification toggle
    const notifToggle = document.getElementById("toggleBrowserNotifs");
    if (notifToggle) {
        notifToggle.checked = localStorage.getItem("pawpotty_notifs_enabled") === "true" && Notification.permission === "granted";
    }
}

function setupSettingsListeners() {
    // Threshold slider
    const slider = document.getElementById("thresholdSlider");
    const valDisplay = document.getElementById("thresholdValDisplay");
    if (slider) {
        slider.oninput = (e) => {
            valDisplay.textContent = `${e.target.value}%`;
            localStorage.setItem("pawpotty_alert_threshold", e.target.value);
        };
    }

    // Sound toggle
    const soundToggle = document.getElementById("toggleSoundAlerts");
    if (soundToggle) {
        soundToggle.onchange = (e) => {
            localStorage.setItem("pawpotty_sound_enabled", e.target.checked);
            PawAPI.showToast(e.target.checked ? "Audio alert chimes enabled! 🔔" : "Audio alert chimes muted.", "info");
        };
    }

    // Notification toggle
    const notifToggle = document.getElementById("toggleBrowserNotifs");
    if (notifToggle) {
        notifToggle.onchange = async (e) => {
            if (e.target.checked) {
                if ("Notification" in window) {
                    const perm = await Notification.requestPermission();
                    if (perm === "granted") {
                        localStorage.setItem("pawpotty_notifs_enabled", "true");
                        PawAPI.showToast("Browser potty alerts enabled! 🐾", "success");
                    } else {
                        e.target.checked = false;
                        localStorage.setItem("pawpotty_notifs_enabled", "false");
                        PawAPI.showToast("Browser notification permission denied.", "warning");
                    }
                }
            } else {
                localStorage.setItem("pawpotty_notifs_enabled", "false");
                PawAPI.showToast("Browser potty alerts disabled.", "info");
            }
        };
    }

    // Test Alert button
    const testAlertBtn = document.getElementById("btnTestAlert");
    if (testAlertBtn) {
        testAlertBtn.onclick = () => {
            PawAPI.showToast("🚨 TEST ALERT: Milo's potty radar reached 91%!", "warning");
            playTestChime();

            if (Notification.permission === "granted" && localStorage.getItem("pawpotty_notifs_enabled") === "true") {
                new Notification("🚨 PawPotty Test Alert!", {
                    body: "This is what a real Potty Alert sounds and looks like. Keep the leash ready! 🐕",
                    icon: "/favicon.ico"
                });
            }
        };
    }

    // Profile save
    const profileForm = document.getElementById("settingsProfileForm");
    if (profileForm) {
        profileForm.onsubmit = (e) => {
            e.preventDefault();
            const newName = document.getElementById("settingsUserName").value.trim();
            const newEmail = document.getElementById("settingsUserEmail").value.trim();
            const user = PawAPI.getUser();
            user.name = newName;
            user.email = newEmail;
            PawAPI.setUser(user);
            PawAuth.updateUserUI();
            PawAPI.showToast("Profile settings saved! 🐾", "success");
        };
    }
}

function playTestChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.25); // G5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.85);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.9);
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", initSettings);
