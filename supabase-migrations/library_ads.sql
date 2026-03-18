-- ═══════════════════════════════════════════════════════════
-- ADVERTISING SPACE — Configurable from Admin Backoffice
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS library_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    link_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Anyone can read active ads, only admins can manage
ALTER TABLE library_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active ads" ON library_ads;
CREATE POLICY "Anyone can read active ads" ON library_ads
    FOR SELECT USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "Service role manages ads" ON library_ads;
CREATE POLICY "Service role manages ads" ON library_ads
    FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_library_ads_active ON library_ads(is_active, display_order);
