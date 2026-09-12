// PawPotty API Client & Common Utilities

const API_BASE = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
    ? "" // Same origin when served by FastAPI
    : "http://127.0.0.1:8000";

const PawAPI = {
    getToken() {
        return localStorage.getItem("pawpotty_token") || "demo_pawpotty_token_2026";
    },

    setToken(token) {
        localStorage.setItem("pawpotty_token", token);
    },

    clearToken() {
        localStorage.removeItem("pawpotty_token");
        localStorage.removeItem("pawpotty_user");
    },

    getUser() {
        const u = localStorage.getItem("pawpotty_user");
        return u ? JSON.parse(u) : { id: "user_demo_pawpotty", name: "Alex & Bruno", email: "alex@pawpotty.app" };
    },

    setUser(user) {
        localStorage.setItem("pawpotty_user", JSON.stringify(user));
    },

    getActiveDogId() {
        return localStorage.getItem("pawpotty_active_dog_id") || "dog_luna_demo";
    },

    setActiveDogId(id) {
        localStorage.setItem("pawpotty_active_dog_id", id);
    },

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.getToken()}`,
            ...(options.headers || {})
        };

        try {
            const res = await fetch(url, { ...options, headers });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.message || `Request failed with status ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            console.error(`[PawAPI Error] ${endpoint}:`, err);
            throw err;
        }
    },

    // Dogs API
    async getDogs() {
        return this.request("/api/dogs");
    },

    async getActiveDog() {
        return this.request("/api/dogs/active");
    },

    async getDog(id) {
        return this.request(`/api/dogs/${id}`);
    },

    async createDog(dogData) {
        return this.request("/api/dogs", {
            method: "POST",
            body: JSON.stringify(dogData)
        });
    },

    async updateDog(id, dogData) {
        return this.request(`/api/dogs/${id}`, {
            method: "PUT",
            body: JSON.stringify(dogData)
        });
    },

    async deleteDog(id) {
        return this.request(`/api/dogs/${id}`, {
            method: "DELETE"
        });
    },

    async activateDog(id) {
        return this.request(`/api/dogs/${id}/activate`, {
            method: "POST"
        });
    },

    // Predictions API
    async predict(predictionData) {
        return this.request("/api/predictions", {
            method: "POST",
            body: JSON.stringify(predictionData)
        });
    },

    async getDogPredictions(dogId) {
        return this.request(`/api/predictions/${dogId}`);
    },

    // Potty Events API
    async logPottyEvent(eventData) {
        return this.request("/api/potty-events", {
            method: "POST",
            body: JSON.stringify(eventData)
        });
    },

    async getPottyEvents(dogId) {
        return this.request(`/api/potty-events/${dogId}`);
    },

    async getPottyStats(dogId) {
        return this.request(`/api/potty-events/stats/${dogId}`);
    },

    // Scanner API
    async getScannerCapabilities() {
        return this.request("/api/scanner/capabilities");
    },

    async startScanner(dogId) {
        const query = dogId ? `?dog_id=${encodeURIComponent(dogId)}` : "";
        return this.request(`/api/scanner/start${query}`, { method: "POST" });
    },

    async sendFrame(frameData) {
        return this.request("/api/scanner/frame", {
            method: "POST",
            body: JSON.stringify(frameData)
        });
    },

    // Toast Notification System
    showToast(message, type = "info") {
        let container = document.querySelector(".toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const icons = {
            info: "🐾",
            success: "✅",
            warning: "👀",
            danger: "💩"
        };

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${icons[type] || "🐾"}</span>
            <div>${message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(40px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3600);
    }
};

window.PawAPI = PawAPI;
