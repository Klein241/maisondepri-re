-- 1. Table for group livestreams
CREATE TABLE IF NOT EXISTS group_livestreams (
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

-- 2. Table for livestream comments (Global live & Group lives)
CREATE TABLE IF NOT EXISTS livestream_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL, -- 'global-live' or UUID from group_livestreams
    user_id UUID NOT NULL, -- references profiles(id)
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table for livestream reactions (Global live & Group lives)
CREATE TABLE IF NOT EXISTS livestream_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL, -- 'global-live' or UUID from group_livestreams
    user_id UUID NOT NULL, -- references profiles(id)
    reaction TEXT NOT NULL, -- emoji string like '🔥', '🙏'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on Row Level Security (RLS)
ALTER TABLE group_livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_reactions ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
CREATE POLICY "Public read group_livestreams" ON group_livestreams FOR SELECT USING (true);
CREATE POLICY "Public read livestream_comments" ON livestream_comments FOR SELECT USING (true);
CREATE POLICY "Public read livestream_reactions" ON livestream_reactions FOR SELECT USING (true);

-- Allow all authenticated users to insert
CREATE POLICY "Auth insert group_livestreams" ON group_livestreams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert comments" ON livestream_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert reactions" ON livestream_reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update/delete their own stuff
CREATE POLICY "Users update group_livestreams" ON group_livestreams FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users delete group_livestreams" ON group_livestreams FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Users delete comments" ON livestream_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users delete reactions" ON livestream_reactions FOR DELETE USING (auth.uid() = user_id);

-- Create relationships (foreign keys)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_user') THEN
    ALTER TABLE livestream_comments ADD CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reactions_user') THEN
    ALTER TABLE livestream_reactions ADD CONSTRAINT fk_reactions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_group_lives_user') THEN
    ALTER TABLE group_livestreams ADD CONSTRAINT fk_group_lives_user FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
