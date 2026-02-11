-- ======================================================
-- Prayer Marathon App - Database Schema Updates
-- ======================================================

-- Add is_urgent column to prayer_groups if not exists
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;

-- Add prayer_request_id to prayer_groups for linking
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS prayer_request_id UUID REFERENCES prayer_requests(id) ON DELETE SET NULL;

-- Add is_answered and answered_at to prayer_requests if not exists
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS is_answered BOOLEAN DEFAULT FALSE;
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Add prayer_request_id to testimonials for linking
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS prayer_request_id UUID REFERENCES prayer_requests(id) ON DELETE SET NULL;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;

-- Create join requests table
CREATE TABLE IF NOT EXISTS prayer_group_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Add message type and media columns to direct_messages
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'voice', 'image'));
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add message type and media columns to prayer_group_messages
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'voice', 'image'));
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add online status columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Add read_by array to group messages
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT ARRAY[]::UUID[];

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prayer_groups_prayer_request ON prayer_groups(prayer_request_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_answered ON prayer_requests(is_answered);
CREATE INDEX IF NOT EXISTS idx_testimonials_prayer_request ON testimonials(prayer_request_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_group ON prayer_group_join_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON prayer_group_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(is_online);

-- Enable RLS on new table
ALTER TABLE prayer_group_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for join requests
CREATE POLICY "Users can view their own join requests"
    ON prayer_group_join_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Group admins can view join requests"
    ON prayer_group_join_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_join_requests.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'moderator')
        )
    );

CREATE POLICY "Users can create join requests"
    ON prayer_group_join_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Group admins can update join requests"
    ON prayer_group_join_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_join_requests.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'moderator')
        )
    );

-- Function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for join requests updated_at
DROP TRIGGER IF EXISTS update_join_requests_updated_at ON prayer_group_join_requests;
CREATE TRIGGER update_join_requests_updated_at
    BEFORE UPDATE ON prayer_group_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ======================================================
-- Run this in Supabase SQL Editor
-- ======================================================
