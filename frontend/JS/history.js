// PawPotty History & Analytics Controller (Chart.js Integration)

let activeDogId = null;
let distributionChart = null;
let accuracyChart = null;

async function initHistory() {
    activeDogId = PawAPI.getActiveDogId();
    await loadHistoryStats();
    setupLogEventModal();
}

async function loadHistoryStats() {
    if (!activeDogId) return;

    try {
        const stats = await PawAPI.getPottyStats(activeDogId);
        renderStatsCards(stats);
        renderHistoryTable(stats.history_table || []);
        renderCharts(stats);
    } catch (e) {
        console.error("Could not load potty stats:", e);
    }
}

function renderStatsCards(stats) {
    const totalEl = document.getElementById("statTotalEvents");
    const intervalEl = document.getElementById("statAvgInterval");
    const accuracyEl = document.getElementById("statAvgAccuracy");
    const commonEl = document.getElementById("statCommonTime");
    const todayEl = document.getElementById("statTodayCount");

    if (totalEl) totalEl.textContent = stats.total_events;
    if (intervalEl) intervalEl.textContent = `${stats.average_interval_hours}h`;
    if (accuracyEl) accuracyEl.textContent = `${stats.average_accuracy}%`;
    if (commonEl) commonEl.textContent = stats.most_common_time;
    if (todayEl) todayEl.textContent = stats.today_count;
}

function renderHistoryTable(records) {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    🐾 No potty stories yet. This chapter is still blank!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = records.map(r => `
        <tr>
            <td><strong>${r.date}</strong></td>
            <td>${r.predicted}</td>
            <td><strong>${r.actual}</strong></td>
            <td>${r.difference}</td>
            <td><span class="badge badge-success">${r.accuracy}</span></td>
            <td style="color: var(--text-muted); font-size: 13px;">${r.notes}</td>
        </tr>
    `).join("");
}

function renderCharts(stats) {
    if (typeof Chart === "undefined") return;

    // 1. Hourly Distribution Chart
    const distCanvas = document.getElementById("chartDistribution");
    if (distCanvas && stats.hourly_distribution) {
        if (distributionChart) distributionChart.destroy();

        const labels = Array.from({ length: 24 }, (_, i) => {
            const ampm = i < 12 ? "AM" : "PM";
            const h = i % 12 === 0 ? 12 : i % 12;
            return `${h}${ampm}`;
        });

        distributionChart = new Chart(distCanvas, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Potty Breaks",
                    data: stats.hourly_distribution,
                    backgroundColor: "#6FAF72",
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    // 2. Accuracy Gauge / Trend Chart
    const accCanvas = document.getElementById("chartAccuracy");
    if (accCanvas && stats.history_table) {
        if (accuracyChart) accuracyChart.destroy();

        const recentAcc = stats.history_table.slice(-7).map(r => parseInt(r.accuracy, 10));
        const recentLabels = stats.history_table.slice(-7).map(r => r.date.split(",")[0]);

        accuracyChart = new Chart(accCanvas, {
            type: "line",
            data: {
                labels: recentLabels,
                datasets: [{
                    label: "Accuracy %",
                    data: recentAcc,
                    borderColor: "#F2B84B",
                    backgroundColor: "rgba(242, 184, 75, 0.15)",
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: "#F2B84B"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { min: 50, max: 100 }
                }
            }
        });
    }
}

function setupLogEventModal() {
    const modal = document.getElementById("logPottyModal");
    const form = document.getElementById("logPottyForm");
    const timeInput = document.getElementById("logPottyTime");

    if (timeInput) {
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        timeInput.value = localIso;
    }

    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            dog_id: activeDogId,
            potty_time: timeInput.value ? new Date(timeInput.value).toISOString() : new Date().toISOString(),
            food: document.getElementById("logPottyFood")?.value || "Standard Kibble",
            water: document.getElementById("logPottyWater")?.value || "Moderate",
            activity_level: document.getElementById("logPottyActivity")?.value || "Moderate",
            notes: document.getElementById("logPottyNotes")?.value || "Routine potty break"
        };

        try {
            await PawAPI.logPottyEvent(payload);
            PawAPI.showToast("Case closed! Potty break recorded. 💩", "success");
            closeLogModal();
            await loadHistoryStats();
        } catch (err) {
            PawAPI.showToast("Could not record potty event", "danger");
        }
    };
}

function openLogModal() {
    const modal = document.getElementById("logPottyModal");
    if (modal) modal.style.display = "flex";
}

function closeLogModal() {
    const modal = document.getElementById("logPottyModal");
    if (modal) modal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", initHistory);