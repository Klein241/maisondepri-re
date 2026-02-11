-- =====================================================
-- PRAYER GROUPS & CHAT TABLES SQL
-- Execute this in Supabase SQL Editor to create
-- all necessary tables for prayer groups and chat
-- =====================================================

-- 1. Prayer Groups Table
-- =====================================================
CREATE TABLE IF NOT EXISTS prayer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    prayer_request_id UUID,
    is_open BOOLEAN DEFAULT true,
    is_urgent BOOLEAN DEFAULT false,
    max_members INTEGER DEFAULT 50,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'answered', 'closed')),
    is_admin_created BOOLEAN DEFAULT false,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on prayer_groups
ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;

-- Policies for prayer_groups
DROP POLICY IF EXISTS "Users can view all groups" ON prayer_groups;
CREATE POLICY "Users can view all groups" ON prayer_groups
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create groups" ON prayer_groups;
CREATE POLICY "Authenticated users can create groups" ON prayer_groups
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Group creators can update their groups" ON prayer_groups;
CREATE POLICY "Group creators can update their groups" ON prayer_groups
    FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Group creators can delete their groups" ON prayer_groups;
CREATE POLICY "Group creators can delete their groups" ON prayer_groups
    FOR DELETE USING (created_by = auth.uid());

-- 2. Prayer Group Members Table
-- =====================================================
CREATE TABLE IF NOT EXISTS prayer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Enable RLS on prayer_group_members
ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;

-- Policies for prayer_group_members
DROP POLICY IF EXISTS "Users can view group members" ON prayer_group_members;
CREATE POLICY "Users can view group members" ON prayer_group_members
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON prayer_group_members;
CREATE POLICY "Users can join groups" ON prayer_group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave groups" ON prayer_group_members;
CREATE POLICY "Users can leave groups" ON prayer_group_members
    FOR DELETE USING (auth.uid() = user_id);

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

-- 3. Prayer Group Join Requests Table
-- =====================================================
CREATE TABLE IF NOT EXISTS prayer_group_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Enable RLS on prayer_group_join_requests
ALTER TABLE prayer_group_join_requests ENABLE ROW LEVEL SECURITY;

-- Policies for prayer_group_join_requests
DROP POLICY IF EXISTS "Users can view their own requests" ON prayer_group_join_requests;
CREATE POLICY "Users can view their own requests" ON prayer_group_join_requests
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view group requests" ON prayer_group_join_requests;
CREATE POLICY "Admins can view group requests" ON prayer_group_join_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = prayer_group_join_requests.group_id 
            AND pgm.user_id = auth.uid() 
            AND pgm.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Users can create join requests" ON prayer_group_join_requests;
CREATE POLICY "Users can create join requests" ON prayer_group_join_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update requests" ON prayer_group_join_requests;
CREATE POLICY "Admins can update requests" ON prayer_group_join_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = prayer_group_join_requests.group_id 
            AND pgm.user_id = auth.uid() 
            AND pgm.role = 'admin'
        )
    );

-- 4. Prayer Group Messages Table
-- =====================================================
CREATE TABLE IF NOT EXISTS prayer_group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'image')),
    voice_url TEXT,
    voice_duration INTEGER,
    image_url TEXT,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on prayer_group_messages
ALTER TABLE prayer_group_messages ENABLE ROW LEVEL SECURITY;

-- Policies for prayer_group_messages
DROP POLICY IF EXISTS "Members can view group messages" ON prayer_group_messages;
CREATE POLICY "Members can view group messages" ON prayer_group_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = prayer_group_messages.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members can send messages" ON prayer_group_messages;
CREATE POLICY "Members can send messages" ON prayer_group_messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = prayer_group_messages.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own messages" ON prayer_group_messages;
CREATE POLICY "Users can delete own messages" ON prayer_group_messages
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Direct Messages Table
-- =====================================================
CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'image')),
    voice_url TEXT,
    voice_duration INTEGER,
    image_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on direct_messages
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Policies for direct_messages
DROP POLICY IF EXISTS "Users can view their own DMs" ON direct_messages;
CREATE POLICY "Users can view their own DMs" ON direct_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send DMs" ON direct_messages;
CREATE POLICY "Users can send DMs" ON direct_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update read status" ON direct_messages;
CREATE POLICY "Users can update read status" ON direct_messages
    FOR UPDATE USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can delete own DMs" ON direct_messages;
CREATE POLICY "Users can delete own DMs" ON direct_messages
    FOR DELETE USING (auth.uid() = sender_id);

-- 6. Enable Realtime for all chat tables
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- 7. Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_prayer_group_messages_group_id ON prayer_group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_messages_created_at ON prayer_group_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_prayer_group_members_group_id ON prayer_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_prayer_group_members_user_id ON prayer_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at);

-- 8. Grant permissions
-- =====================================================
GRANT ALL ON prayer_groups TO authenticated;
GRANT ALL ON prayer_group_members TO authenticated;
GRANT ALL ON prayer_group_join_requests TO authenticated;
GRANT ALL ON prayer_group_messages TO authenticated;
GRANT ALL ON direct_messages TO authenticated;

SELECT 'Prayer Groups and Chat tables created successfully!' AS status;
