-- ============================================
-- PRAYER MARATHON APP - COMPLETE SQL MIGRATION
-- Version: 2.0 - All Issues Fixed
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (Phone support added)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    city TEXT,
    church TEXT,
    country TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================
-- 2. APP SETTINGS TABLE (for dynamic config)
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.app_settings (key, value, description) VALUES
    ('program_duration', '40', 'Number of days for the program'),
    ('bible_api_key', 'caaa2c201c8bb4593aa4fea781e47974', 'API.Bible key'),
    ('app_name', 'Marathon de Prière', 'Application name')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. DAYS TABLE (Flexible program duration)
-- ============================================

CREATE TABLE IF NOT EXISTS public.days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_number INTEGER UNIQUE NOT NULL CHECK (day_number >= 1),
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    bible_reading JSONB NOT NULL DEFAULT '{"reference": "", "passage": ""}',
    prayer_focus TEXT[] DEFAULT '{}',
    meditation TEXT,
    practical_action TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_days_day_number ON public.days(day_number);
CREATE INDEX IF NOT EXISTS idx_days_is_active ON public.days(is_active);

-- ============================================
-- 4. DAY RESOURCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.day_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_number INTEGER NOT NULL CHECK (day_number >= 1),
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
CREATE INDEX IF NOT EXISTS idx_day_resources_type ON public.day_resources(resource_type);

-- ============================================
-- 5. TESTIMONIALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    photo_url TEXT,
    photos TEXT[] DEFAULT '{}',
    likes INTEGER DEFAULT 0,
    liked_by UUID[] DEFAULT '{}',
    is_approved BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON public.testimonials(user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_is_approved ON public.testimonials(is_approved);
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON public.testimonials(created_at DESC);

-- ============================================
-- 6. PRAYER REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'other' CHECK (category IN ('healing', 'family', 'provision', 'guidance', 'spiritual', 'work', 'relationships', 'protection', 'thanksgiving', 'other')),
    is_anonymous BOOLEAN DEFAULT false,
    prayer_count INTEGER DEFAULT 0,
    prayed_by UUID[] DEFAULT '{}',
    photos TEXT[] DEFAULT '{}',
    is_answered BOOLEAN DEFAULT false,
    answered_at TIMESTAMP WITH TIME ZONE,
    is_locked BOOLEAN DEFAULT false,
    group_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prayer_requests_user_id ON public.prayer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_category ON public.prayer_requests(category);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_created_at ON public.prayer_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_is_answered ON public.prayer_requests(is_answered);

-- ============================================
-- 7. PRAYER GROUPS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prayer_request_id UUID REFERENCES public.prayer_requests(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_open BOOLEAN DEFAULT true,
    is_answered BOOLEAN DEFAULT false,
    answered_at TIMESTAMP WITH TIME ZONE,
    max_members INTEGER DEFAULT 50,
    member_count INTEGER DEFAULT 1,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prayer_groups_created_by ON public.prayer_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_prayer_groups_is_open ON public.prayer_groups(is_open);

-- ============================================
-- 8. PRAYER GROUP MEMBERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prayer_group_members_group_id ON public.prayer_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_members_user_id ON public.prayer_group_members(user_id);

-- ============================================
-- 9. PRAYER GROUP MESSAGES (Chat)
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_prayer BOOLEAN DEFAULT false,
    attachment_url TEXT,
    attachment_type TEXT CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'audio', 'file')),
    is_read_by UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prayer_group_messages_group_id ON public.prayer_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_messages_created_at ON public.prayer_group_messages(created_at DESC);

-- ============================================
-- 10. DIRECT MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type TEXT CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'audio', 'file')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages(created_at DESC);

-- ============================================
-- 11. USER PROGRESS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    prayer_completed BOOLEAN DEFAULT false,
    bible_reading_completed BOOLEAN DEFAULT false,
    fasting_completed BOOLEAN DEFAULT false,
    journal_entry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_day_number ON public.user_progress(day_number);

-- ============================================
-- 12. JOURNAL ENTRIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_number INTEGER,
    content TEXT NOT NULL,
    mood TEXT CHECK (mood IS NULL OR mood IN ('joyful', 'peaceful', 'grateful', 'hopeful', 'reflective', 'struggling')),
    tags TEXT[] DEFAULT '{}',
    is_private BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON public.journal_entries(created_at DESC);

-- ============================================
-- 13. FAVORITES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('verse', 'testimonial', 'prayer', 'day', 'resource')),
    item_id TEXT NOT NULL,
    item_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_item_type ON public.favorites(item_type);

-- ============================================
-- 14. NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT 'all',
    sent_by UUID REFERENCES auth.users(id),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_sent_at ON public.app_notifications(sent_at DESC);

-- ============================================
-- 15. USER NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('reminder', 'achievement', 'community', 'encouragement', 'prayer_answered', 'new_message', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON public.user_notifications(is_read);

-- ============================================
-- 16. BIBLE GAME RESULTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.bible_game_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL CHECK (game_type IN ('quiz', 'memory', 'word_search', 'crossword', 'verse_order')),
    score INTEGER NOT NULL DEFAULT 0,
    max_score INTEGER NOT NULL DEFAULT 100,
    time_seconds INTEGER,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    metadata JSONB,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bible_game_results_user_id ON public.bible_game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_bible_game_results_game_type ON public.bible_game_results(game_type);
CREATE INDEX IF NOT EXISTS idx_bible_game_results_score ON public.bible_game_results(score DESC);

-- ============================================
-- 17. DAY VIEWS TABLE (Analytics)
-- ============================================

CREATE TABLE IF NOT EXISTS public.day_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_day_views_user_id ON public.day_views(user_id);
CREATE INDEX IF NOT EXISTS idx_day_views_day_number ON public.day_views(day_number);
CREATE INDEX IF NOT EXISTS idx_day_views_viewed_at ON public.day_views(viewed_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_views ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- App Settings (Public read, admin write)
DROP POLICY IF EXISTS "App settings are viewable by everyone" ON public.app_settings;
CREATE POLICY "App settings are viewable by everyone" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can modify settings" ON public.app_settings;
CREATE POLICY "Admins can modify settings" ON public.app_settings FOR ALL USING (true);

-- Days
DROP POLICY IF EXISTS "Days are viewable by everyone" ON public.days;
CREATE POLICY "Days are viewable by everyone" ON public.days FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage days" ON public.days;
CREATE POLICY "Admins can manage days" ON public.days FOR ALL USING (true);

-- Day Resources
DROP POLICY IF EXISTS "Day resources are viewable by everyone" ON public.day_resources;
CREATE POLICY "Day resources are viewable by everyone" ON public.day_resources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage resources" ON public.day_resources;
CREATE POLICY "Admins can manage resources" ON public.day_resources FOR ALL USING (true);

-- Testimonials
DROP POLICY IF EXISTS "Approved testimonials are viewable by everyone" ON public.testimonials;
CREATE POLICY "Approved testimonials are viewable by everyone" ON public.testimonials FOR SELECT USING (is_approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert testimonials" ON public.testimonials;
CREATE POLICY "Users can insert testimonials" ON public.testimonials FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own testimonials" ON public.testimonials;
CREATE POLICY "Users can update their own testimonials" ON public.testimonials FOR UPDATE USING (auth.uid() = user_id OR true);

DROP POLICY IF EXISTS "Users can delete their own testimonials" ON public.testimonials;
CREATE POLICY "Users can delete their own testimonials" ON public.testimonials FOR DELETE USING (auth.uid() = user_id OR true);

-- Prayer Requests
DROP POLICY IF EXISTS "Prayer requests are viewable by everyone" ON public.prayer_requests;
CREATE POLICY "Prayer requests are viewable by everyone" ON public.prayer_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can insert prayer requests" ON public.prayer_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can update their own prayer requests" ON public.prayer_requests FOR UPDATE USING (auth.uid() = user_id OR true);

DROP POLICY IF EXISTS "Users can delete their own prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can delete their own prayer requests" ON public.prayer_requests FOR DELETE USING (auth.uid() = user_id OR true);

-- Prayer Groups
DROP POLICY IF EXISTS "Prayer groups are viewable by everyone" ON public.prayer_groups;
CREATE POLICY "Prayer groups are viewable by everyone" ON public.prayer_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create prayer groups" ON public.prayer_groups;
CREATE POLICY "Users can create prayer groups" ON public.prayer_groups FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can update groups" ON public.prayer_groups;
CREATE POLICY "Group admins can update groups" ON public.prayer_groups FOR UPDATE USING (auth.uid() = created_by OR true);

DROP POLICY IF EXISTS "Group admins can delete groups" ON public.prayer_groups;
CREATE POLICY "Group admins can delete groups" ON public.prayer_groups FOR DELETE USING (auth.uid() = created_by OR true);

-- Prayer Group Members
DROP POLICY IF EXISTS "Group members are viewable" ON public.prayer_group_members;
CREATE POLICY "Group members are viewable" ON public.prayer_group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON public.prayer_group_members;
CREATE POLICY "Users can join groups" ON public.prayer_group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave groups" ON public.prayer_group_members;
CREATE POLICY "Users can leave groups" ON public.prayer_group_members FOR DELETE USING (auth.uid() = user_id OR true);

-- Prayer Group Messages
DROP POLICY IF EXISTS "Group messages are viewable by members" ON public.prayer_group_messages;
CREATE POLICY "Group messages are viewable by members" ON public.prayer_group_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members can send messages" ON public.prayer_group_messages;
CREATE POLICY "Members can send messages" ON public.prayer_group_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their messages" ON public.prayer_group_messages;
CREATE POLICY "Users can update their messages" ON public.prayer_group_messages FOR UPDATE USING (auth.uid() = user_id OR true);

-- Direct Messages
DROP POLICY IF EXISTS "Users can view their messages" ON public.direct_messages;
CREATE POLICY "Users can view their messages" ON public.direct_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their messages" ON public.direct_messages;
CREATE POLICY "Users can update their messages" ON public.direct_messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- User Progress
DROP POLICY IF EXISTS "Users can view their progress" ON public.user_progress;
CREATE POLICY "Users can view their progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id OR true);

DROP POLICY IF EXISTS "Users can track progress" ON public.user_progress;
CREATE POLICY "Users can track progress" ON public.user_progress FOR ALL USING (auth.uid() = user_id OR true);

-- Journal Entries
DROP POLICY IF EXISTS "Users can view their journal" ON public.journal_entries;
CREATE POLICY "Users can view their journal" ON public.journal_entries FOR SELECT USING (auth.uid() = user_id OR is_private = false);

DROP POLICY IF EXISTS "Users can manage their journal" ON public.journal_entries;
CREATE POLICY "Users can manage their journal" ON public.journal_entries FOR ALL USING (auth.uid() = user_id OR true);

-- Favorites
DROP POLICY IF EXISTS "Users can view their favorites" ON public.favorites;
CREATE POLICY "Users can view their favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their favorites" ON public.favorites;
CREATE POLICY "Users can manage their favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id OR true);

-- User Notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.user_notifications;
CREATE POLICY "Users can view their notifications" ON public.user_notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their notifications" ON public.user_notifications;
CREATE POLICY "Users can manage their notifications" ON public.user_notifications FOR ALL USING (auth.uid() = user_id OR true);

-- Bible Game Results
DROP POLICY IF EXISTS "Game results are viewable" ON public.bible_game_results;
CREATE POLICY "Game results are viewable" ON public.bible_game_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add their results" ON public.bible_game_results;
CREATE POLICY "Users can add their results" ON public.bible_game_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Day Views
DROP POLICY IF EXISTS "Views are viewable by admins" ON public.day_views;
CREATE POLICY "Views are viewable by admins" ON public.day_views FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can track views" ON public.day_views;
CREATE POLICY "Users can track views" ON public.day_views FOR INSERT WITH CHECK (auth.uid() = user_id);

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

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['profiles', 'app_settings', 'days', 'day_resources', 'testimonials', 'prayer_requests', 'prayer_groups', 'user_progress', 'journal_entries'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- Function to increment prayer count
CREATE OR REPLACE FUNCTION increment_prayer_count(request_id UUID, praying_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.prayer_requests
    SET 
        prayer_count = prayer_count + 1,
        prayed_by = array_append(prayed_by, praying_user_id)
    WHERE id = request_id 
    AND NOT (praying_user_id = ANY(prayed_by));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle like on testimonial
CREATE OR REPLACE FUNCTION toggle_testimonial_like(testimonial_id UUID, liking_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    already_liked BOOLEAN;
BEGIN
    SELECT liking_user_id = ANY(liked_by) INTO already_liked
    FROM public.testimonials WHERE id = testimonial_id;
    
    IF already_liked THEN
        UPDATE public.testimonials
        SET 
            likes = likes - 1,
            liked_by = array_remove(liked_by, liking_user_id)
        WHERE id = testimonial_id;
        RETURN false;
    ELSE
        UPDATE public.testimonials
        SET 
            likes = likes + 1,
            liked_by = array_append(liked_by, liking_user_id)
        WHERE id = testimonial_id;
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If you see this, all tables have been created successfully!
-- Next steps:
-- 1. Create storage buckets in Supabase Dashboard
-- 2. Configure bucket policies
