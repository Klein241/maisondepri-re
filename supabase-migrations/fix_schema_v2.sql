-- =====================================================
-- PRAYER MARATHON APP - DATABASE SCHEMA FIX V2
-- This version handles already existing publications
-- Execute this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- 2. Add missing columns to prayer_groups table
ALTER TABLE public.prayer_groups 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Create prayer_group_members table if not exists
CREATE TABLE IF NOT EXISTS public.prayer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.prayer_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- 4. Create conversations table if not exists
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    last_message_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(participant1_id, participant2_id)
);

-- 5. Create direct_messages table if not exists
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create notifications table if not exists
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Add missing columns to prayer_requests
ALTER TABLE public.prayer_requests 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other',
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS prayer_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS prayed_by UUID[] DEFAULT '{}';

-- 8. Add missing columns to testimonials
ALTER TABLE public.testimonials 
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS liked_by UUID[] DEFAULT '{}';

-- 9. Create RPC function for broadcasting notifications
CREATE OR REPLACE FUNCTION public.broadcast_notification(
    notif_title TEXT,
    notif_message TEXT,
    notif_type TEXT DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT id, notif_title, notif_message, notif_type
    FROM auth.users;
END;
$$;

-- 10. Create RPC function for creating prayer groups
CREATE OR REPLACE FUNCTION public.create_prayer_group(
    group_name TEXT,
    group_description TEXT DEFAULT NULL,
    creator_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_group_id UUID;
BEGIN
    -- Create the group
    INSERT INTO public.prayer_groups (name, description, created_by)
    VALUES (group_name, group_description, creator_id)
    RETURNING id INTO new_group_id;
    
    -- Add creator as member
    INSERT INTO public.prayer_group_members (group_id, user_id)
    VALUES (new_group_id, creator_id);
    
    RETURN new_group_id;
END;
$$;

-- 11. Create RPC function for getting or creating conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
    other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    conv_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    -- Try to find existing conversation
    SELECT id INTO conv_id
    FROM public.conversations
    WHERE (participant1_id = current_user_id AND participant2_id = other_user_id)
       OR (participant1_id = other_user_id AND participant2_id = current_user_id);
    
    -- If not found, create new one
    IF conv_id IS NULL THEN
        INSERT INTO public.conversations (participant1_id, participant2_id)
        VALUES (current_user_id, other_user_id)
        RETURNING id INTO conv_id;
    END IF;
    
    RETURN conv_id;
END;
$$;

-- 12. Create RPC function for praying for a request (with counter increment)
CREATE OR REPLACE FUNCTION public.pray_for_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    current_prayed_by UUID[];
BEGIN
    -- Get current prayed_by array
    SELECT COALESCE(prayed_by, '{}') INTO current_prayed_by
    FROM public.prayer_requests
    WHERE id = request_id;
    
    -- Only increment if user hasn't already prayed
    IF NOT (current_user_id = ANY(current_prayed_by)) THEN
        UPDATE public.prayer_requests
        SET 
            prayer_count = COALESCE(prayer_count, 0) + 1,
            prayed_by = array_append(COALESCE(prayed_by, '{}'), current_user_id)
        WHERE id = request_id;
    END IF;
END;
$$;

-- 13. Create RPC function for liking a testimonial
CREATE OR REPLACE FUNCTION public.like_testimonial(testimonial_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    current_liked_by UUID[];
BEGIN
    -- Get current liked_by array
    SELECT COALESCE(liked_by, '{}') INTO current_liked_by
    FROM public.testimonials
    WHERE id = testimonial_id;
    
    -- Only increment if user hasn't already liked
    IF NOT (current_user_id = ANY(current_liked_by)) THEN
        UPDATE public.testimonials
        SET 
            likes = COALESCE(likes, 0) + 1,
            liked_by = array_append(COALESCE(liked_by, '{}'), current_user_id)
        WHERE id = testimonial_id;
    END IF;
END;
$$;

-- 14. Create function to send notification on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    recipient_id UUID;
    sender_name TEXT;
    conv RECORD;
BEGIN
    -- Get conversation details
    SELECT * INTO conv FROM public.conversations WHERE id = NEW.conversation_id;
    
    -- Determine recipient
    IF NEW.sender_id = conv.participant1_id THEN
        recipient_id := conv.participant2_id;
    ELSE
        recipient_id := conv.participant1_id;
    END IF;
    
    -- Get sender name
    SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
    
    -- Create notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (recipient_id, 'Nouveau message', 'Message de ' || COALESCE(sender_name, 'Utilisateur') || ': ' || LEFT(NEW.content, 50), 'message');
    
    -- Update conversation last message
    UPDATE public.conversations 
    SET last_message_at = NOW(), last_message_preview = LEFT(NEW.content, 100)
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$;

-- 15. Create trigger for new message notification
DROP TRIGGER IF EXISTS trigger_new_message_notification ON public.direct_messages;
CREATE TRIGGER trigger_new_message_notification
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- 16. Enable RLS on new tables (only if not already enabled)
ALTER TABLE public.prayer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 17. Create RLS policies (drop if exists first)
DROP POLICY IF EXISTS "Users can view group members" ON public.prayer_group_members;
CREATE POLICY "Users can view group members" ON public.prayer_group_members
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON public.prayer_group_members;
CREATE POLICY "Users can join groups" ON public.prayer_group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave groups" ON public.prayer_group_members;
CREATE POLICY "Users can leave groups" ON public.prayer_group_members
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

DROP POLICY IF EXISTS "Users can view own messages" ON public.direct_messages;
CREATE POLICY "Users can view own messages" ON public.direct_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations 
            WHERE id = conversation_id 
            AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages" ON public.direct_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 18. Profiles policies for online status
DROP POLICY IF EXISTS "Users can update own profile online status" ON public.profiles;
CREATE POLICY "Users can update own profile online status" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles
    FOR SELECT USING (true);

-- 19. Prayer requests policies
DROP POLICY IF EXISTS "Users can update prayer requests" ON public.prayer_requests;
CREATE POLICY "Users can update prayer requests" ON public.prayer_requests
    FOR UPDATE USING (true);

-- 20. Testimonials policies
DROP POLICY IF EXISTS "Users can update testimonials" ON public.testimonials;
CREATE POLICY "Users can update testimonials" ON public.testimonials
    FOR UPDATE USING (true);

-- 21. Enable realtime SAFELY (check if already member)
DO $$
BEGIN
    -- Try to add each table, ignore if already exists
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
        -- Already exists, do nothing
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    EXCEPTION WHEN duplicate_object THEN
        -- Already exists, do nothing
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN
        -- Already exists, do nothing
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_group_members;
    EXCEPTION WHEN duplicate_object THEN
        -- Already exists, do nothing
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN
        -- Already exists, do nothing
    END;
END;
$$;

-- 22. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant1_id, participant2_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_members_user ON public.prayer_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_members_group ON public.prayer_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);

-- Done! Refresh schema cache in Supabase dashboard after running this.
