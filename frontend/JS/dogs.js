// PawPotty Dog Profiles Controller

let dogsList = [];

async function initDogs() {
    await loadDogsList();
    setupDogForm();
}

async function loadDogsList() {
    const container = document.getElementById("dogsGrid");
    if (!container) return;

    try {
        dogsList = await PawAPI.getDogs();
        if (dogsList.length === 0) {
            container.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align: center; padding: 48px 20px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">🐶</div>
                    <h3>No pups registered yet</h3>
                    <p style="margin: 8px 0 20px 0;">Add your furry companion to start tracking their potty radar!</p>
                    <button class="btn btn-primary" onclick="openDogModal()">Add Your Pup 🐾</button>
                </div>
            `;
            return;
        }

        container.innerHTML = dogsList.map(dog => renderDogCard(dog)).join("");
    } catch (e) {
        console.error("Could not load dogs:", e);
        container.innerHTML = `<p>Our poop detective had a hiccup loading the pack.</p>`;
    }
}

function renderDogCard(dog) {
    const avatarEmoji = dog.gender === "Female" ? "🎀 🐶" : "🐾 🐶";
    const activeBadge = dog.is_active 
        ? `<span class="badge badge-success"><span class="dot dot-green"></span> Active Pup</span>` 
        : `<button class="btn btn-sm btn-secondary" onclick="setActiveDog('${dog.id}')">Set Active</button>`;

    return `
        <div class="card dog-profile-card">
            <div class="card-header">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div class="user-avatar" style="width: 48px; height: 48px; font-size: 24px;">
                        🐶
                    </div>
                    <div>
                        <h3 style="font-size: 18px;">${dog.name}</h3>
                        <p class="text-sm">${dog.breed || 'Dog'} • ${dog.age} yrs • ${dog.weight} lbs</p>
                    </div>
                </div>
                <div>${activeBadge}</div>
            </div>

            <div class="factor-cards-grid" style="grid-template-columns: repeat(3, 1fr); margin: 16px 0;">
                <div class="factor-card" style="padding: 10px;">
                    <div class="factor-card-title">Activity</div>
                    <div class="factor-card-value" style="font-size: 13px;">${dog.activity_level || 'Moderate'}</div>
                </div>
                <div class="factor-card" style="padding: 10px;">
                    <div class="factor-card-title">Water</div>
                    <div class="factor-card-value" style="font-size: 13px;">${dog.water_consumption || 'Moderate'}</div>
                </div>
                <div class="factor-card" style="padding: 10px;">
                    <div class="factor-card-title">Mood</div>
                    <div class="factor-card-value" style="font-size: 13px;">${dog.current_mood || 'Calm'}</div>
                </div>
            </div>

            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
                <strong>Diet:</strong> ${dog.food || 'Standard Kibble'}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                <button class="btn btn-sm btn-secondary" onclick="editDog('${dog.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteDog('${dog.id}', '${dog.name}')">🗑️ Remove</button>
            </div>
        </div>
    `;
}

function openDogModal(dog = null) {
    const modal = document.getElementById("dogModal");
    const form = document.getElementById("dogForm");
    const title = document.getElementById("dogModalTitle");

    form.reset();
    document.getElementById("dogEditId").value = "";

    if (dog) {
        title.textContent = `Edit ${dog.name}'s Profile 🐶`;
        document.getElementById("dogEditId").value = dog.id;
        document.getElementById("dogName").value = dog.name;
        document.getElementById("dogAge").value = dog.age;
        document.getElementById("dogWeight").value = dog.weight;
        document.getElementById("dogBreed").value = dog.breed;
        document.getElementById("dogGender").value = dog.gender;
        document.getElementById("dogFood").value = dog.food;
        document.getElementById("dogWater").value = dog.water_consumption;
        document.getElementById("dogActivity").value = dog.activity_level;
        document.getElementById("dogMood").value = dog.current_mood;
    } else {
        title.textContent = "Add a New Pup 🐾";
    }

    modal.style.display = "flex";
}

function closeDogModal() {
    const modal = document.getElementById("dogModal");
    if (modal) modal.style.display = "none";
}

function setupDogForm() {
    const form = document.getElementById("dogForm");
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const editId = document.getElementById("dogEditId").value;
        const payload = {
            name: document.getElementById("dogName").value.trim(),
            age: parseFloat(document.getElementById("dogAge").value) || 2.0,
            weight: parseFloat(document.getElementById("dogWeight").value) || 20.0,
            breed: document.getElementById("dogBreed").value.trim() || "Mixed Breed",
            gender: document.getElementById("dogGender").value,
            food: document.getElementById("dogFood").value.trim() || "Standard Kibble",
            water_consumption: document.getElementById("dogWater").value,
            activity_level: document.getElementById("dogActivity").value,
            current_mood: document.getElementById("dogMood").value
        };

        try {
            if (editId) {
                await PawAPI.updateDog(editId, payload);
                PawAPI.showToast(`Updated ${payload.name}'s profile! 🐾`, "success");
            } else {
                await PawAPI.createDog(payload);
                PawAPI.showToast(`Welcome to the pack, ${payload.name}! 🐶`, "success");
            }
            closeDogModal();
            await loadDogsList();
        } catch (err) {
            PawAPI.showToast("Could not save dog profile.", "danger");
        }
    };
}

async function setActiveDog(id) {
    try {
        await PawAPI.activateDog(id);
        PawAPI.setActiveDogId(id);
        PawAPI.showToast("Active pup updated! 🐾", "success");
        await loadDogsList();
    } catch (e) {
        PawAPI.showToast("Could not update active dog", "danger");
    }
}

function editDog(id) {
    const dog = dogsList.find(d => d.id === id);
    if (dog) openDogModal(dog);
}

async function deleteDog(id, name) {
    if (!confirm(`Are you sure you want to remove ${name}'s profile?`)) return;
    try {
        await PawAPI.deleteDog(id);
        PawAPI.showToast(`${name}'s profile removed.`, "info");
        await loadDogsList();
    } catch (e) {
        PawAPI.showToast("Could not remove dog profile", "danger");
    }
}

document.addEventListener("DOMContentLoaded", initDogs);