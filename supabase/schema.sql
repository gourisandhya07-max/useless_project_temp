-- PawPotty Supabase PostgreSQL Schema
-- Tables, Foreign Keys, Indexes, Row Level Security (RLS) & Seed Data

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DOGS TABLE
CREATE TABLE IF NOT EXISTS public.dogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age NUMERIC(4, 1) DEFAULT 2.0,
    weight NUMERIC(5, 1) DEFAULT 20.0,
    breed TEXT DEFAULT 'Mixed Breed',
    gender TEXT DEFAULT 'Unknown',
    food TEXT DEFAULT 'Standard Kibble',
    water_consumption TEXT DEFAULT 'Moderate', -- Low, Moderate, High
    activity_level TEXT DEFAULT 'Moderate',    -- Low, Moderate, High
    current_mood TEXT DEFAULT 'Calm',         -- Calm, Happy, Excited, Restless, Sleepy, Suspicious 😂
    last_potty_time TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POTTY EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.potty_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
    potty_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    food TEXT,
    water TEXT,
    activity_level TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
    predicted_time TIMESTAMPTZ NOT NULL,
    probability INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    posture_signal TEXT,
    facial_signal TEXT,
    movement_signal NUMERIC(4, 2),
    restlessness NUMERIC(4, 2),
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SCANNER SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.scanner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id UUID REFERENCES public.dogs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    detection_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_dogs_user_id ON public.dogs(user_id);
CREATE INDEX IF NOT EXISTS idx_potty_events_dog_id ON public.potty_events(dog_id);
CREATE INDEX IF NOT EXISTS idx_predictions_dog_id ON public.predictions(dog_id);
CREATE INDEX IF NOT EXISTS idx_scanner_sessions_dog_id ON public.scanner_sessions(dog_id);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanner_sessions ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Dogs: Users can manage their own dogs
CREATE POLICY "Users can view their own dogs"
    ON public.dogs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dogs"
    ON public.dogs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dogs"
    ON public.dogs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dogs"
    ON public.dogs FOR DELETE
    USING (auth.uid() = user_id);

-- Potty Events: Users can view & manage events for dogs they own
CREATE POLICY "Users can view potty events for their dogs"
    ON public.potty_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = potty_events.dog_id AND dogs.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert potty events for their dogs"
    ON public.potty_events FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = potty_events.dog_id AND dogs.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete potty events for their dogs"
    ON public.potty_events FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = potty_events.dog_id AND dogs.user_id = auth.uid()
    ));

-- Predictions: Users can view & save predictions for their dogs
CREATE POLICY "Users can view predictions for their dogs"
    ON public.predictions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = predictions.dog_id AND dogs.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert predictions for their dogs"
    ON public.predictions FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = predictions.dog_id AND dogs.user_id = auth.uid()
    ));

-- Scanner Sessions
CREATE POLICY "Users can view scanner sessions for their dogs"
    ON public.scanner_sessions FOR SELECT
    USING (dog_id IS NULL OR EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = scanner_sessions.dog_id AND dogs.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert scanner sessions for their dogs"
    ON public.scanner_sessions FOR INSERT
    WITH CHECK (dog_id IS NULL OR EXISTS (
        SELECT 1 FROM public.dogs
        WHERE dogs.id = scanner_sessions.dog_id AND dogs.user_id = auth.uid()
    ));

-- TRIGGER: Auto-create profile on Supabase auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
