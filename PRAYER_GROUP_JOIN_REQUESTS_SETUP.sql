-- ============================================
-- Prayer Group Join Requests Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add requires_approval column to prayer_groups
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS closed_reason TEXT;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- 2. Create prayer_group_join_requests table
CREATE TABLE IF NOT EXISTS prayer_group_join_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES prayer_groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, user_id) -- Prevent duplicate requests
);

-- 3. Enable RLS
ALTER TABLE prayer_group_join_requests ENABLE ROW LEVEL SECURITY;

-- 4. Clean up existing policies
DROP POLICY IF EXISTS "Users can see own requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Group creators can see requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Users can create requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Group creators can update requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Anyone can view requests" ON prayer_group_join_requests;

-- 5. Create policies
-- Users can see their own requests
CREATE POLICY "Users can see own requests" ON prayer_group_join_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Group creators can see requests for their groups
CREATE POLICY "Group creators can see requests" ON prayer_group_join_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prayer_groups 
            WHERE id = prayer_group_join_requests.group_id 
            AND created_by = auth.uid()
        )
    );

-- Users can create join requests
CREATE POLICY "Users can create requests" ON prayer_group_join_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Group creators can update requests (approve/reject)
CREATE POLICY "Group creators can update requests" ON prayer_group_join_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM prayer_groups 
            WHERE id = prayer_group_join_requests.group_id 
            AND created_by = auth.uid()
        )
    );

-- 6. Create index for performance
CREATE INDEX IF NOT EXISTS idx_prayer_group_join_requests_group_id ON prayer_group_join_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_join_requests_user_id ON prayer_group_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_join_requests_status ON prayer_group_join_requests(status);
