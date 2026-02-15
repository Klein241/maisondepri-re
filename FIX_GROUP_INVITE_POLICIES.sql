-- =====================================================
-- FIX: Infinite recursion in RLS policies for prayer_group_members
-- and prayer_group_join_requests
-- 
-- Problem: Policies on prayer_group_members reference prayer_group_members
-- in their CHECK clause, causing infinite recursion.
--
-- Solution: Check ownership via prayer_groups.created_by instead.
-- Execute this in Supabase SQL Editor IMMEDIATELY.
-- =====================================================

-- ===== FIX prayer_group_members policies =====

-- Drop ALL existing policies to start clean
DROP POLICY IF EXISTS "Users can view group members" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON prayer_group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON prayer_group_members;

-- 1. Everyone can VIEW members (needed for member counts)
CREATE POLICY "Users can view group members" ON prayer_group_members
    FOR SELECT USING (true);

-- 2. Users can INSERT themselves OR group creators can add anyone (invites)
CREATE POLICY "Users can join groups" ON prayer_group_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = prayer_group_members.group_id 
            AND pg.created_by = auth.uid()
        )
    );

-- 3. Users can DELETE their own membership (leave group)
CREATE POLICY "Users can leave groups" ON prayer_group_members
    FOR DELETE USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = prayer_group_members.group_id 
            AND pg.created_by = auth.uid()
        )
    );

-- 4. Group creators can update member roles
DROP POLICY IF EXISTS "Creators can update members" ON prayer_group_members;
CREATE POLICY "Creators can update members" ON prayer_group_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = prayer_group_members.group_id 
            AND pg.created_by = auth.uid()
        )
    );

-- ===== FIX prayer_group_join_requests policies =====

DROP POLICY IF EXISTS "Users can view own requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Admins can view group requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON prayer_group_join_requests;

-- 1. Users can see their own requests + group creators can see all requests for their groups
CREATE POLICY "Users can view own requests" ON prayer_group_join_requests
    FOR SELECT USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = prayer_group_join_requests.group_id 
            AND pg.created_by = auth.uid()
        )
    );

-- 2. Users can create join requests for themselves
CREATE POLICY "Users can create join requests" ON prayer_group_join_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Group creators can update (approve/reject) requests
CREATE POLICY "Creators can update requests" ON prayer_group_join_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = prayer_group_join_requests.group_id 
            AND pg.created_by = auth.uid()
        )
    );

-- 4. Users can delete their own requests + creators can delete any
DROP POLICY IF EXISTS "Users can delete requests" ON prayer_group_join_requests;
CREATE POLICY "Users can delete requests" ON prayer_group_join_requests
    FOR DELETE USING (
        auth.uid() = user_id
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = prayer_group_join_requests.group_id 
            AND pg.created_by = auth.uid()
        )
    );

SELECT 'RLS infinite recursion fix applied!' AS status;
