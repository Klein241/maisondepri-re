-- =====================================================
-- Friendships Table for Friend System
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate requests
    UNIQUE(sender_id, receiver_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_sender ON friendships(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own friendships (sent or received)
CREATE POLICY "Users can view own friendships" ON friendships
    FOR SELECT USING (
        auth.uid() = sender_id OR auth.uid() = receiver_id
    );

-- Users can send friend requests
CREATE POLICY "Users can send friend requests" ON friendships
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
    );

-- Users can update friendship status (accept/reject) if they are the receiver
CREATE POLICY "Receivers can respond to requests" ON friendships
    FOR UPDATE USING (
        auth.uid() = receiver_id
    );

-- Users can delete their own friendships (unfriend)
CREATE POLICY "Users can delete own friendships" ON friendships
    FOR DELETE USING (
        auth.uid() = sender_id OR auth.uid() = receiver_id
    );

-- Enable realtime for friendships
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;

-- =====================================================
-- Ensure profiles table has online status columns
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_online') THEN
        ALTER TABLE profiles ADD COLUMN is_online BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen') THEN
        ALTER TABLE profiles ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'city') THEN
        ALTER TABLE profiles ADD COLUMN city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'church') THEN
        ALTER TABLE profiles ADD COLUMN church TEXT;
    END IF;
END $$;
