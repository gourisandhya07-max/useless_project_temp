let currentDog = null;

let chart = null;


// -----------------------------
// LOAD USER
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
// LOAD DATA
// -----------------------------

async function loadHistory() {

    const user =
        await getUser();

    if (!user) return;


    const dogId =
        localStorage.getItem(
            "selectedDogId"
        );


    if (!dogId) {

        alert(
            "Select a dog first."
        );

        window.location.href =
            "dogs.html";

        return;
    }


    const {
        data: dog
    } = await supabaseClient
        .from("dogs")
        .select("*")
        .eq("id", dogId)
        .single();


    currentDog = dog;


    const {
        data: events,
        error
    } = await supabaseClient
        .from("potty_events")
        .select("*")
        .eq("dog_id", dogId)
        .order("potty_time", {
            ascending: false
        });


    if (error) {

        console.error(error);

        return;
    }


    const eventList =
        events || [];


    updateStats(
        eventList
    );


    renderTable(
        eventList
    );


    renderChart(
        eventList
    );
}


// -----------------------------
// STATS
// -----------------------------

function updateStats(
    events
) {

    document.getElementById(
        "totalEvents"
    ).textContent =
        events.length;


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const todayEvents =
        events.filter(event =>
            new Date(
                event.potty_time
            ) >= today
        );


    document.getElementById(
        "todayEvents"
    ).textContent =
        todayEvents.length;


    if (events.length < 2) {

        document.getElementById(
            "averageInterval"
        ).textContent =
            "--";

    } else {

        const sorted =
            [...events].sort(
                (a, b) =>
                    new Date(a.potty_time) -
                    new Date(b.potty_time)
            );


        let totalDifference = 0;


        for (
            let i = 1;
            i < sorted.length;
            i++
        ) {

            totalDifference +=
                new Date(
                    sorted[i].potty_time
                ) -
                new Date(
                    sorted[i - 1].potty_time
                );
        }


        const average =
            totalDifference /
            (sorted.length - 1);


        const hours =
            average /
            (1000 * 60 * 60);


        document.getElementById(
            "averageInterval"
        ).textContent =
            `${hours.toFixed(1)}h`;
    }


    // Accuracy is calculated from
    // predictions stored in Supabase.
    loadAccuracy();
}


// -----------------------------
// ACCURACY
// -----------------------------

async function loadAccuracy() {

    if (!currentDog) return;


    const {
        data: predictions
    } =
        await supabaseClient
            .from("predictions")
            .select("*")
            .eq(
                "dog_id",
                currentDog.id
            );


    if (
        !predictions ||
        !predictions.length
    ) {

        document.getElementById(
            "accuracy"
        ).textContent =
            "--";

        return;
    }


    // Simple demo accuracy metric.
    // It can be improved later by matching
    // predicted_time with actual potty_time.

    document.getElementById(
        "accuracy"
    ).textContent =
        "Learning";
}


// -----------------------------
// TABLE
// -----------------------------

function renderTable(
    events
) {

    const table =
        document.getElementById(
            "historyTable"
        );


    if (!events.length) {

        table.innerHTML = `
            <tr>
                <td colspan="4">
                    No potty events yet 💩
                </td>
            </tr>
        `;

        return;
    }


    table.innerHTML =
        events
            .slice(0, 20)
            .map(event => {

                const date =
                    new Date(
                        event.potty_time
                    );


                return `

                    <tr>

                        <td>
                            ${date.toLocaleDateString()}
                        </td>

                        <td>
                            ${date.toLocaleTimeString(
                                [],
                                {
                                    hour: "numeric",
                                    minute: "2-digit"
                                }
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                event.food ||
                                "--"
                            )}
                        </td>

                        <td>
                            ${event.activity_level || "--"}
                        </td>

                    </tr>

                `;

            })
            .join("");
}


// -----------------------------
// CHART
// -----------------------------

function renderChart(
    events
) {

    const canvas =
        document.getElementById(
            "pottyChart"
        );


    const grouped = {};


    events.forEach(event => {

        const date =
            new Date(
                event.potty_time
            )
            .toLocaleDateString();


        grouped[date] =
            (grouped[date] || 0) + 1;

    });


    const labels =
        Object.keys(grouped)
            .reverse();


    const values =
        labels.map(
            date => grouped[date]
        );


    if (chart) {

        chart.destroy();
    }


    chart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels,

                    datasets: [
                        {
                            label:
                                "Potty Events",

                            data: values
                        }
                    ]
                },

                options: {

                    responsive: true,

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );
}


// -----------------------------
// RECORD EVENT
// -----------------------------

document
    .getElementById("eventForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (!currentDog) {

                alert(
                    "No dog selected."
                );

                return;
            }


            const pottyTime =
                document
                    .getElementById(
                        "pottyTime"
                    )
                    .value;


            const record = {

                dog_id:
                    currentDog.id,

                potty_time:
                    new Date(
                        pottyTime
                    ).toISOString(),

                food:
                    document
                        .getElementById(
                            "eventFood"
                        )
                        .value,

                water:
                    Number(
                        document
                            .getElementById(
                                "eventWater"
                            )
                            .value
                    ) || 0,

                activity_level:
                    document
                        .getElementById(
                            "eventActivity"
                        )
                        .value,

                notes:
                    document
                        .getElementById(
                            "eventNotes"
                        )
                        .value
            };


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "potty_events"
                    )
                    .insert(record);


            if (error) {

                alert(
                    "Could not save event."
                );

                console.error(error);

                return;
            }


            // Also update dog's last potty time

            await supabaseClient
                .from("dogs")
                .update({
                    last_potty_time:
                        record.potty_time
                })
                .eq(
                    "id",
                    currentDog.id
                );


            alert(
                "💩 Potty event recorded!"
            );


            document
                .getElementById(
                    "eventForm"
                )
                .reset();


            loadHistory();

        }
    );


// -----------------------------
// LOGOUT
// -----------------------------

document
    .getElementById(
        "logoutBtn"
    )
    .addEventListener(
        "click",
        async () => {

            await supabaseClient
                .auth
                .signOut();

            localStorage.clear();

            window.location.href =
                "index.html";
        }
    );


// -----------------------------
// ESCAPE HTML
// -----------------------------

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


loadHistory();