-- =====================================================
-- REPAIR SCHEMA FINAL - EXECUTE THIS IN SUPABASE SQL EDITOR
-- This script forcefully fixes missing columns and relationships
-- It is designed to NOT fail if objects already exist
-- =====================================================

-- 1. FIX CONVERSATIONS TABLE (Crucial for Chat)
DO $$ 
BEGIN
    -- Add last_message_preview if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'last_message_preview') THEN
        ALTER TABLE public.conversations ADD COLUMN last_message_preview TEXT;
    END IF;

    -- Add last_message_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'last_message_at') THEN
        ALTER TABLE public.conversations ADD COLUMN last_message_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 2. FIX PRAYER_GROUPS RELATIONSHIPS (Crucial for Group List)
DO $$ 
BEGIN
    -- Ensure created_by exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prayer_groups' AND column_name = 'created_by') THEN
        ALTER TABLE public.prayer_groups ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add constraint to public.profiles specifically for the API join
    -- First drop it if it exists to be sure
    BEGIN
        ALTER TABLE public.prayer_groups DROP CONSTRAINT IF EXISTS prayer_groups_created_by_fkey_profiles;
    EXCEPTION WHEN undefined_object THEN NULL; END;

    -- Add the foreign key pointing explicitly to profiles to allow the join
    ALTER TABLE public.prayer_groups 
    ADD CONSTRAINT prayer_groups_created_by_fkey_profiles 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id);
END $$;

-- 3. FIX PROFILES COLUMNS (Crucial for Online Status)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_online') THEN
        ALTER TABLE public.profiles ADD COLUMN is_online BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen') THEN
        ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 4. FIX TRIGGER FUNCTION (Crucial for "Error sending DM")
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
    
    -- Create notification (Safely)
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (recipient_id, 'Nouveau message', 'Message de ' || COALESCE(sender_name, 'Utilisateur') || ': ' || LEFT(NEW.content, 50), 'message');
    
    -- Update conversation last message (Only if columns exist, but we added them above)
    UPDATE public.conversations 
    SET last_message_at = NOW(), last_message_preview = LEFT(NEW.content, 100)
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$;

-- 5. RE-CREATE TRIGGER
DROP TRIGGER IF EXISTS trigger_new_message_notification ON public.direct_messages;
CREATE TRIGGER trigger_new_message_notification
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- 6. FIX REALTIME PUBLICATIONS (Handle "already member" error)
DO $$
BEGIN
    -- Remove them first to be clean, ignoring errors if they aren't there
    BEGIN 
        ALTER PUBLICATION supabase_realtime DROP TABLE public.conversations; 
    EXCEPTION WHEN OTHERS THEN NULL; 
    END;
    BEGIN 
        ALTER PUBLICATION supabase_realtime DROP TABLE public.direct_messages; 
    EXCEPTION WHEN OTHERS THEN NULL; 
    END;
    BEGIN 
        ALTER PUBLICATION supabase_realtime DROP TABLE public.prayer_group_members; 
    EXCEPTION WHEN OTHERS THEN NULL; 
    END;
    BEGIN 
        ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications; 
    EXCEPTION WHEN OTHERS THEN NULL; 
    END;

    -- Now add them back
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_group_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
END $$;

-- 7. ENSURE PRAY RPC EXISTS (Crucial for "I prayed" button)
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
