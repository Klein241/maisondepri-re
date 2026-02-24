-- FIX: replay_comments & replay_reactions (idempotent — safe to re-execute)

-- 1. Tables
CREATE TABLE IF NOT EXISTS replay_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    replay_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES replay_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replay_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    replay_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Extra columns on live_replays
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS original_url TEXT;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 3. RLS
ALTER TABLE replay_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_reactions ENABLE ROW LEVEL SECURITY;

-- 4. Policies (DROP IF EXISTS first to avoid duplicate error)
DROP POLICY IF EXISTS "Anyone reads replay_comments" ON replay_comments;
DROP POLICY IF EXISTS "Auth insert replay_comments" ON replay_comments;
DROP POLICY IF EXISTS "User deletes own replay_comment" ON replay_comments;
DROP POLICY IF EXISTS "Anyone reads replay_reactions" ON replay_reactions;
DROP POLICY IF EXISTS "Auth insert replay_reactions" ON replay_reactions;
DROP POLICY IF EXISTS "User deletes own replay_reaction" ON replay_reactions;

CREATE POLICY "Anyone reads replay_comments"       ON replay_comments FOR SELECT USING (true);
CREATE POLICY "Auth insert replay_comments"        ON replay_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User deletes own replay_comment"    ON replay_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone reads replay_reactions"      ON replay_reactions FOR SELECT USING (true);
CREATE POLICY "Auth insert replay_reactions"       ON replay_reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User deletes own replay_reaction"   ON replay_reactions FOR DELETE USING (auth.uid() = user_id);

-- 5. Realtime (safe to re-add, errors are non-fatal)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE replay_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE replay_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_replay_comments_replay ON replay_comments(replay_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_replay_reactions_replay ON replay_reactions(replay_id);
