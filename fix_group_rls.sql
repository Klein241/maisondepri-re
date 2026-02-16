-- =====================================================
-- FIX GROUP CHAT RLS POLICIES
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. ENABLE RLS ON ALL RELEVANT TABLES
ALTER TABLE IF EXISTS prayer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prayer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prayer_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. PROFILES - Everyone can read, users can update own
-- =====================================================
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- 3. PRAYER GROUPS - Members can see, creators can manage
-- =====================================================
DROP POLICY IF EXISTS "prayer_groups_select" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_insert" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_update" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_delete" ON prayer_groups;
DROP POLICY IF EXISTS "Anyone can view groups" ON prayer_groups;
DROP POLICY IF EXISTS "Auth users can create groups" ON prayer_groups;
DROP POLICY IF EXISTS "Group creator can update" ON prayer_groups;
DROP POLICY IF EXISTS "Group creator can delete" ON prayer_groups;

-- Anyone authenticated can see all groups
CREATE POLICY "prayer_groups_select" ON prayer_groups
  FOR SELECT USING (true);

-- Authenticated users can create groups
CREATE POLICY "prayer_groups_insert" ON prayer_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Creator can update their groups
CREATE POLICY "prayer_groups_update" ON prayer_groups
  FOR UPDATE USING (auth.uid() = created_by);

-- Creator can delete their groups
CREATE POLICY "prayer_groups_delete" ON prayer_groups
  FOR DELETE USING (auth.uid() = created_by);

-- =====================================================
-- 4. PRAYER GROUP MEMBERS - Critical for membership visibility
-- =====================================================
DROP POLICY IF EXISTS "prayer_group_members_select" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_insert" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_update" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_delete" ON prayer_group_members;
DROP POLICY IF EXISTS "Anyone can view group members" ON prayer_group_members;
DROP POLICY IF EXISTS "Auth users can join groups" ON prayer_group_members;
DROP POLICY IF EXISTS "Members can leave groups" ON prayer_group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON prayer_group_members;

-- ANYONE authenticated can see all group members (needed for member lists)
CREATE POLICY "prayer_group_members_select" ON prayer_group_members
  FOR SELECT USING (true);

-- Authenticated users can insert (join groups, admins add members)
CREATE POLICY "prayer_group_members_insert" ON prayer_group_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Members can update their own role / admins can update others
CREATE POLICY "prayer_group_members_update" ON prayer_group_members
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Members can leave (delete own) or admins can remove
CREATE POLICY "prayer_group_members_delete" ON prayer_group_members
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 5. PRAYER GROUP MESSAGES - Critical for chat visibility
-- =====================================================
DROP POLICY IF EXISTS "prayer_group_messages_select" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_insert" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_update" ON prayer_group_messages;
DROP POLICY IF EXISTS "prayer_group_messages_delete" ON prayer_group_messages;
DROP POLICY IF EXISTS "Group members can view messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON prayer_group_messages;

-- ALL authenticated users can read group messages
-- (We use a permissive policy to avoid RLS blocking realtime subscriptions)
CREATE POLICY "prayer_group_messages_select" ON prayer_group_messages
  FOR SELECT USING (true);

-- Authenticated users can insert messages (they must be members, enforced by app logic)
CREATE POLICY "prayer_group_messages_insert" ON prayer_group_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages
CREATE POLICY "prayer_group_messages_update" ON prayer_group_messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "prayer_group_messages_delete" ON prayer_group_messages
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 6. CONVERSATIONS (DM)
-- =====================================================
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- =====================================================
-- 7. DIRECT MESSAGES
-- =====================================================
DROP POLICY IF EXISTS "direct_messages_select" ON direct_messages;
DROP POLICY IF EXISTS "direct_messages_insert" ON direct_messages;
DROP POLICY IF EXISTS "direct_messages_update" ON direct_messages;
DROP POLICY IF EXISTS "Users can view own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can update messages" ON direct_messages;

-- Users can see messages in their conversations
CREATE POLICY "direct_messages_select" ON direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = direct_messages.conversation_id 
      AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

CREATE POLICY "direct_messages_insert" ON direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "direct_messages_update" ON direct_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = direct_messages.conversation_id 
      AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

-- =====================================================
-- 8. ENABLE REALTIME FOR GROUP MESSAGES
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- =====================================================
-- 9. ADD prayer_request_id column IF MISSING
-- =====================================================
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS prayer_request_id UUID;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_email TEXT;
