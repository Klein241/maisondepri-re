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

-- 3. Create the thread comments table
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

-- 4. Enable Realtime on key tables (for reactions & comments sync)
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_message_comments;

-- Make sure prayer_group_messages is also in realtime (for UPDATE events)
-- This may already exist, so we use a DO block to handle errors
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
EXCEPTION WHEN duplicate_object THEN
    -- Already added, ignore
    NULL;
END $$;

-- 5. RLS policies for comments — anyone in the group can read/write
ALTER TABLE prayer_group_message_comments ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can read comments
CREATE POLICY "Users can read comments" 
ON prayer_group_message_comments FOR SELECT 
TO authenticated 
USING (true);

-- Insert: authenticated users can add comments
CREATE POLICY "Users can insert comments" 
ON prayer_group_message_comments FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Delete: users can delete their own comments
CREATE POLICY "Users can delete own comments" 
ON prayer_group_message_comments FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 6. Enable Realtime for UPDATE on prayer_group_messages (needed for reactions sync)
-- This ensures reaction changes propagate to all group members
ALTER TABLE prayer_group_messages REPLICA IDENTITY FULL;
