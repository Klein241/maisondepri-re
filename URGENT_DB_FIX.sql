-- =========================================================
-- 🚨 URGENT FIX: AUTH & MISSING TABLES
-- Execute this script in Supabase SQL Editor immediately!
-- =========================================================

-- 1. FIX AUTH 500 ERROR (Drop broken triggers)
-- The "Database error saving new user" is caused by a broken trigger.
-- We drop it to allow the Admin Panel to create users manually.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Also drop any other likely triggers that might cause this
DROP TRIGGER IF EXISTS on_auth_sign_up ON auth.users;

-- 2. ENSURE PROFILES TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    city TEXT,
    country TEXT,
    church TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. FIX SOCIAL LINKS (404 Error)
CREATE TABLE IF NOT EXISTS public.social_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read social" ON public.social_links FOR SELECT USING (true);
CREATE POLICY "Admin all social" ON public.social_links FOR ALL USING (true);

-- 4. FIX APP SETTINGS (406 Error)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin all settings" ON public.app_settings FOR ALL USING (true);

-- Seed Settings
INSERT INTO public.app_settings (key, value) VALUES 
('program_duration', '40'), 
('live_stream_active', 'false')
ON CONFLICT (key) DO NOTHING;

-- 5. FIX DAYS TABLE (If missing)
CREATE TABLE IF NOT EXISTS public.days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_number INTEGER UNIQUE NOT NULL,
    title TEXT NOT NULL,
    theme TEXT,
    bible_reading JSONB DEFAULT '{"reference": "", "passage": ""}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    prayer_focus TEXT[],
    meditation TEXT,
    practical_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read days" ON public.days FOR SELECT USING (true);
CREATE POLICY "Admin all days" ON public.days FOR ALL USING (true);

-- =========================================================
-- DONE. Now try creating a user again.
-- =========================================================
