-- ============================================================
-- Migration: Push notification tables + preferences
-- Required by: notification-worker (Cloudflare)
-- Run this BEFORE deploying the worker
-- ============================================================

-- ══════════════ push_tokens ══════════════
-- Stores Web Push subscriptions per user
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_json TEXT NOT NULL,
    platform TEXT DEFAULT 'web',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Worker uses service_role key, but users should be able to see their own
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
CREATE POLICY "Users can view own push tokens" ON push_tokens
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own push tokens" ON push_tokens;
CREATE POLICY "Users can manage own push tokens" ON push_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- ══════════════ notification_preferences ══════════════
-- Per-user notification preferences (in-app / push toggles)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    in_app BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, action_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON notification_preferences;
CREATE POLICY "Users can view own preferences" ON notification_preferences
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own preferences" ON notification_preferences;
CREATE POLICY "Users can manage own preferences" ON notification_preferences
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- ══════════════ prayer_comments ══════════════
-- Threaded comments on prayers
CREATE TABLE IF NOT EXISTS prayer_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prayer_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES prayer_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prayer_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view prayer comments" ON prayer_comments;
CREATE POLICY "Anyone can view prayer comments" ON prayer_comments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can add comments" ON prayer_comments;
CREATE POLICY "Users can add comments" ON prayer_comments
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own comments" ON prayer_comments;
CREATE POLICY "Users can delete own comments" ON prayer_comments
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ══════════════ Add columns to notifications ══════════════
-- Worker v2 columns for aggregation and preferences
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_data TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actors TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_count INTEGER DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS aggregation_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for aggregation lookups
CREATE INDEX IF NOT EXISTS idx_notifications_agg_key ON notifications(aggregation_key) WHERE aggregation_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

-- ══════════════ Realtime ══════════════
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE push_tokens;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification_preferences;
EXCEPTION WHEN others THEN NULL;
END $$;
