-- ============================================================
-- Migration: Group Chat Features — Comments, Reactions, Downloads
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add 'reactions' and 'comment_count' columns to prayer_group_messages
ALTER TABLE prayer_group_messages
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- 2. Add 'reactions' and 'comment_count' to direct_messages too
ALTER TABLE direct_messages
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- 3. Create the thread comments table (if not exists)
CREATE TABLE IF NOT EXISTS prayer_group_message_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL,
    group_id UUID,
    user_id UUID NOT NULL,
    sender_name TEXT DEFAULT 'Membre',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_comments_message_id 
ON prayer_group_message_comments(message_id);

CREATE INDEX IF NOT EXISTS idx_comments_group_id 
ON prayer_group_message_comments(group_id);

-- 4. Enable Realtime — skip if already added (safe)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_message_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. RLS policies for comments
ALTER TABLE prayer_group_message_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read comments" ON prayer_group_message_comments;
    DROP POLICY IF EXISTS "Users can insert comments" ON prayer_group_message_comments;
    DROP POLICY IF EXISTS "Users can delete own comments" ON prayer_group_message_comments;
END $$;

CREATE POLICY "Users can read comments" 
ON prayer_group_message_comments FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can insert comments" 
ON prayer_group_message_comments FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" 
ON prayer_group_message_comments FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 6. Enable Realtime for UPDATE on prayer_group_messages (for reactions sync)
ALTER TABLE prayer_group_messages REPLICA IDENTITY FULL;

-- 7. Add scheduled_at to library_books (for scheduled publication)
ALTER TABLE library_books
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- 8. Add is_open to prayer_groups (for auto-close after 24h)
ALTER TABLE prayer_groups
ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

-- 9. Create library_ads table (for advertising system)
CREATE TABLE IF NOT EXISTS library_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    link_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    placement TEXT DEFAULT 'book_detail',
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add scheduling columns if table already existed
ALTER TABLE library_ads
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;

-- RLS for library_ads
ALTER TABLE library_ads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can read ads" ON library_ads;
    DROP POLICY IF EXISTS "Authenticated can manage ads" ON library_ads;
END $$;

CREATE POLICY "Anyone can read ads"
ON library_ads FOR SELECT
USING (true);

CREATE POLICY "Authenticated can manage ads"
ON library_ads FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
