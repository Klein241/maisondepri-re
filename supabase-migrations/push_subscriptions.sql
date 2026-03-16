-- ═══════════════════════════════════════════════════
-- Push Subscriptions table for Web Push Notifications
-- Stores Web Push API subscriptions per user per device
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,   -- Browser public key
    auth TEXT NOT NULL,     -- Browser auth secret
    user_agent TEXT,
    device_name TEXT,       -- e.g. "Chrome Android", "Firefox Desktop"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
    ON push_subscriptions FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Service role can read all subscriptions"
    ON push_subscriptions FOR SELECT
    USING (true); -- Worker uses service_role key

-- Function to clean up stale subscriptions (called by Worker on push failure)
CREATE OR REPLACE FUNCTION deactivate_push_subscription(sub_endpoint TEXT)
RETURNS void AS $$
BEGIN
    UPDATE push_subscriptions
    SET is_active = FALSE, updated_at = NOW()
    WHERE endpoint = sub_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
