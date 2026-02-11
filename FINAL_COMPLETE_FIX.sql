-- ============================================
-- 🔥 FINAL COMPLETE FIX - ALL FEATURES
-- ============================================
-- Execute this ENTIRE script in Supabase SQL Editor
-- This fixes ALL issues and enables ALL features
-- ============================================

-- ============================================
-- 1. PROFILES TABLE - Add Online Presence
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update RLS for profiles
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. PRAYER_GROUPS TABLE - Complete Structure
-- ============================================
CREATE TABLE IF NOT EXISTS public.prayer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    is_open BOOLEAN DEFAULT true,
    is_answered BOOLEAN DEFAULT false,
    answered_at TIMESTAMP WITH TIME ZONE,
    max_members INTEGER DEFAULT 50,
    prayer_request_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'is_public') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'is_open') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN is_open BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'is_answered') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN is_answered BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'answered_at') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN answered_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'max_members') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN max_members INTEGER DEFAULT 50;
    END IF;
END $$;

ALTER TABLE public.prayer_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prayer groups viewable by all" ON public.prayer_groups;
CREATE POLICY "Prayer groups viewable by all" ON public.prayer_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create groups" ON public.prayer_groups;
CREATE POLICY "Users can create groups" ON public.prayer_groups 
FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators can update groups" ON public.prayer_groups;
CREATE POLICY "Creators can update groups" ON public.prayer_groups 
FOR UPDATE USING (auth.uid() = created_by);

-- ============================================
-- 3. PRAYER_GROUP_MEMBERS TABLE
-- ============================================
DROP TABLE IF EXISTS public.prayer_group_members CASCADE;
CREATE TABLE public.prayer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pgm_group ON public.prayer_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pgm_user ON public.prayer_group_members(user_id);

ALTER TABLE public.prayer_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members viewable by all" ON public.prayer_group_members;
CREATE POLICY "Members viewable by all" ON public.prayer_group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join" ON public.prayer_group_members;
CREATE POLICY "Users can join" ON public.prayer_group_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave" ON public.prayer_group_members;
CREATE POLICY "Users can leave" ON public.prayer_group_members 
FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. PRAYER_GROUP_MESSAGES TABLE
-- ============================================
DROP TABLE IF EXISTS public.prayer_group_messages CASCADE;
CREATE TABLE public.prayer_group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_prayer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgmsg_group ON public.prayer_group_messages(group_id);

ALTER TABLE public.prayer_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group messages viewable" ON public.prayer_group_messages;
CREATE POLICY "Group messages viewable" ON public.prayer_group_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members can send" ON public.prayer_group_messages;
CREATE POLICY "Members can send" ON public.prayer_group_messages 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. COMMUNITY_MESSAGES TABLE (Global Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat viewable" ON public.community_messages;
CREATE POLICY "Chat viewable" ON public.community_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can chat" ON public.community_messages;
CREATE POLICY "Users can chat" ON public.community_messages 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. CONVERSATIONS TABLE (DMs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant1_id, participant2_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own convs" ON public.conversations;
CREATE POLICY "View own convs" ON public.conversations 
FOR SELECT USING (auth.uid() IN (participant1_id, participant2_id));

DROP POLICY IF EXISTS "Create convs" ON public.conversations;
CREATE POLICY "Create convs" ON public.conversations 
FOR INSERT WITH CHECK (auth.uid() IN (participant1_id, participant2_id));

DROP POLICY IF EXISTS "Update convs" ON public.conversations;
CREATE POLICY "Update convs" ON public.conversations 
FOR UPDATE USING (auth.uid() IN (participant1_id, participant2_id));

-- ============================================
-- 7. DIRECT_MESSAGES TABLE
-- ============================================
DROP TABLE IF EXISTS public.direct_messages CASCADE;
CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View DMs" ON public.direct_messages;
CREATE POLICY "View DMs" ON public.direct_messages 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c 
            WHERE c.id = conversation_id 
            AND auth.uid() IN (c.participant1_id, c.participant2_id))
);

DROP POLICY IF EXISTS "Send DMs" ON public.direct_messages;
CREATE POLICY "Send DMs" ON public.direct_messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- 8. NOTIFICATIONS TABLE (for push/in-app)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'prayer', 'testimony', 'message')),
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own notifs" ON public.notifications;
CREATE POLICY "View own notifs" ON public.notifications 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert notifs" ON public.notifications;
CREATE POLICY "Insert notifs" ON public.notifications 
FOR INSERT WITH CHECK (true); -- Admins can send to anyone

DROP POLICY IF EXISTS "Update notifs" ON public.notifications;
CREATE POLICY "Update notifs" ON public.notifications 
FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 9. TESTIMONIALS - Ensure proper structure
-- ============================================
ALTER TABLE public.testimonials 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS title TEXT;

DROP POLICY IF EXISTS "View approved testimonials" ON public.testimonials;
CREATE POLICY "View approved testimonials" ON public.testimonials 
FOR SELECT USING (is_approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create testimonials" ON public.testimonials;
CREATE POLICY "Users can create testimonials" ON public.testimonials 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 10. PRAYER_REQUESTS - Ensure proper structure
-- ============================================
ALTER TABLE public.prayer_requests 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

DROP POLICY IF EXISTS "View prayers" ON public.prayer_requests;
CREATE POLICY "View prayers" ON public.prayer_requests 
FOR SELECT USING (is_approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Create prayers" ON public.prayer_requests;
CREATE POLICY "Create prayers" ON public.prayer_requests 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own prayers" ON public.prayer_requests;
CREATE POLICY "Update own prayers" ON public.prayer_requests 
FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Create prayer group (FIXED VERSION)
CREATE OR REPLACE FUNCTION public.create_prayer_group(
    group_name TEXT,
    group_description TEXT DEFAULT NULL,
    is_public_group BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    current_user_id UUID;
    new_group_id UUID;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Create the group
    INSERT INTO public.prayer_groups (name, description, created_by, is_public, is_open)
    VALUES (group_name, group_description, current_user_id, is_public_group, true)
    RETURNING id INTO new_group_id;
    
    -- Add creator as admin
    INSERT INTO public.prayer_group_members (group_id, user_id, role)
    VALUES (new_group_id, current_user_id, 'admin');
    
    RETURN new_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create conversation (FIXED VERSION)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    current_user_id UUID;
    conv_id UUID;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Find existing
    SELECT id INTO conv_id FROM public.conversations 
    WHERE (participant1_id = current_user_id AND participant2_id = other_user_id)
       OR (participant1_id = other_user_id AND participant2_id = current_user_id)
    LIMIT 1;
    
    -- Create if not found
    IF conv_id IS NULL THEN
        INSERT INTO public.conversations (participant1_id, participant2_id)
        VALUES (current_user_id, other_user_id)
        RETURNING id INTO conv_id;
    END IF;
    
    RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update online status
CREATE OR REPLACE FUNCTION public.update_presence(online BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles 
    SET is_online = online, last_seen = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send notification to user
CREATE OR REPLACE FUNCTION public.send_notification(
    target_user_id UUID,
    notif_title TEXT,
    notif_message TEXT,
    notif_type TEXT DEFAULT 'info',
    notif_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notif_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (target_user_id, notif_title, notif_message, notif_type, notif_action_url)
    RETURNING id INTO notif_id;
    
    RETURN notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Broadcast notification to all users
CREATE OR REPLACE FUNCTION public.broadcast_notification(
    notif_title TEXT,
    notif_message TEXT,
    notif_type TEXT DEFAULT 'info'
)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER := 0;
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (user_record.id, notif_title, notif_message, notif_type);
        count := count + 1;
    END LOOP;
    
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. REALTIME CONFIGURATION
-- ============================================
-- Enable realtime for all relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ============================================
-- 13. ADMIN FUNCTIONS
-- ============================================

-- Update user role
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles 
    SET role = new_role
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve testimony
CREATE OR REPLACE FUNCTION public.approve_testimony(testimony_id UUID, approved BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE public.testimonials 
    SET is_approved = approved
    WHERE id = testimony_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve prayer request
CREATE OR REPLACE FUNCTION public.approve_prayer(prayer_id UUID, approved BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE public.prayer_requests 
    SET is_approved = approved
    WHERE id = prayer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS! All tables and functions created.' as result;
