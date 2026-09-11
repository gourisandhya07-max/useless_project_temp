const form =
    document.getElementById(
        "predictionForm"
    );


let countdownTimer = null;


form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const button =
            form.querySelector(
                "button"
            );


        button.disabled = true;

        button.textContent =
            "🧠 THINKING...";


        try {

            const data = {

                dog_name:
                    document
                        .getElementById(
                            "dogName"
                        )
                        .value,

                age:
                    Number(
                        document
                            .getElementById(
                                "age"
                            )
                            .value
                    ) || null,

                weight:
                    Number(
                        document
                            .getElementById(
                                "weight"
                            )
                            .value
                    ) || null,

                food:
                    document
                        .getElementById(
                            "food"
                        )
                        .value,

                water:
                    Number(
                        document
                            .getElementById(
                                "water"
                            )
                            .value
                    ) || 0,

                activity_level:
                    document
                        .getElementById(
                            "activity"
                        )
                        .value,

                mood:
                    document
                        .getElementById(
                            "mood"
                        )
                        .value,

                last_potty_time:
                    document
                        .getElementById(
                            "lastPotty"
                        )
                        .value || null,

                vision: null
            };


            // -------------------------
            // CALL FASTAPI
            // -------------------------

            const result =
                await apiRequest(
                    "/api/predictions/calculate",
                    {
                        method: "POST",

                        body:
                            JSON.stringify(
                                data
                            )
                    }
                );


            displayPrediction(
                result
            );


            // Save to Supabase
            await savePrediction(
                result
            );


            // Alert
            if (
                result.probability >= 85
            ) {

                showPottyAlert(
                    result
                );
            }


        } catch (error) {

            console.error(error);

            alert(
                "❌ Something went wrong. " +
                error.message
            );

        } finally {

            button.disabled = false;

            button.textContent =
                "💩 CALCULATE POTTY TIME";
        }

    }
);


// -----------------------------
// DISPLAY RESULT
// -----------------------------

function displayPrediction(
    result
) {

    document.getElementById(
        "result"
    ).classList.add("show");


    document.getElementById(
        "probability"
    ).textContent =
        `${result.probability}%`;


    const estimated =
        new Date(
            result.predicted_time
        );


    document.getElementById(
        "estimatedTime"
    ).textContent =
        estimated.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );


    document.getElementById(
        "confidence"
    ).textContent =
        `${result.confidence}%`;


    document.getElementById(
        "action"
    ).textContent =
        result.recommended_action;


    document.getElementById(
        "explanation"
    ).textContent =
        result.explanation;


    const factors =
        document.getElementById(
            "factors"
        );


    factors.innerHTML =
        "";


    if (
        result.factors &&
        result.factors.length
    ) {

        result.factors.forEach(
            factor => {

                const div =
                    document.createElement(
                        "div"
                    );

                div.className =
                    "factor";

                div.textContent =
                    `🐾 ${factor}`;

                factors.appendChild(
                    div
                );
            }
        );

    } else {

        factors.innerHTML =
            `<div class="factor">
                No major factors detected.
             </div>`;
    }


    startCountdown(
        estimated
    );
}


// -----------------------------
// COUNTDOWN
// -----------------------------

function startCountdown(
    targetTime
) {

    if (countdownTimer) {

        clearInterval(
            countdownTimer
        );
    }


    function update() {

        const difference =
            targetTime.getTime() -
            Date.now();


        if (difference <= 0) {

            document.getElementById(
                "countdown"
            ).textContent =
                "💩 It may be potty time!";

            clearInterval(
                countdownTimer
            );

            return;
        }


        const minutes =
            Math.floor(
                difference / 60000
            );


        const seconds =
            Math.floor(
                (difference % 60000) /
                1000
            );


        document.getElementById(
            "countdown"
        ).textContent =
            `⏳ ${minutes}m ${seconds}s remaining`;
    }


    update();

    countdownTimer =
        setInterval(
            update,
            1000
        );
}


// -----------------------------
// SAVE PREDICTION
// -----------------------------

async function savePrediction(
    result
) {

    // Supabase is optional here.
    // If the user hasn't configured it,
    // the calculator still works.

    if (
        typeof supabaseClient ===
        "undefined"
    ) {

        return;
    }


    const {
        data: userData
    } =
        await supabaseClient.auth
            .getUser();


    const user =
        userData?.user;


    if (!user) return;


    const dogId =
        localStorage.getItem(
            "selectedDogId"
        );


    if (!dogId) return;


    await supabaseClient
        .from("predictions")
        .insert({

            dog_id: dogId,

            predicted_time:
                result.predicted_time,

            probability:
                result.probability,

            confidence:
                result.confidence,

            posture_signal:
                result.posture_signal ||
                "Unavailable",

            facial_signal:
                result.facial_signal ||
                "Experimental",

            movement_signal:
                result.movement_signal ||
                "Unavailable",

            explanation:
                result.explanation

        });
}


// -----------------------------
// POTTY ALERT
// -----------------------------

function showPottyAlert(
    result
) {

    let alertBox =
        document.getElementById(
            "pottyAlert"
        );


    if (!alertBox) {

        alertBox =
            document.createElement(
                "div"
            );

        alertBox.id =
            "pottyAlert";

        alertBox.className =
            "alert";

        alertBox.innerHTML = `

            <button
                class="alert-close"
                onclick="
                    this.parentElement
                        .classList
                        .remove('show')
                "
            >
                ×
            </button>

            <h2>
                🚨 POTTY ALERT!
            </h2>

            <p>
                Your dog may need to
                go soon!
            </p>

            <strong
                id="alertProbability"
            >
            </strong>

            <p>
                Get ready! 🐕💨
            </p>

            <button
                class="btn secondary"
                onclick="
                    this.parentElement
                        .classList
                        .remove('show')
                "
            >
                Dismiss Alert
            </button>
        `;


        document.body.appendChild(
            alertBox
        );
    }


    document.getElementById(
        "alertProbability"
    ).textContent =
        `Potty probability: ${result.probability}%`;


    alertBox.classList.add(
        "show"
    );


    playAlarm();
}


// -----------------------------
// SOUND
// -----------------------------

function playAlarm() {

    try {

        const audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();


        const oscillator =
            audioContext
                .createOscillator();


        const gain =
            audioContext
                .createGain();


        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );


        oscillator.frequency.value =
            700;

        gain.gain.value =
            0.08;


        oscillator.start();


        setTimeout(
            () => {

                oscillator.stop();

                audioContext.close();

            },
            500
        );

    } catch (error) {

        console.log(
            "Alarm unavailable"
        );
    }
}