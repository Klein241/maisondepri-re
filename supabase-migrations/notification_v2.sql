-- ══════════════════════════════════════════════════════════
-- 🔔 NOTIFICATION SYSTEM V2 — COMPLETE MIGRATION
-- ══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor
-- Upgrades notifications table + adds preferences, push_tokens, 
-- prayer_comments tables, and indexes.
-- ══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. UPGRADE notifications TABLE
-- ═══════════════════════════════════════════

-- Add new columns to existing notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS action_data JSONB,
ADD COLUMN IF NOT EXISTS actors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS actor_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS aggregation_key TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Expand the type CHECK constraint to include new types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('info', 'success', 'warning', 'error', 'prayer', 'testimony', 'message', 'friend_request'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_aggregation_key ON public.notifications(aggregation_key) WHERE aggregation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_action_type ON public.notifications(action_type);

-- ═══════════════════════════════════════════
-- 2. notification_preferences TABLE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    in_app BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, action_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own preferences" ON public.notification_preferences;
CREATE POLICY "View own preferences" ON public.notification_preferences 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own preferences" ON public.notification_preferences;
CREATE POLICY "Update own preferences" ON public.notification_preferences 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert own preferences" ON public.notification_preferences;
CREATE POLICY "Insert own preferences" ON public.notification_preferences 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow service role (Cloudflare Worker) to manage preferences
DROP POLICY IF EXISTS "Service role manage preferences" ON public.notification_preferences;
CREATE POLICY "Service role manage preferences" ON public.notification_preferences 
FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(user_id);

-- ═══════════════════════════════════════════
-- 3. push_tokens TABLE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_json TEXT NOT NULL,
    platform TEXT DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios', 'expo')),
    device_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own tokens" ON public.push_tokens;
CREATE POLICY "View own tokens" ON public.push_tokens 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage own tokens" ON public.push_tokens;
CREATE POLICY "Manage own tokens" ON public.push_tokens 
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role access
DROP POLICY IF EXISTS "Service role manage tokens" ON public.push_tokens;
CREATE POLICY "Service role manage tokens" ON public.push_tokens 
FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

-- ═══════════════════════════════════════════
-- 4. prayer_comments TABLE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prayer_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.prayer_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.prayer_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View prayer comments" ON public.prayer_comments;
CREATE POLICY "View prayer comments" ON public.prayer_comments 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Create prayer comments" ON public.prayer_comments;
CREATE POLICY "Create prayer comments" ON public.prayer_comments 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own comments" ON public.prayer_comments;
CREATE POLICY "Delete own comments" ON public.prayer_comments 
FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prayer_comments_prayer ON public.prayer_comments(prayer_id);
CREATE INDEX IF NOT EXISTS idx_prayer_comments_user ON public.prayer_comments(user_id);

-- ═══════════════════════════════════════════
-- 5. ADD pray_count TO prayer_requests IF MISSING  
-- ═══════════════════════════════════════════

ALTER TABLE public.prayer_requests 
ADD COLUMN IF NOT EXISTS pray_count INTEGER DEFAULT 0;

-- ═══════════════════════════════════════════
-- 6. Enable Realtime for new tables
-- ═══════════════════════════════════════════

-- notification_preferences doesn't need realtime
-- push_tokens doesn't need realtime  
-- prayer_comments needs realtime for live comment updates
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_comments;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Already added
END $$;

-- Ensure notifications realtime is enabled
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Already added
END $$;

-- ═══════════════════════════════════════════
-- 7. HELPER: Initial preferences for new users
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.init_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notification_preferences (user_id, action_type, in_app, push_enabled)
    VALUES
        (NEW.id, 'prayer_prayed',           true, true),
        (NEW.id, 'friend_prayed',           true, false),
        (NEW.id, 'new_prayer_published',    true, false),
        (NEW.id, 'prayer_comment',          true, true),
        (NEW.id, 'prayer_no_response',      false, true),
        (NEW.id, 'group_access_request',    true, true),
        (NEW.id, 'group_access_approved',   true, true),
        (NEW.id, 'group_new_message',       true, true),
        (NEW.id, 'admin_new_group',         true, true),
        (NEW.id, 'group_invitation',        true, true),
        (NEW.id, 'group_mention',           true, true),
        (NEW.id, 'dm_new_message',          true, true),
        (NEW.id, 'friend_request_received', true, true),
        (NEW.id, 'friend_request_accepted', true, false)
    ON CONFLICT (user_id, action_type) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on profile creation (after auth.users trigger creates profile)
DROP TRIGGER IF EXISTS trigger_init_notif_prefs ON public.profiles;
CREATE TRIGGER trigger_init_notif_prefs
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.init_notification_preferences();

-- ═══════════════════════════════════════════
-- 8. HELPER: Delete old notifications (cleanup) — older than 30 days
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.notifications 
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_read = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════
-- 9. Backfill: Insert default preferences for existing users
-- ═══════════════════════════════════════════

INSERT INTO public.notification_preferences (user_id, action_type, in_app, push_enabled)
SELECT p.id, t.action_type, t.in_app, t.push_enabled
FROM public.profiles p
CROSS JOIN (
    VALUES
        ('prayer_prayed',           true, true),
        ('friend_prayed',           true, false),
        ('new_prayer_published',    true, false),
        ('prayer_comment',          true, true),
        ('prayer_no_response',      false, true),
        ('group_access_request',    true, true),
        ('group_access_approved',   true, true),
        ('group_new_message',       true, true),
        ('admin_new_group',         true, true),
        ('group_invitation',        true, true),
        ('group_mention',           true, true),
        ('dm_new_message',          true, true),
        ('friend_request_received', true, true),
        ('friend_request_accepted', true, false)
) AS t(action_type, in_app, push_enabled)
ON CONFLICT (user_id, action_type) DO NOTHING;

-- ═══════════════════════════════════════════
-- DONE! Refresh schema cache
-- ═══════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

SELECT '✅ NOTIFICATION V2 MIGRATION COMPLETE' as result;
