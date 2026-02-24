-- ============================================================
-- SALONS VOCAUX (Discord/PTT style)
-- ============================================================

-- Table: salons (one permanent salon per group)
CREATE TABLE IF NOT EXISTS salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Salon vocal',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id)
);

-- Table: salon_membres_actifs (who is currently in the salon)
CREATE TABLE IF NOT EXISTS salon_membres_actifs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_speaking BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(salon_id, user_id)
);

-- Enable RLS
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_membres_actifs ENABLE ROW LEVEL SECURITY;

-- Salons: group members can read, admins/creators can insert
DROP POLICY IF EXISTS "Group members can view salons" ON salons;
CREATE POLICY "Group members can view salons" ON salons
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can create salon" ON salons;
CREATE POLICY "Anyone can create salon" ON salons
    FOR INSERT TO authenticated WITH CHECK (true);

-- Salon membres: anyone can read/manage their own presence
DROP POLICY IF EXISTS "Anyone can view salon members" ON salon_membres_actifs;
CREATE POLICY "Anyone can view salon members" ON salon_membres_actifs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can join salons" ON salon_membres_actifs;
CREATE POLICY "Users can join salons" ON salon_membres_actifs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presence" ON salon_membres_actifs;
CREATE POLICY "Users can update own presence" ON salon_membres_actifs
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave salons" ON salon_membres_actifs;
CREATE POLICY "Users can leave salons" ON salon_membres_actifs
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable Realtime for live presence updates
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE salons;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE salon_membres_actifs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
