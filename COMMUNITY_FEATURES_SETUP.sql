-- ============================================
-- 🚀 COMMUNITY FEATURES - COMPLETE SETUP
-- ============================================
-- Execute this script in Supabase SQL Editor
-- This completes all community features:
-- - Prayer Requests (enhanced)
-- - Testimonials (with DB sync)
-- - Community Chat
-- - Prayer Groups (creation & management)
-- - Private Messages/Conversations
-- ============================================

-- ============================================
-- 1. COMMUNITY_MESSAGES TABLE (Global Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_created_at ON public.community_messages(created_at);
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community messages viewable by all" ON public.community_messages;
CREATE POLICY "Community messages viewable by all" ON public.community_messages 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can send community messages" ON public.community_messages;
CREATE POLICY "Users can send community messages" ON public.community_messages 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. TESTIMONIALS TABLE (Enhanced)
-- ============================================
-- Ensure testimonials table has all needed columns
DO $$ 
BEGIN
    -- Add is_featured column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'testimonials' AND column_name = 'is_featured') THEN
        ALTER TABLE public.testimonials ADD COLUMN is_featured BOOLEAN DEFAULT false;
    END IF;
    -- Add title column if not exists  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'testimonials' AND column_name = 'title') THEN
        ALTER TABLE public.testimonials ADD COLUMN title TEXT;
    END IF;
END $$;

-- ============================================
-- 3. PRAYER_GROUPS TABLE (Enhanced)
-- ============================================
-- Drop and recreate with proper structure
DROP TABLE IF EXISTS public.prayer_group_messages CASCADE;
DROP TABLE IF EXISTS public.prayer_group_members CASCADE;

-- Alter existing table instead of dropping
DO $$ 
BEGIN
    -- Add is_open column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'is_open') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN is_open BOOLEAN DEFAULT true;
    END IF;
    -- Add is_answered column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'is_answered') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN is_answered BOOLEAN DEFAULT false;
    END IF;
    -- Add answered_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'answered_at') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN answered_at TIMESTAMP WITH TIME ZONE;
    END IF;
    -- Add max_members column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'max_members') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN max_members INTEGER DEFAULT 50;
    END IF;
    -- Add prayer_request_id column for linked groups
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'prayer_request_id') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN prayer_request_id UUID REFERENCES public.prayer_requests(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 4. PRAYER_GROUP_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.prayer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prayer_group_members_group ON public.prayer_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_members_user ON public.prayer_group_members(user_id);

ALTER TABLE public.prayer_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members viewable by all" ON public.prayer_group_members;
CREATE POLICY "Group members viewable by all" ON public.prayer_group_members 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON public.prayer_group_members;
CREATE POLICY "Users can join groups" ON public.prayer_group_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave groups" ON public.prayer_group_members;
CREATE POLICY "Users can leave groups" ON public.prayer_group_members 
FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage members" ON public.prayer_group_members;
CREATE POLICY "Admins can manage members" ON public.prayer_group_members 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.prayer_group_members pm 
        WHERE pm.group_id = prayer_group_members.group_id 
        AND pm.user_id = auth.uid() 
        AND pm.role = 'admin'
    )
);

-- ============================================
-- 5. PRAYER_GROUP_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.prayer_group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_prayer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prayer_group_messages_group ON public.prayer_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_messages_created ON public.prayer_group_messages(created_at);

ALTER TABLE public.prayer_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group messages viewable by members" ON public.prayer_group_messages;
CREATE POLICY "Group messages viewable by members" ON public.prayer_group_messages 
FOR SELECT USING (true); -- Public groups are visible to all

DROP POLICY IF EXISTS "Members can send group messages" ON public.prayer_group_messages;
CREATE POLICY "Members can send group messages" ON public.prayer_group_messages 
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.prayer_group_members pm 
        WHERE pm.group_id = prayer_group_messages.group_id 
        AND pm.user_id = auth.uid()
    )
);

-- ============================================
-- 6. CONVERSATIONS TABLE (for DMs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant1_id, participant2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON public.conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON public.conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations 
FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations 
FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations 
FOR UPDATE USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- ============================================
-- 7. DIRECT_MESSAGES TABLE (Enhanced)
-- ============================================
-- Drop the old structure if it exists
DROP TABLE IF EXISTS public.direct_messages CASCADE;

CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conv ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created ON public.direct_messages(created_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view conversation messages" ON public.direct_messages;
CREATE POLICY "Users can view conversation messages" ON public.direct_messages 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = direct_messages.conversation_id 
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can send DMs" ON public.direct_messages;
CREATE POLICY "Users can send DMs" ON public.direct_messages 
FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = direct_messages.conversation_id 
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can update own messages" ON public.direct_messages;
CREATE POLICY "Users can update own messages" ON public.direct_messages 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = direct_messages.conversation_id 
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
);

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Function to get or create a conversation between two users
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
    
    -- Try to find existing conversation (in either direction)
    SELECT id INTO conv_id FROM public.conversations 
    WHERE (participant1_id = current_user_id AND participant2_id = other_user_id)
       OR (participant1_id = other_user_id AND participant2_id = current_user_id)
    LIMIT 1;
    
    -- If not found, create new conversation
    IF conv_id IS NULL THEN
        INSERT INTO public.conversations (participant1_id, participant2_id)
        VALUES (current_user_id, other_user_id)
        RETURNING id INTO conv_id;
    END IF;
    
    RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a prayer group
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

-- Function to like a testimonial
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

-- Function to update conversation last message timestamp
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations 
    SET last_message_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update conversation timestamp
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON public.direct_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_timestamp();

-- ============================================
-- 9. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- ✅ SUCCESS!
-- All community features are now configured.
-- ============================================
