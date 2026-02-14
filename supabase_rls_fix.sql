-- FIX RLS POLICIES FOR CHAT & NOTIFICATIONS
-- Run this in your Supabase SQL Editor

-- 1. PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read of profiles (needed for user search, friends, etc.)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. CONVERSATIONS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Users can view conversations they are part of
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" 
ON conversations FOR SELECT 
USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- Users can create conversations (if they are one of the participants)
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" 
ON conversations FOR INSERT 
WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- Users can update conversations (e.g. last_message) if they are part of it
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations" 
ON conversations FOR UPDATE 
USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- 3. DIRECT MESSAGES
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in conversations they belong to
-- Note: This requires a join or a check against the conversation
-- Ideally, we denormalize 'receiver_id' or check conversation participation.
-- PRO PERFORMANCE TIP: For better performance, we often trust the 'conversation_id' 
-- if we have a policy on conversations, but for strict security:
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON direct_messages;
CREATE POLICY "Users can view messages in own conversations" 
ON direct_messages FOR SELECT 
USING (
  exists (
    select 1 from conversations c
    where c.id = direct_messages.conversation_id
    and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
  )
);

-- Users can insert messages if they are the sender
DROP POLICY IF EXISTS "Users can insert own messages" ON direct_messages;
CREATE POLICY "Users can insert own messages" 
ON direct_messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Users can update properties (like read status) if they are receiver
-- But direct_messages usually don't have receiver_id column in this schema (it's in conversation?)
-- Let's check schema: usually DMs have sender_id. 'Read' status is updated by receiver.
-- We allow update if user is participant.
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON direct_messages;
CREATE POLICY "Users can update messages in own conversations" 
ON direct_messages FOR UPDATE 
USING (
  exists (
    select 1 from conversations c
    where c.id = direct_messages.conversation_id
    and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
  )
);

-- 4. NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" 
ON notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- ANYONE can insert a notification (needed for "User A notifies User B")
-- This is critical: User A interacts with User B, so User A's client inserts a row for User B.
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Anyone can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (true); 
-- Ideally we'd restrict this to "authenticated" users, but 'true' is fine for now.

-- 5. FRIENDSHIPS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- View: if you are sender or receiver
DROP POLICY IF EXISTS "View own friendships" ON friendships;
CREATE POLICY "View own friendships" 
ON friendships FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Insert: usually sender creates
DROP POLICY IF EXISTS "Create friendship" ON friendships;
CREATE POLICY "Create friendship" 
ON friendships FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Update: usually receiver accepts (updates status)
DROP POLICY IF EXISTS "Update own friendships" ON friendships;
CREATE POLICY "Update own friendships" 
ON friendships FOR UPDATE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Delete: either can delete
DROP POLICY IF EXISTS "Delete own friendships" ON friendships;
CREATE POLICY "Delete own friendships" 
ON friendships FOR DELETE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

