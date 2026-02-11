-- ============================================
-- PRAYER MARATHON APP - SIMPLIFIED MIGRATIONS
-- ============================================
-- This is a simplified version without comments that might cause issues

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Table: day_resources
CREATE TABLE IF NOT EXISTS public.day_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 40),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'video', 'pdf', 'audio', 'text')),
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    content TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_resources_day_number ON public.day_resources(day_number);
CREATE INDEX IF NOT EXISTS idx_day_resources_is_active ON public.day_resources(is_active);

-- Table: testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    photo_url TEXT,
    likes INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON public.testimonials(user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_is_approved ON public.testimonials(is_approved);

-- Table: prayer_requests
CREATE TABLE IF NOT EXISTS public.prayer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    prayer_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_user_id ON public.prayer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_created_at ON public.prayer_requests(created_at DESC);

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: days
CREATE TABLE IF NOT EXISTS public.days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_number INTEGER UNIQUE NOT NULL CHECK (day_number >= 1 AND day_number <= 40),
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    bible_reading JSONB NOT NULL,
    prayer_focus TEXT NOT NULL,
    meditation TEXT NOT NULL,
    practical_action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_days_day_number ON public.days(day_number);

-- Table: app_notifications
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.day_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

-- RLS Policies for day_resources
DROP POLICY IF EXISTS "Day resources are viewable by everyone" ON public.day_resources;
CREATE POLICY "Day resources are viewable by everyone"
    ON public.day_resources FOR SELECT
    USING (is_active = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can insert day resources" ON public.day_resources;
CREATE POLICY "Admins can insert day resources"
    ON public.day_resources FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update day resources" ON public.day_resources;
CREATE POLICY "Admins can update day resources"
    ON public.day_resources FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Admins can delete day resources" ON public.day_resources;
CREATE POLICY "Admins can delete day resources"
    ON public.day_resources FOR DELETE
    USING (true);

-- RLS Policies for testimonials
DROP POLICY IF EXISTS "Testimonials are viewable by everyone" ON public.testimonials;
CREATE POLICY "Testimonials are viewable by everyone"
    ON public.testimonials FOR SELECT
    USING (is_approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own testimonials" ON public.testimonials;
CREATE POLICY "Users can insert their own testimonials"
    ON public.testimonials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own testimonials" ON public.testimonials;
CREATE POLICY "Users can update their own testimonials"
    ON public.testimonials FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own testimonials" ON public.testimonials;
CREATE POLICY "Users can delete their own testimonials"
    ON public.testimonials FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for prayer_requests
DROP POLICY IF EXISTS "Prayer requests are viewable by everyone" ON public.prayer_requests;
CREATE POLICY "Prayer requests are viewable by everyone"
    ON public.prayer_requests FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can insert their own prayer requests"
    ON public.prayer_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can update their own prayer requests"
    ON public.prayer_requests FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can delete their own prayer requests"
    ON public.prayer_requests FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policies for days
DROP POLICY IF EXISTS "Days are viewable by everyone" ON public.days;
CREATE POLICY "Days are viewable by everyone"
    ON public.days FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage days" ON public.days;
CREATE POLICY "Admins can manage days"
    ON public.days FOR ALL
    USING (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_day_resources_updated_at ON public.day_resources;
CREATE TRIGGER update_day_resources_updated_at
    BEFORE UPDATE ON public.day_resources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_testimonials_updated_at ON public.testimonials;
CREATE TRIGGER update_testimonials_updated_at
    BEFORE UPDATE ON public.testimonials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prayer_requests_updated_at ON public.prayer_requests;
CREATE TRIGGER update_prayer_requests_updated_at
    BEFORE UPDATE ON public.prayer_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_days_updated_at ON public.days;
CREATE TRIGGER update_days_updated_at
    BEFORE UPDATE ON public.days
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
