// PawPotty Calculator Controller

let selectedDog = null;

async function initCalculator() {
    await populateDogSelector();
    setupCalculatorForm();
}

async function populateDogSelector() {
    const selector = document.getElementById("calcDogSelect");
    if (!selector) return;

    try {
        const dogs = await PawAPI.getDogs();
        if (dogs.length > 0) {
            selector.innerHTML = dogs.map(d => `
                <option value="${d.id}" data-dog='${JSON.stringify(d)}'>
                    🐶 ${d.name} (${d.breed || 'Pup'})
                </option>
            `).join("");

            // Pre-fill fields with selected dog
            selector.onchange = () => fillDogData(JSON.parse(selector.selectedOptions[0].dataset.dog));
            fillDogData(dogs[0]);
        }
    } catch (e) {
        console.warn("Could not load dogs into calculator:", e);
    }
}

function fillDogData(dog) {
    selectedDog = dog;
    if (!dog) return;

    const ageInput = document.getElementById("calcAge");
    const weightInput = document.getElementById("calcWeight");
    const foodInput = document.getElementById("calcFood");
    const waterSelect = document.getElementById("calcWater");
    const activitySelect = document.getElementById("calcActivity");
    const moodSelect = document.getElementById("calcMood");
    const lastPottyInput = document.getElementById("calcLastPotty");

    if (ageInput) ageInput.value = dog.age || 2.5;
    if (weightInput) weightInput.value = dog.weight || 22.0;
    if (foodInput) foodInput.value = dog.food || "Kibble & Fresh Chicken";
    if (waterSelect) waterSelect.value = dog.water_consumption || "High";
    if (activitySelect) activitySelect.value = dog.activity_level || "High";
    if (moodSelect) moodSelect.value = dog.current_mood || "Suspicious 😂";

    if (lastPottyInput && dog.last_potty_time) {
        try {
            const dt = new Date(dog.last_potty_time);
            // Format for datetime-local input
            const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            lastPottyInput.value = localIso;
        } catch (e) {}
    }
}

function setupCalculatorForm() {
    const form = document.getElementById("pottyCalculatorForm");
    const calcBtn = document.getElementById("btnCalculatePotty");
    const resultSection = document.getElementById("calculatorResultSection");

    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();

        // Animated button state
        const origBtnText = calcBtn.innerHTML;
        calcBtn.innerHTML = `<span>🐾</span> Sniffing the data...`;
        calcBtn.disabled = true;

        const payload = {
            dog_id: selectedDog?.id,
            dog_name: selectedDog?.name || "Your pup",
            age: parseFloat(document.getElementById("calcAge").value) || 2.5,
            weight: parseFloat(document.getElementById("calcWeight").value) || 20.0,
            food: document.getElementById("calcFood").value,
            water: document.getElementById("calcWater").value,
            activity_level: document.getElementById("calcActivity").value,
            mood: document.getElementById("calcMood").value,
            last_potty_time: document.getElementById("calcLastPotty").value ? new Date(document.getElementById("calcLastPotty").value).toISOString() : null
        };

        try {
            const res = await PawAPI.predict(payload);
            renderCalculationResult(res, payload);
            if (resultSection) {
                resultSection.style.display = "block";
                resultSection.scrollIntoView({ behavior: "smooth" });
            }
        } catch (err) {
            PawAPI.showToast("Our poop detective got distracted. Try again.", "danger");
        } finally {
            calcBtn.innerHTML = origBtnText;
            calcBtn.disabled = false;
        }
    };
}

function renderCalculationResult(res, inputs) {
    const probEl = document.getElementById("resProbability");
    const statusEl = document.getElementById("resStatusDesc");
    const estTimeEl = document.getElementById("resEstimatedTime");
    const minsEl = document.getElementById("resMinutesRemaining");
    const confEl = document.getElementById("resConfidence");
    const takeEl = document.getElementById("resPawPottyTake");
    const actionEl = document.getElementById("resRecommendedAction");
    const factorsGrid = document.getElementById("resFactorsGrid");

    if (probEl) probEl.textContent = `${res.probability}%`;

    if (statusEl) {
        if (res.probability >= 85) statusEl.textContent = "Pretty suspicious. 👀";
        else if (res.probability >= 65) statusEl.textContent = "Getting warmed up. 🐾";
        else statusEl.textContent = "Looking relaxed and chill. 🛋️";
    }

    if (estTimeEl && res.predicted_time) {
        const timeStr = new Date(res.predicted_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        estTimeEl.textContent = timeStr;
    }

    if (minsEl) minsEl.textContent = `~${res.minutes_until} minutes`;
    if (confEl) confEl.textContent = `${res.confidence}%`;
    if (takeEl) takeEl.textContent = `"${res.explanation}"`;
    if (actionEl) actionEl.textContent = res.recommended_action;

    // Render Factor Cards
    if (factorsGrid) {
        const hrsGap = res.hours_since_potty ? `${res.hours_since_potty.toFixed(1)}h` : "3.5h";
        factorsGrid.innerHTML = `
            <div class="factor-card">
                <div class="factor-card-icon">💧</div>
                <div class="factor-card-title">Water</div>
                <div class="factor-card-value">${inputs.water}</div>
            </div>
            <div class="factor-card">
                <div class="factor-card-icon">🏃</div>
                <div class="factor-card-title">Activity</div>
                <div class="factor-card-value">${inputs.activity_level}</div>
            </div>
            <div class="factor-card">
                <div class="factor-card-icon">⏰</div>
                <div class="factor-card-title">Potty Gap</div>
                <div class="factor-card-value">${hrsGap}</div>
            </div>
            <div class="factor-card">
                <div class="factor-card-icon">😏</div>
                <div class="factor-card-title">Mood</div>
                <div class="factor-card-value">${inputs.mood}</div>
            </div>
            <div class="factor-card">
                <div class="factor-card-icon">🐾</div>
                <div class="factor-card-title">Confidence</div>
                <div class="factor-card-value">${res.confidence}%</div>
            </div>
        `;
    }

    // Direct Record Break Button
    const logBtn = document.getElementById("btnRecordFromCalc");
    if (logBtn && selectedDog) {
        logBtn.onclick = async () => {
            try {
                await PawAPI.logPottyEvent({
                    dog_id: selectedDog.id,
                    food: inputs.food,
                    water: inputs.water,
                    activity_level: inputs.activity_level,
                    notes: `Predicted ${res.probability}% at ${new Date(res.predicted_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                });
                PawAPI.showToast("Case closed! Actual potty break recorded. 💩", "success");
            } catch (e) {
                PawAPI.showToast("Could not record potty break", "danger");
            }
        };
    }
}

document.addEventListener("DOMContentLoaded", initCalculator);