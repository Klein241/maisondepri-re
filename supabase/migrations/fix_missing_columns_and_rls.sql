-- ================================================================
-- FIX ALL MISSING COLUMNS & RLS ERRORS
-- ================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Fixes:
--   1) "Could not find the 'type' column of 'direct_messages'"
--   2) "Could not find the 'type' column of 'prayer_group_messages'"
--   3) "Could not find the 'image_url' column of 'direct_messages'"
--   4) "group_prayer_counter" RLS violation (403)
--   5) "prayer_group_members" INSERT 403 (when creator adds others)
-- ================================================================

-- ==========================================
-- 1. ADD MISSING COLUMNS TO direct_messages
-- ==========================================

-- Message type: 'text', 'voice', 'image', 'file', 'broadcast'
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';

-- Voice message support
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER;

-- File attachment support
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Image support
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Reply support
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to UUID;

-- ==========================================
-- 2. ADD MISSING COLUMNS TO prayer_group_messages
-- ==========================================

-- Message type: 'text', 'voice', 'image', 'file', 'broadcast'
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';

-- Voice message support
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS voice_duration INTEGER;

-- File attachment support
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Image support
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Reply support
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS reply_to UUID;

-- ==========================================
-- 3. CREATE group_prayer_counter TABLE (if not exists)
-- ==========================================

CREATE TABLE IF NOT EXISTS group_prayer_counter (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    count INTEGER DEFAULT 0,
    last_prayer_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id)
);

ALTER TABLE group_prayer_counter ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view prayer counts" ON group_prayer_counter;
DROP POLICY IF EXISTS "Members can upsert prayer counts" ON group_prayer_counter;
DROP POLICY IF EXISTS "group_prayer_counter_select" ON group_prayer_counter;
DROP POLICY IF EXISTS "group_prayer_counter_insert" ON group_prayer_counter;
DROP POLICY IF EXISTS "group_prayer_counter_update" ON group_prayer_counter;

-- SELECT: anyone authenticated can view
CREATE POLICY "Anyone can view prayer counts"
ON group_prayer_counter FOR SELECT
TO authenticated
USING (true);

-- INSERT: members of the group can insert
CREATE POLICY "Members can insert prayer counts"
ON group_prayer_counter FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = group_prayer_counter.group_id
        AND prayer_group_members.user_id = auth.uid()
    )
);

-- UPDATE: members of the group can update
CREATE POLICY "Members can update prayer counts"
ON group_prayer_counter FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = group_prayer_counter.group_id
        AND prayer_group_members.user_id = auth.uid()
    )
);

-- ==========================================
-- 4. FIX prayer_group_members INSERT policy
-- Allow group creators to add OTHER members (not just self)
-- ==========================================

DROP POLICY IF EXISTS "Users can join or be added to groups" ON prayer_group_members;

CREATE POLICY "Users can join or be added to groups"
ON prayer_group_members FOR INSERT
TO authenticated
WITH CHECK (
    -- User can add themselves (join)
    auth.uid() = user_id
    -- OR user is admin of the group (can add others)
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid()
        AND pgm.role = 'admin'
    )
    -- OR user is the group creator (for initial member adds)
    OR EXISTS (
        SELECT 1 FROM prayer_groups
        WHERE prayer_groups.id = prayer_group_members.group_id
        AND prayer_groups.created_by = auth.uid()
    )
);

-- ==========================================
-- 5. ADD is_online and last_seen to profiles (if missing)
-- ==========================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- ==========================================
-- 6. GRANT realtime access for new columns
-- ==========================================

-- Ensure realtime is enabled for the tables with new columns
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_prayer_counter;

-- ==========================================
-- DONE! All errors should now be fixed:
-- ✅ direct_messages: type, voice_url, voice_duration, file_url, file_name, file_type, image_url, reply_to
-- ✅ prayer_group_messages: type, voice_url, voice_duration, file_url, file_name, file_type, image_url, reply_to
-- ✅ group_prayer_counter: table + RLS policies
-- ✅ prayer_group_members: INSERT policy includes group creator
-- ✅ profiles: is_online, last_seen
-- ==========================================
