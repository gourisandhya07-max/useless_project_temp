// PawPotty Authentication Management (Supabase + Local Demo Fallback)

const PawAuth = {
    supabase: null,

    init() {
        // Initialize Supabase if available
        const supabaseUrl = window.PAWPOTTY_SUPABASE_URL || localStorage.getItem("pawpotty_supabase_url");
        const supabaseAnonKey = window.PAWPOTTY_SUPABASE_ANON_KEY || localStorage.getItem("pawpotty_supabase_key");

        if (window.supabase && supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR_")) {
            try {
                this.supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
                // Listen to auth changes
                this.supabase.auth.onAuthStateChange((event, session) => {
                    if (session) {
                        PawAPI.setToken(session.access_token);
                        PawAPI.setUser({
                            id: session.user.id,
                            email: session.user.email,
                            name: session.user.user_metadata?.full_name || session.user.email.split("@")[0]
                        });
                        this.updateUserUI();
                    }
                });
            } catch (e) {
                console.warn("Supabase init error:", e);
            }
        }

        this.updateUserUI();
    },

    updateUserUI() {
        const user = PawAPI.getUser();
        const nameEls = document.querySelectorAll(".user-name");
        const emailEls = document.querySelectorAll(".user-email");
        const tagEls = document.querySelectorAll(".user-tag");

        nameEls.forEach(el => el.textContent = user.name || "Dog Lover");
        emailEls.forEach(el => el.textContent = user.email || "pup@pawpotty.app");
        tagEls.forEach(el => el.textContent = user.email || "Active Pup Parent");
    },

    async signUp(email, password, fullName) {
        if (this.supabase) {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });
            if (error) throw error;
            if (data.session) {
                PawAPI.setToken(data.session.access_token);
                PawAPI.setUser({ id: data.user.id, email: data.user.email, name: fullName });
            }
            return data;
        } else {
            // Local fallback session
            const user = { id: `user_${Date.now()}`, email, name: fullName || email.split("@")[0] };
            PawAPI.setToken(`token_${Date.now()}`);
            PawAPI.setUser(user);
            return { user };
        }
    },

    async signIn(email, password) {
        if (this.supabase) {
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.session) {
                PawAPI.setToken(data.session.access_token);
                PawAPI.setUser({
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata?.full_name || email.split("@")[0]
                });
            }
            return data;
        } else {
            const user = { id: "user_demo_pawpotty", email, name: email.split("@")[0] };
            PawAPI.setToken("demo_pawpotty_token_2026");
            PawAPI.setUser(user);
            return { user };
        }
    },

    async signInDemo() {
        try {
            const res = await PawAPI.request("/api/auth/demo-login", { method: "POST" });
            PawAPI.setToken(res.access_token);
            PawAPI.setUser(res.user);
            PawAPI.showToast("🐾 Logged into Alex & Bruno's pack!", "success");
            return res;
        } catch (e) {
            PawAPI.setToken("demo_pawpotty_token_2026");
            PawAPI.setUser({ id: "user_demo_pawpotty", name: "Alex & Bruno", email: "alex@pawpotty.app" });
            return { success: true };
        }
    },

    async logout() {
        if (this.supabase) {
            await this.supabase.auth.signOut().catch(() => {});
        }
        PawAPI.clearToken();
        PawAPI.showToast("Logged out. See you next potty break! 🐾", "info");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 600);
    }
};

window.PawAuth = PawAuth;
document.addEventListener("DOMContentLoaded", () => PawAuth.init());