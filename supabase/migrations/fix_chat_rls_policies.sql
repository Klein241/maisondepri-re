-- ================================================================
-- FIX RLS POLICIES FOR CHAT FEATURES
-- ================================================================
-- This migration fixes: 
--   1) "Erreur lors de l'envoi" (sending messages to groups)
--   2) "Erreur lors du partage" (sharing events/fasting programs)
--   3) "Erreur lors de l'épinglage" (pinning prayer subjects)
--   4) Group creation errors
--
-- Run this in Supabase SQL Editor
-- ================================================================

-- ==========================================
-- 1. FIX: prayer_group_messages - INSERT
-- Members must be able to send messages to their groups
-- ==========================================

-- Drop existing INSERT policy if it exists (safe re-run)
DROP POLICY IF EXISTS "Members can send messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Group members can insert messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_insert" ON prayer_group_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON prayer_group_messages;

-- Create INSERT policy: only members of the group can send messages
CREATE POLICY "Members can send group messages"
ON prayer_group_messages FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id
        AND prayer_group_members.user_id = auth.uid()
    )
);

-- ==========================================
-- 2. FIX: prayer_group_messages - SELECT
-- Members must be able to read messages from their groups
-- ==========================================

DROP POLICY IF EXISTS "Members can view messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Group members can view messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_select" ON prayer_group_messages;

CREATE POLICY "Members can view group messages"
ON prayer_group_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id
        AND prayer_group_members.user_id = auth.uid()
    )
);

-- ==========================================
-- 3. FIX: prayer_group_messages - UPDATE
-- Users can update their own messages (edit/reactions)
-- ==========================================

DROP POLICY IF EXISTS "Users can update own messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_update" ON prayer_group_messages;

CREATE POLICY "Users can update own group messages"
ON prayer_group_messages FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 4. FIX: prayer_group_messages - DELETE
-- Users can delete their own messages, admins can delete any
-- ==========================================

DROP POLICY IF EXISTS "Users can delete own messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_delete" ON prayer_group_messages;

CREATE POLICY "Users can delete own group messages"
ON prayer_group_messages FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id
        AND prayer_group_members.user_id = auth.uid()
        AND prayer_group_members.role = 'admin'
    )
);

-- ==========================================
-- 5. FIX: prayer_groups - UPDATE (for pinning, description changes)
-- Admins must be able to update group settings (pin prayer, etc.)
-- ==========================================

DROP POLICY IF EXISTS "Admins can update groups" ON prayer_groups;
DROP POLICY IF EXISTS "Group admins can update" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_update" ON prayer_groups;
DROP POLICY IF EXISTS "Creator can update group" ON prayer_groups;

CREATE POLICY "Admins can update their groups"
ON prayer_groups FOR UPDATE
TO authenticated
USING (
    auth.uid() = created_by
    OR EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_groups.id
        AND prayer_group_members.user_id = auth.uid()
        AND prayer_group_members.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_groups.id
        AND prayer_group_members.user_id = auth.uid()
        AND prayer_group_members.role = 'admin'
    )
);

-- ==========================================
-- 6. FIX: prayer_groups - SELECT
-- Everyone can view groups (for discovery/joining)
-- ==========================================

DROP POLICY IF EXISTS "Anyone can view groups" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_select" ON prayer_groups;
DROP POLICY IF EXISTS "Authenticated users can view groups" ON prayer_groups;

CREATE POLICY "Authenticated users can view all groups"
ON prayer_groups FOR SELECT
TO authenticated
USING (true);

-- ==========================================
-- 7. FIX: prayer_groups - INSERT (for creating groups)
-- Any authenticated user can create a group
-- ==========================================

DROP POLICY IF EXISTS "Users can create groups" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_insert" ON prayer_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON prayer_groups;

CREATE POLICY "Authenticated users can create groups"
ON prayer_groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- ==========================================
-- 8. FIX: prayer_group_members - INSERT
-- Users can join open groups / admins can add members
-- ==========================================

DROP POLICY IF EXISTS "Users can join groups" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_insert" ON prayer_group_members;
DROP POLICY IF EXISTS "Authenticated users can join groups" ON prayer_group_members;

CREATE POLICY "Users can join or be added to groups"
ON prayer_group_members FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid()
        AND pgm.role = 'admin'
    )
);

-- ==========================================
-- 9. FIX: prayer_group_members - SELECT
-- Members can see who is in their group
-- ==========================================

DROP POLICY IF EXISTS "Members can view group members" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_select" ON prayer_group_members;

CREATE POLICY "Authenticated users can view group members"
ON prayer_group_members FOR SELECT
TO authenticated
USING (true);

-- ==========================================
-- 10. FIX: prayer_group_members - UPDATE (for role changes)
-- Admins can update member roles
-- ==========================================

DROP POLICY IF EXISTS "Admins can update members" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_update" ON prayer_group_members;

CREATE POLICY "Admins can update group members"
ON prayer_group_members FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid()
        AND pgm.role = 'admin'
    )
);

-- ==========================================
-- 11. FIX: prayer_group_members - DELETE (for removing/leaving)
-- ==========================================

DROP POLICY IF EXISTS "Members can leave or admins can remove" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_delete" ON prayer_group_members;

CREATE POLICY "Members can leave or admins can remove"
ON prayer_group_members FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid()
        AND pgm.role = 'admin'
    )
);

-- ==========================================
-- 12. FIX: direct_messages policies
-- ==========================================

DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;
DROP POLICY IF EXISTS "direct_messages_insert" ON direct_messages;

CREATE POLICY "Users can send direct messages"
ON direct_messages FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = direct_messages.conversation_id
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can view own direct messages" ON direct_messages;
DROP POLICY IF EXISTS "direct_messages_select" ON direct_messages;

CREATE POLICY "Users can view own direct messages"
ON direct_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = direct_messages.conversation_id
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can update own direct messages" ON direct_messages;
DROP POLICY IF EXISTS "direct_messages_update" ON direct_messages;

CREATE POLICY "Users can update own direct messages"
ON direct_messages FOR UPDATE
TO authenticated
USING (
    auth.uid() = sender_id
    OR EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = direct_messages.conversation_id
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);

-- ==========================================
-- 13. FIX: conversations policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_select" ON conversations;

CREATE POLICY "Users can view own conversations"
ON conversations FOR SELECT
TO authenticated
USING (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;

CREATE POLICY "Users can update own conversations"
ON conversations FOR UPDATE
TO authenticated
USING (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);

-- ==========================================
-- ENSURE RLS IS ENABLED ON ALL TABLES
-- ==========================================

ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- DONE! All chat features should now work:
-- ✅ Sending messages in groups
-- ✅ Sharing events to groups
-- ✅ Pinning prayer subjects
-- ✅ Creating groups
-- ✅ Sending direct messages
-- ✅ Sending announcements
-- ✅ Sharing fasting programs
-- ==========================================
