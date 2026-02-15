-- =====================================================
-- FIX: Prayer Group Members - Allow group admin to add members
-- This fixes the issue where the group creator cannot add (invite) friends
-- Execute this in Supabase SQL Editor
-- =====================================================

-- Drop existing restrictive policy for joining
DROP POLICY IF EXISTS "Users can join groups" ON prayer_group_members;

-- Updated policy: Users can join themselves OR admins can add members
CREATE POLICY "Users can join groups" ON prayer_group_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = prayer_group_members.group_id 
            AND pgm.user_id = auth.uid() 
            AND pgm.role = 'admin'
        )
    );

-- Also ensure admins can manage (insert/update/delete) members
DROP POLICY IF EXISTS "Admins can manage members" ON prayer_group_members;
CREATE POLICY "Admins can manage members" ON prayer_group_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = prayer_group_members.group_id 
            AND pgm.user_id = auth.uid() 
            AND pgm.role = 'admin'
        )
    );

-- Ensure the notification action_type 'group_invitation' can be used
-- (notifications table already allows any string for action_type)

SELECT 'Group member invite policies updated!' AS status;
