let countdownInterval = null;


// -----------------------------
// CURRENT USER
// -----------------------------

async function getUser() {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();

    if (error || !data.user) {

        window.location.href =
            "index.html";

        return null;
    }

    return data.user;
}


// -----------------------------
// LOAD DASHBOARD
// -----------------------------

async function loadDashboard() {

    const user =
        await getUser();

    if (!user) return;


    let dogId =
        localStorage.getItem(
            "selectedDogId"
        );


    const {
        data: dogs,
        error
    } = await supabaseClient
        .from("dogs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
            ascending: true
        });


    if (error || !dogs || !dogs.length) {

        document.getElementById(
            "currentDog"
        ).innerHTML = `

            <h2>
                🐶 No dog profile yet
            </h2>

            <p>
                Add your dog before calculating
                potty time.
            </p>

            <a
                href="dogs.html"
                class="btn primary"
            >
                Add Dog
            </a>
        `;

        return;
    }


    let dog =
        dogs.find(
            item => item.id === dogId
        );


    if (!dog) {

        dog = dogs[0];

        localStorage.setItem(
            "selectedDogId",
            dog.id
        );
    }


    displayDog(dog);

    await loadPottyStats(dog);

}


// -----------------------------
// DISPLAY DOG
// -----------------------------

function displayDog(dog) {

    document.getElementById(
        "currentDog"
    ).innerHTML = `

        <div class="dog-summary-icon">
            🐶
        </div>

        <div>

            <p class="eyebrow">
                CURRENT DOG
            </p>

            <h2>
                ${escapeHtml(dog.name)}
            </h2>

            <p>
                ${dog.breed || "Unknown breed"}
                •
                ${dog.age || "--"} years
                •
                ${dog.weight || "--"} kg
            </p>

        </div>
    `;
}


// -----------------------------
// POTTY STATS
// -----------------------------

async function loadPottyStats(dog) {

    const {
        data: events
    } = await supabaseClient
        .from("potty_events")
        .select("*")
        .eq("dog_id", dog.id)
        .order("potty_time", {
            ascending: false
        });


    const eventList =
        events || [];


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const todayEvents =
        eventList.filter(event => {

            const date =
                new Date(
                    event.potty_time
                );

            return date >= today;
        });


    document.getElementById(
        "todayCount"
    ).textContent =
        todayEvents.length;


    if (dog.last_potty_time) {

        const last =
            new Date(
                dog.last_potty_time
            );

        const diff =
            Date.now() - last.getTime();


        document.getElementById(
            "lastPotty"
        ).textContent =
            formatDuration(diff);

    } else {

        document.getElementById(
            "lastPotty"
        ).textContent =
            "Not recorded";
    }


    // Default status

    document.getElementById(
        "probability"
    ).textContent =
        "--";

    document.getElementById(
        "estimatedTime"
    ).textContent =
        "--";

    document.getElementById(
        "timeRemaining"
    ).textContent =
        "--";

    document.getElementById(
        "aiStatus"
    ).textContent =
        "Ready 🟢";
}


// -----------------------------
// HELPERS
// -----------------------------

function formatDuration(milliseconds) {

    const minutes =
        Math.floor(
            milliseconds / 60000
        );


    if (minutes < 60) {

        return `${minutes}m ago`;
    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const remaining =
        minutes % 60;


    return `${hours}h ${remaining}m ago`;
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// -----------------------------
// LOGOUT
// -----------------------------

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        async () => {

            await supabaseClient.auth.signOut();

            localStorage.clear();

            window.location.href =
                "index.html";
        }
    );


loadDashboard();