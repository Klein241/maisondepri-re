-- =====================================================
-- BIBLE FEATURES TABLES
-- Favoris et Surlignages Bibliques
-- =====================================================

-- Table des favoris bibliques
CREATE TABLE IF NOT EXISTS bible_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT 'lsg',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(user_id, reference, translation)
);

-- Table des surlignages bibliques  
CREATE TABLE IF NOT EXISTS bible_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT 'lsg',
    color TEXT NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple', 'orange')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(user_id, reference, translation)
);

-- Enable RLS
ALTER TABLE bible_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bible_favorites
CREATE POLICY "bf_select_own" ON bible_favorites
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "bf_insert_own" ON bible_favorites
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bf_update_own" ON bible_favorites
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "bf_delete_own" ON bible_favorites
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for bible_highlights
CREATE POLICY "bh_select_own" ON bible_highlights
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "bh_insert_own" ON bible_highlights
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "bh_update_own" ON bible_highlights
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "bh_delete_own" ON bible_highlights
    FOR DELETE USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bible_favorites_user ON bible_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_bible_highlights_user ON bible_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_bible_favorites_reference ON bible_favorites(reference);
CREATE INDEX IF NOT EXISTS idx_bible_highlights_reference ON bible_highlights(reference);

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('bible_favorites', 'bible_highlights')
ORDER BY table_name, ordinal_position;
