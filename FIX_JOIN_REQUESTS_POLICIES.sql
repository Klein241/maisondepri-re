-- ======================================================
-- FIX: Prayer Group Join Requests Policies
-- Run this in your Supabase SQL Editor
-- ======================================================

-- First, drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view their own join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Group admins can view join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Group admins can update join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Group creators can view join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Group creators can update join requests" ON prayer_group_join_requests;

-- Policy 1: Users can view their own join requests
CREATE POLICY "Users can view their own join requests"
    ON prayer_group_join_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Policy 2: Group admins AND creators can view join requests
CREATE POLICY "Group admins can view join requests"
    ON prayer_group_join_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_join_requests.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'moderator')
        )
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = prayer_group_join_requests.group_id
            AND pg.created_by = auth.uid()
        )
    );

-- Policy 3: Users can create join requests for groups they're not in
CREATE POLICY "Users can create join requests"
    ON prayer_group_join_requests FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND NOT EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_join_requests.group_id
            AND pgm.user_id = auth.uid()
        )
    );

-- Policy 4: Group admins AND creators can update join requests
CREATE POLICY "Group admins can update join requests"
    ON prayer_group_join_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_join_requests.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'moderator')
        )
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = prayer_group_join_requests.group_id
            AND pg.created_by = auth.uid()
        )
    );

-- Policy 5: Allow users to delete their own pending requests
CREATE POLICY "Users can delete their own pending requests"
    ON prayer_group_join_requests FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');

-- Policy 6: Allow group admins/creators to delete requests
CREATE POLICY "Admins can delete requests"
    ON prayer_group_join_requests FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_join_requests.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'moderator')
        )
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = prayer_group_join_requests.group_id
            AND pg.created_by = auth.uid()
        )
    );

-- GRANT permissions
GRANT ALL ON prayer_group_join_requests TO authenticated;

-- ======================================================
-- Also fix prayer_group_members policies
-- ======================================================

-- Allow group admins to add new members directly (for approving requests)
DROP POLICY IF EXISTS "Admins can add members" ON prayer_group_members;
CREATE POLICY "Admins can add members"
    ON prayer_group_members FOR INSERT
    WITH CHECK (
        -- Either joining an open group
        EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = prayer_group_members.group_id
            AND pg.is_open = true
            AND auth.uid() = prayer_group_members.user_id
        )
        OR
        -- Or being added by an admin
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = prayer_group_members.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'moderator')
        )
        OR
        -- Or being added by the group creator
        EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = prayer_group_members.group_id
            AND pg.created_by = auth.uid()
        )
        OR
        -- Or the creator is joining their own group
        EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = prayer_group_members.group_id
            AND pg.created_by = prayer_group_members.user_id
            AND auth.uid() = prayer_group_members.user_id
        )
    );

-- Verify the table exists and has correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'prayer_group_join_requests';
