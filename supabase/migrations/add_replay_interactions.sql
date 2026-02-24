-- Add missing columns to live_replays & add replay interactions tables

-- 1. Add original_url column to live_replays (to store the clean original URL)
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS original_url TEXT;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Table for replay comments (uses replay UUID as reference)
CREATE TABLE IF NOT EXISTS replay_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    replay_id UUID NOT NULL,  -- references live_replays(id)
    user_id UUID NOT NULL,    -- references profiles(id)
    content TEXT NOT NULL,
    parent_id UUID REFERENCES replay_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table for replay reactions
CREATE TABLE IF NOT EXISTS replay_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    replay_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE replay_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_reactions ENABLE ROW LEVEL SECURITY;

-- 5. Policies for replay_comments
CREATE POLICY "Anyone reads replay_comments" ON replay_comments FOR SELECT USING (true);
CREATE POLICY "Auth insert replay_comments" ON replay_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User deletes own replay_comment" ON replay_comments FOR DELETE USING (auth.uid() = user_id);

-- 6. Policies for replay_reactions
CREATE POLICY "Anyone reads replay_reactions" ON replay_reactions FOR SELECT USING (true);
CREATE POLICY "Auth insert replay_reactions" ON replay_reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "User deletes own replay_reaction" ON replay_reactions FOR DELETE USING (auth.uid() = user_id);

-- 7. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE replay_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE replay_reactions;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_replay_comments_replay ON replay_comments(replay_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_replay_reactions_replay ON replay_reactions(replay_id);
