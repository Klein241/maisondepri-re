-- ============================================================
-- FIX: livestream_id doit être TEXT (pas UUID) car on utilise 'global-live'
-- ============================================================

-- 1. Drop old tables if they have wrong column types and recreate them
DROP TABLE IF EXISTS livestream_reactions CASCADE;
DROP TABLE IF EXISTS livestream_comments CASCADE;
DROP TABLE IF EXISTS group_livestreams CASCADE;

-- 2. Recreate group_livestreams
CREATE TABLE group_livestreams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL,
    created_by UUID NOT NULL,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    embed_url TEXT,
    embed_code TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Recreate livestream_comments with TEXT livestream_id
CREATE TABLE livestream_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL,       -- TEXT pas UUID ! ('global-live' ou un UUID)
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES livestream_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recreate livestream_reactions with TEXT livestream_id
CREATE TABLE livestream_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL,       -- TEXT pas UUID !
    user_id UUID NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create admin_notifications table (manquant → erreur 404)
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,                -- 'new_user', 'report', 'contact', etc.
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Fix direct_messages: add 'read' column if missing
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 7. Enable RLS on all tables
ALTER TABLE group_livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies — livestream_comments
CREATE POLICY "Anyone can read comments" ON livestream_comments FOR SELECT USING (true);
CREATE POLICY "Auth users insert comments" ON livestream_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own comments" ON livestream_comments FOR DELETE USING (auth.uid() = user_id);

-- 9. RLS Policies — livestream_reactions
CREATE POLICY "Anyone can read reactions" ON livestream_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users insert reactions" ON livestream_reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own reactions" ON livestream_reactions FOR DELETE USING (auth.uid() = user_id);

-- 10. RLS Policies — group_livestreams
CREATE POLICY "Anyone can read group_livestreams" ON group_livestreams FOR SELECT USING (true);
CREATE POLICY "Auth users create group_livestreams" ON group_livestreams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creator can update group_livestreams" ON group_livestreams FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete group_livestreams" ON group_livestreams FOR DELETE USING (auth.uid() = created_by);

-- 11. RLS Policies — admin_notifications
CREATE POLICY "Admins read notifications" ON admin_notifications FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "System insert notifications" ON admin_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins update notifications" ON admin_notifications FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 12. Enable realtime on livestream tables
ALTER PUBLICATION supabase_realtime ADD TABLE livestream_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE livestream_reactions;

-- 13. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_livestream ON livestream_comments(livestream_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_livestream ON livestream_reactions(livestream_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_notifs ON admin_notifications(is_read, created_at DESC);
