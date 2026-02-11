-- Schema Update V3 - Prayer Marathon App
-- ============================================
-- This script adds:
-- 1. Photo uploads for prayers and testimonials
-- 2. Day resources (images, PDFs, videos, text)
-- 3. Prayer groups and enhanced chat
-- 4. Prayer categories
-- 5. Day view tracking (realtime)
-- 6. Bible games support

-- ============================================
-- 1. Update prayer_requests with photos and categories
-- ============================================

ALTER TABLE public.prayer_requests 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'other',
ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_answered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS answered_at timestamptz,
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Add index for category search
CREATE INDEX IF NOT EXISTS idx_prayer_requests_category ON public.prayer_requests(category);

-- ============================================
-- 2. Update testimonials with photos
-- ============================================

ALTER TABLE public.testimonials 
ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';

-- ============================================
-- 3. Day Resources Table (Admin adds media for each day)
-- ============================================

CREATE TABLE IF NOT EXISTS public.day_resources (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    day_number int NOT NULL,
    resource_type text NOT NULL CHECK (resource_type IN ('image', 'video', 'pdf', 'text', 'audio')),
    title text NOT NULL,
    description text,
    url text, -- For uploaded files
    content text, -- For text content
    sort_order int DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.day_resources ENABLE ROW LEVEL SECURITY;

-- Everyone can view resources
CREATE POLICY "Public can view day resources"
    ON public.day_resources FOR SELECT
    USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage day resources"
    ON public.day_resources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- 4. Day Views Tracking (Realtime for Admin)
-- ============================================

CREATE TABLE IF NOT EXISTS public.day_views (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_number int NOT NULL,
    viewed_at timestamptz DEFAULT now(),
    duration_seconds int DEFAULT 0,
    UNIQUE(user_id, day_number, viewed_at::date)
);

ALTER TABLE public.day_views ENABLE ROW LEVEL SECURITY;

-- Users can insert their own views
CREATE POLICY "Users can log own views"
    ON public.day_views FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can see all views
CREATE POLICY "Admins can view all day views"
    ON public.day_views FOR SELECT
    USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 5. Prayer Groups (Each prayer request becomes a group)
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_groups (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prayer_request_id uuid REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    is_open boolean DEFAULT true,
    is_answered boolean DEFAULT false,
    answered_at timestamptz,
    max_members int DEFAULT 50,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prayer_groups ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view groups
CREATE POLICY "Authenticated can view prayer groups"
    ON public.prayer_groups FOR SELECT
    TO authenticated
    USING (true);

-- Users can create groups
CREATE POLICY "Users can create prayer groups"
    ON public.prayer_groups FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Admins or creators can update
CREATE POLICY "Admins and creators can update groups"
    ON public.prayer_groups FOR UPDATE
    USING (
        auth.uid() = created_by OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 6. Prayer Group Members
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_group_members (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at timestamptz DEFAULT now(),
    UNIQUE(group_id, user_id)
);

ALTER TABLE public.prayer_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group members"
    ON public.prayer_group_members FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can join groups"
    ON public.prayer_group_members FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups"
    ON public.prayer_group_members FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 7. Prayer Group Messages (Private Chat)
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_group_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_prayer boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.prayer_group_messages ENABLE ROW LEVEL SECURITY;

-- Only group members can view messages
CREATE POLICY "Group members can view messages"
    ON public.prayer_group_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.prayer_group_members 
            WHERE group_id = prayer_group_messages.group_id 
            AND user_id = auth.uid()
        )
    );

-- Only group members can send messages
CREATE POLICY "Group members can send messages"
    ON public.prayer_group_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.prayer_group_members 
            WHERE group_id = prayer_group_messages.group_id 
            AND user_id = auth.uid()
        )
    );

-- ============================================
-- 8. Direct Messages (Private Chat)
-- ============================================

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view own messages"
    ON public.direct_messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "Users can send messages"
    ON public.direct_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Users can mark messages as read
CREATE POLICY "Users can update read status"
    ON public.direct_messages FOR UPDATE
    USING (auth.uid() = receiver_id);

-- ============================================
-- 9. Bible Games Results
-- ============================================

CREATE TABLE IF NOT EXISTS public.bible_game_results (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    game_type text NOT NULL CHECK (game_type IN ('quiz', 'memory', 'word_search', 'crossword', 'verse_order')),
    score int NOT NULL DEFAULT 0,
    max_score int NOT NULL,
    time_seconds int,
    difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    metadata jsonb DEFAULT '{}',
    played_at timestamptz DEFAULT now()
);

ALTER TABLE public.bible_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game results"
    ON public.bible_game_results FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game results"
    ON public.bible_game_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Leaderboard: everyone can see top scores
CREATE POLICY "Public leaderboard"
    ON public.bible_game_results FOR SELECT
    USING (true);

-- ============================================
-- 10. Prayer Categories Reference Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.prayer_categories (
    id text PRIMARY KEY,
    name_fr text NOT NULL,
    name_en text NOT NULL,
    icon text,
    color text,
    sort_order int DEFAULT 0
);

-- Seed categories
INSERT INTO public.prayer_categories (id, name_fr, name_en, icon, color, sort_order) VALUES
    ('healing', 'Guérison', 'Healing', '🏥', '#ef4444', 1),
    ('family', 'Famille', 'Family', '👨‍👩‍👧‍👦', '#f97316', 2),
    ('provision', 'Provision', 'Provision', '💰', '#eab308', 3),
    ('guidance', 'Direction', 'Guidance', '🧭', '#22c55e', 4),
    ('spiritual', 'Spirituel', 'Spiritual', '🙏', '#8b5cf6', 5),
    ('work', 'Travail', 'Work', '💼', '#3b82f6', 6),
    ('relationships', 'Relations', 'Relationships', '💕', '#ec4899', 7),
    ('protection', 'Protection', 'Protection', '🛡️', '#14b8a6', 8),
    ('thanksgiving', 'Action de grâce', 'Thanksgiving', '🙌', '#f59e0b', 9),
    ('other', 'Autre', 'Other', '✨', '#6b7280', 10)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 11. Enable Realtime for key tables
-- ============================================

-- Note: Run these in Supabase Dashboard under Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE day_views;
-- ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- ============================================
-- 12. Storage Buckets for file uploads
-- ============================================

-- Run in Supabase Dashboard or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('prayer-photos', 'prayer-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('testimony-photos', 'testimony-photos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('day-resources', 'day-resources', true);

-- ============================================
-- 13. Function to auto-create prayer group when prayer is created
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_create_prayer_group()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.prayer_groups (prayer_request_id, name, description, created_by)
    VALUES (
        NEW.id,
        'Groupe de prière: ' || LEFT(NEW.content, 50) || '...',
        'Groupe créé automatiquement pour cette demande de prière',
        NEW.user_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_prayer_request_created
    AFTER INSERT ON public.prayer_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_prayer_group();

-- ============================================
-- 14. Function to mark prayer as answered
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_prayer_answered(prayer_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.prayer_requests
    SET is_answered = true, answered_at = now(), is_locked = true
    WHERE id = prayer_id;
    
    UPDATE public.prayer_groups
    SET is_answered = true, answered_at = now(), is_open = false
    WHERE prayer_request_id = prayer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
