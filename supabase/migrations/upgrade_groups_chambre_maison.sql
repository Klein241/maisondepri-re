-- ================================================================
-- CHAMBRE HAUTE 🚪 & MAISON DE PRIÈRE 🏠 - Schema Upgrade
-- ================================================================
-- Adds group_type, auto-close, community features to prayer_groups
-- ================================================================

-- Add new columns to prayer_groups
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS group_type TEXT DEFAULT 'chambre_haute' CHECK (group_type IN ('chambre_haute', 'maison_de_priere'));
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMPTZ;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS parent_community_id UUID REFERENCES prayer_groups(id) ON DELETE SET NULL;

-- Index for parent community lookups
CREATE INDEX IF NOT EXISTS idx_prayer_groups_parent ON prayer_groups(parent_community_id);
CREATE INDEX IF NOT EXISTS idx_prayer_groups_type ON prayer_groups(group_type);

-- Function: Auto-close Chambre Haute 7 days after prayer marked answered
CREATE OR REPLACE FUNCTION auto_close_chambre_haute()
RETURNS TRIGGER AS $$
BEGIN
    -- When a prayer request is marked as answered
    IF NEW.is_answered = true AND OLD.is_answered = false THEN
        -- Find and schedule close for linked Chambre Haute groups
        UPDATE prayer_groups
        SET auto_close_at = NOW() + INTERVAL '7 days'
        WHERE prayer_request_id = NEW.id
        AND group_type = 'chambre_haute'
        AND is_closed = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: When prayer_request is_answered changes
DROP TRIGGER IF EXISTS trigger_auto_close_chambre ON prayer_requests;
CREATE TRIGGER trigger_auto_close_chambre
    AFTER UPDATE OF is_answered ON prayer_requests
    FOR EACH ROW
    EXECUTE FUNCTION auto_close_chambre_haute();

-- Function: Actually close groups past their auto_close_at date
-- (Call this via a cron or periodic check)
CREATE OR REPLACE FUNCTION close_expired_chambres()
RETURNS void AS $$
BEGIN
    UPDATE prayer_groups
    SET is_closed = true
    WHERE group_type = 'chambre_haute'
    AND auto_close_at IS NOT NULL
    AND auto_close_at <= NOW()
    AND is_closed = false;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- DONE!
-- group_type: 'chambre_haute' (temporary, prayer-linked)
--             'maison_de_priere' (permanent community)
-- auto_close_at: set 7 days after prayer answered
-- is_closed: true when group is archived
-- photo_url: community profile picture
-- is_public: public/private toggle
-- parent_community_id: links sub-groups to a parent Maison de Prière
-- ================================================================
