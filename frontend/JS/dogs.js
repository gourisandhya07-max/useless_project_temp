const dogForm =
    document.getElementById("dogForm");

const dogList =
    document.getElementById("dogList");


// -----------------------------
// GET CURRENT USER
// -----------------------------

async function getCurrentUser() {

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
// LOAD DOGS
// -----------------------------

async function loadDogs() {

    const user =
        await getCurrentUser();

    if (!user) return;


    const {
        data,
        error
    } = await supabaseClient
        .from("dogs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(error);

        dogList.innerHTML = `
            <div class="card">
                ❌ Could not load dogs.
            </div>
        `;

        return;
    }


    if (!data.length) {

        dogList.innerHTML = `
            <div class="card empty-state">

                <div class="empty-icon">
                    🐶
                </div>

                <h3>
                    No dogs yet
                </h3>

                <p>
                    Add your first suspicious
                    little creature above.
                </p>

            </div>
        `;

        return;
    }


    dogList.innerHTML =
        data.map(dog => `

            <div class="dog-card">

                <div class="dog-card-icon">
                    🐶
                </div>

                <h3>
                    ${escapeHtml(dog.name)}
                </h3>

                <p>
                    ${dog.breed || "Breed unknown"}
                </p>

                <div class="dog-details">

                    <span>
                        🎂 ${dog.age || "--"} yrs
                    </span>

                    <span>
                        ⚖️ ${dog.weight || "--"} kg
                    </span>

                    <span>
                        🏃 ${dog.activity_level}
                    </span>

                </div>


                <div class="dog-actions">

                    <button
                        class="btn primary"
                        onclick="selectDog('${dog.id}')"
                    >
                        Select
                    </button>

                    <button
                        class="btn danger"
                        onclick="deleteDog('${dog.id}')"
                    >
                        Delete
                    </button>

                </div>

            </div>

        `).join("");
}


// -----------------------------
// ADD DOG
// -----------------------------

dogForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const user =
            await getCurrentUser();

        if (!user) return;


        const dog = {

            user_id: user.id,

            name:
                document
                    .getElementById("dogName")
                    .value
                    .trim(),

            age:
                Number(
                    document
                        .getElementById("dogAge")
                        .value
                ) || null,

            weight:
                Number(
                    document
                        .getElementById("dogWeight")
                        .value
                ) || null,

            breed:
                document
                    .getElementById("dogBreed")
                    .value
                    .trim(),

            gender:
                document
                    .getElementById("dogGender")
                    .value,

            food:
                document
                    .getElementById("dogFood")
                    .value
                    .trim(),

            water_consumption:
                Number(
                    document
                        .getElementById("dogWater")
                        .value
                ) || 0,

            activity_level:
                document
                    .getElementById("dogActivity")
                    .value,

            current_mood:
                document
                    .getElementById("dogMood")
                    .value,

            last_potty_time:
                document
                    .getElementById("dogLastPotty")
                    .value || null
        };


        const {
            error
        } = await supabaseClient
            .from("dogs")
            .insert(dog);


        if (error) {

            alert(
                "Could not save dog: " +
                error.message
            );

            return;
        }


        dogForm.reset();

        alert(
            "🐶 Dog saved successfully!"
        );

        loadDogs();

    }
);


// -----------------------------
// SELECT DOG
// -----------------------------

async function selectDog(dogId) {

    localStorage.setItem(
        "selectedDogId",
        dogId
    );

    alert(
        "🐾 Dog selected!"
    );

    window.location.href =
        "dashboard.html";
}


// -----------------------------
// DELETE DOG
// -----------------------------

async function deleteDog(dogId) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this dog?"
        );

    if (!confirmed) return;


    const {
        error
    } = await supabaseClient
        .from("dogs")
        .delete()
        .eq("id", dogId);


    if (error) {

        alert(
            "Could not delete dog."
        );

        console.error(error);

        return;
    }


    if (
        localStorage.getItem(
            "selectedDogId"
        ) === dogId
    ) {

        localStorage.removeItem(
            "selectedDogId"
        );
    }


    loadDogs();
}


// -----------------------------
// BASIC HTML ESCAPE
// -----------------------------

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

const logoutBtn =
    document.getElementById("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            await supabaseClient.auth.signOut();

            localStorage.clear();

            window.location.href =
                "index.html";

        }
    );
}


loadDogs();