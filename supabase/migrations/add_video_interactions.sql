-- FIX: video_comments & video_reactions (idempotent — safe to re-execute)

-- 1. Tables
CREATE TABLE IF NOT EXISTS video_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES video_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_reactions ENABLE ROW LEVEL SECURITY;

-- 3. Policies (DROP IF EXISTS first to avoid duplicate error)
DROP POLICY IF EXISTS "Anyone reads video_comments"      ON video_comments;
DROP POLICY IF EXISTS "Auth insert video_comments"       ON video_comments;
DROP POLICY IF EXISTS "User delete own video_comment"    ON video_comments;
DROP POLICY IF EXISTS "Anyone reads video_reactions"     ON video_reactions;
DROP POLICY IF EXISTS "Auth insert video_reactions"      ON video_reactions;
DROP POLICY IF EXISTS "User delete own video_reaction"   ON video_reactions;

CREATE POLICY "Anyone reads video_comments"      ON video_comments FOR SELECT USING (true);
CREATE POLICY "Auth insert video_comments"       ON video_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User delete own video_comment"    ON video_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone reads video_reactions"     ON video_reactions FOR SELECT USING (true);
CREATE POLICY "Auth insert video_reactions"      ON video_reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User delete own video_reaction"   ON video_reactions FOR DELETE USING (auth.uid() = user_id);

-- 4. Realtime (safe, wrapped in DO block)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE video_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE video_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(video_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_video_reactions_video ON video_reactions(video_id);
