-- ===========================================
-- BIBLE FEATURES TABLES
-- ===========================================
-- Tables pour les favoris, surlignages et comparaisons de versets

-- Table des favoris bibliques
CREATE TABLE IF NOT EXISTS bible_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT 'lsg',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, reference, translation)
);

-- Index pour les favoris
CREATE INDEX IF NOT EXISTS idx_bible_favorites_user ON bible_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_bible_favorites_reference ON bible_favorites(reference);

-- Table des surlignages bibliques
CREATE TABLE IF NOT EXISTS bible_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT 'lsg',
    color TEXT NOT NULL DEFAULT 'yellow',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, reference, translation)
);

-- Index pour les surlignages
CREATE INDEX IF NOT EXISTS idx_bible_highlights_user ON bible_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_bible_highlights_reference ON bible_highlights(reference);

-- RLS Policies pour bible_favorites
ALTER TABLE bible_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorites" ON bible_favorites;
CREATE POLICY "Users can view their own favorites" ON bible_favorites
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON bible_favorites;
CREATE POLICY "Users can insert their own favorites" ON bible_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON bible_favorites;
CREATE POLICY "Users can delete their own favorites" ON bible_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies pour bible_highlights
ALTER TABLE bible_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own highlights" ON bible_highlights;
CREATE POLICY "Users can view their own highlights" ON bible_highlights
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own highlights" ON bible_highlights;
CREATE POLICY "Users can insert their own highlights" ON bible_highlights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own highlights" ON bible_highlights;
CREATE POLICY "Users can update their own highlights" ON bible_highlights
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own highlights" ON bible_highlights;
CREATE POLICY "Users can delete their own highlights" ON bible_highlights
    FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- PRAYER GROUP IMPROVEMENTS
-- ===========================================

-- Add status column to prayer_groups if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prayer_groups' AND column_name = 'status') THEN
        ALTER TABLE prayer_groups ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'answered'));
    END IF;
END $$;

-- Add closed_at column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prayer_groups' AND column_name = 'closed_at') THEN
        ALTER TABLE prayer_groups ADD COLUMN closed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add closed_by column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prayer_groups' AND column_name = 'closed_by') THEN
        ALTER TABLE prayer_groups ADD COLUMN closed_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Function to close group when prayer is answered
CREATE OR REPLACE FUNCTION close_group_on_prayer_answered()
RETURNS TRIGGER AS $$
BEGIN
    -- If prayer is marked as answered
    IF NEW.is_answered = true AND (OLD.is_answered = false OR OLD.is_answered IS NULL) THEN
        -- Close associated prayer group
        UPDATE prayer_groups 
        SET status = 'answered',
            closed_at = NOW(),
            is_open = false
        WHERE prayer_request_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_close_group_on_prayer_answered ON prayer_requests;
CREATE TRIGGER trigger_close_group_on_prayer_answered
    AFTER UPDATE ON prayer_requests
    FOR EACH ROW
    EXECUTE FUNCTION close_group_on_prayer_answered();

-- ===========================================
-- ADMIN BIBLE MANAGEMENT TABLES
-- ===========================================

-- Table for admin to manage Bible reading plans
CREATE TABLE IF NOT EXISTS bible_reading_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    passages JSONB NOT NULL DEFAULT '[]', -- Array of {reference, day}
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for user progress in reading plans
CREATE TABLE IF NOT EXISTS bible_reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES bible_reading_plans(id) ON DELETE CASCADE,
    completed_passages JSONB NOT NULL DEFAULT '[]', -- Array of reference strings
    current_day INTEGER DEFAULT 1,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, plan_id)
);

-- RLS for reading plans (public read, admin write)
ALTER TABLE bible_reading_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active reading plans" ON bible_reading_plans;
CREATE POLICY "Anyone can view active reading plans" ON bible_reading_plans
    FOR SELECT USING (is_active = true OR auth.uid() IN (
        SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')
    ));

-- RLS for reading progress
ALTER TABLE bible_reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own progress" ON bible_reading_progress;
CREATE POLICY "Users can manage their own progress" ON bible_reading_progress
    FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

GRANT ALL ON bible_favorites TO authenticated;
GRANT ALL ON bible_highlights TO authenticated;
GRANT SELECT ON bible_reading_plans TO authenticated;
GRANT ALL ON bible_reading_progress TO authenticated;

SELECT 'Bible features tables created successfully!' as result;
