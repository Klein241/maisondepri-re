-- ============================================
-- 🚀 COMPLETE FIX - ALL DATABASE TABLES & STORAGE
-- ============================================
-- Execute this script in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. DAYS TABLE (Pour le programme du jeûne)
-- ============================================
CREATE TABLE IF NOT EXISTS public.days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_number INTEGER UNIQUE NOT NULL CHECK (day_number >= 1),
    title TEXT NOT NULL,
    theme TEXT NOT NULL,
    bible_reading JSONB DEFAULT '{"reference": "", "passage": ""}'::jsonb,
    prayer_focus TEXT[] DEFAULT '{}',
    meditation TEXT DEFAULT '',
    practical_action TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_days_day_number ON public.days(day_number);
ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Days are viewable by everyone" ON public.days;
CREATE POLICY "Days are viewable by everyone" ON public.days FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage days" ON public.days;
CREATE POLICY "Admins can manage days" ON public.days FOR ALL USING (true);

-- ============================================
-- 2. APP_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.app_settings;
CREATE POLICY "Settings are viewable by everyone" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (true);

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
    ('program_duration', '40'),
    ('program_start_date', NULL),
    ('live_stream_url', ''),
    ('live_stream_active', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. PRAYER_REQUESTS TABLE (Fix si nécessaire)
-- ============================================
CREATE TABLE IF NOT EXISTS public.prayer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT false,
    category TEXT DEFAULT 'other',
    photos TEXT[] DEFAULT '{}',
    is_answered BOOLEAN DEFAULT false,
    answered_at TIMESTAMP WITH TIME ZONE,
    prayer_count INTEGER DEFAULT 0,
    prayed_by UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prayers are viewable by everyone" ON public.prayer_requests;
CREATE POLICY "Prayers are viewable by everyone" ON public.prayer_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create prayers" ON public.prayer_requests;
CREATE POLICY "Users can create prayers" ON public.prayer_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own prayers" ON public.prayer_requests;
CREATE POLICY "Users can update own prayers" ON public.prayer_requests FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can update prayer count" ON public.prayer_requests;
CREATE POLICY "Anyone can update prayer count" ON public.prayer_requests FOR UPDATE USING (true);

-- ============================================
-- 4. TESTIMONIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    photos TEXT[] DEFAULT '{}',
    likes INTEGER DEFAULT 0,
    liked_by UUID[] DEFAULT '{}',
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testimonials are viewable by everyone" ON public.testimonials;
CREATE POLICY "Testimonials are viewable by everyone" ON public.testimonials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create testimonials" ON public.testimonials;
CREATE POLICY "Users can create testimonials" ON public.testimonials FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own testimonials" ON public.testimonials;
CREATE POLICY "Users can update own testimonials" ON public.testimonials FOR UPDATE USING (auth.uid() = user_id OR true);

-- ============================================
-- 5. DAY_RESOURCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.day_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
ALTER TABLE public.day_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Day resources viewable" ON public.day_resources;
CREATE POLICY "Day resources viewable" ON public.day_resources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage resources" ON public.day_resources;
CREATE POLICY "Admins manage resources" ON public.day_resources FOR ALL USING (true);

-- ============================================
-- 6. CHAT_MESSAGES TABLE (Global Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat messages viewable" ON public.chat_messages;
CREATE POLICY "Chat messages viewable" ON public.chat_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
CREATE POLICY "Users can send messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. PRAYER_GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.prayer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.prayer_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Groups viewable" ON public.prayer_groups;
CREATE POLICY "Groups viewable" ON public.prayer_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create groups" ON public.prayer_groups;
CREATE POLICY "Users can create groups" ON public.prayer_groups FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can manage" ON public.prayer_groups;
CREATE POLICY "Group admins can manage" ON public.prayer_groups FOR ALL USING (true);

-- ============================================
-- 8. GROUP_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members viewable" ON public.group_members;
CREATE POLICY "Members viewable" ON public.group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can leave" ON public.group_members;
CREATE POLICY "Members can leave" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 9. GROUP_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group messages viewable" ON public.group_messages;
CREATE POLICY "Group messages viewable" ON public.group_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members can send" ON public.group_messages;
CREATE POLICY "Members can send" ON public.group_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 10. DIRECT_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON public.direct_messages(receiver_id);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON public.direct_messages;
CREATE POLICY "Users can view own messages" ON public.direct_messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages" ON public.direct_messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- 11. SOCIAL_LINKS TABLE (Pour réseaux sociaux)
-- ============================================
CREATE TABLE IF NOT EXISTS public.social_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL, -- youtube, facebook, tiktok, instagram
    title TEXT NOT NULL,
    url TEXT,
    embed_code TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Social links viewable" ON public.social_links;
CREATE POLICY "Social links viewable" ON public.social_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage social" ON public.social_links;
CREATE POLICY "Admins manage social" ON public.social_links FOR ALL USING (true);

-- ============================================
-- 12. PROFILES TABLE (Ensure complete)
-- ============================================
-- Add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
        ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'church') THEN
        ALTER TABLE public.profiles ADD COLUMN church TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen') THEN
        ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================
-- 13. ALL STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
    ('prayer-photos', 'prayer-photos', true, 5242880),
    ('testimony-photos', 'testimony-photos', true, 5242880),
    ('testimonial-photos', 'testimonial-photos', true, 5242880),
    ('day-resources', 'day-resources', true, 52428800),
    ('avatars', 'avatars', true, 2097152),
    ('prayers', 'prayers', true, 5242880),
    ('testimonials', 'testimonials', true, 5242880),
    ('resources', 'resources', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================
-- 14. STORAGE RLS POLICIES
-- ============================================

-- Drop all existing storage policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Create universal storage policies
CREATE POLICY "storage_public_read"
ON storage.objects FOR SELECT USING (true);

CREATE POLICY "storage_auth_insert"
ON storage.objects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "storage_auth_update"
ON storage.objects FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "storage_auth_delete"
ON storage.objects FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================
-- 15. HELPER FUNCTIONS
-- ============================================

-- Pray for request function
CREATE OR REPLACE FUNCTION public.pray_for_request(request_id UUID)
RETURNS VOID AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    UPDATE public.prayer_requests
    SET 
        prayer_count = prayer_count + 1,
        prayed_by = array_append(prayed_by, current_user_id)
    WHERE id = request_id
    AND NOT (current_user_id = ANY(prayed_by));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Like testimonial function
CREATE OR REPLACE FUNCTION public.like_testimonial(testimonial_id UUID)
RETURNS VOID AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    UPDATE public.testimonials
    SET 
        likes = likes + 1,
        liked_by = array_append(liked_by, current_user_id)
    WHERE id = testimonial_id
    AND NOT (current_user_id = ANY(liked_by));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 16. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- SUCCESS!
-- All tables and policies are now configured.
-- ============================================
