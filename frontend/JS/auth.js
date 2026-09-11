const signupBtn =
    document.getElementById(
        "signupBtn"
    );

const loginBtn =
    document.getElementById(
        "loginBtn"
    );

const message =
    document.getElementById(
        "authMessage"
    );


// -----------------------------
// SIGN UP
// -----------------------------

signupBtn.addEventListener(
    "click",
    async () => {

        const email =
            document.getElementById(
                "email"
            ).value.trim();


        const password =
            document.getElementById(
                "password"
            ).value;


        if (!email || !password) {

            message.textContent =
                "Enter email and password.";

            return;
        }


        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .signUp({
                    email,
                    password
                });


        if (error) {

            message.textContent =
                error.message;

            return;
        }


        message.textContent =
            "🎉 Account created! You can now login.";

    }
);


// -----------------------------
// LOGIN
// -----------------------------

loginBtn.addEventListener(
    "click",
    async () => {

        const email =
            document.getElementById(
                "email"
            ).value.trim();


        const password =
            document.getElementById(
                "password"
            ).value;


        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .signInWithPassword({

                    email,

                    password

                });


        if (error) {

            message.textContent =
                error.message;

            return;
        }


        message.textContent =
            "🐾 Login successful!";


        window.location.href =
            "dashboard.html";

    }
);