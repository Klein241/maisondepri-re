-- Migration: Create group_calls table for Google Meet integration
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS group_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    meet_link TEXT NOT NULL,
    calendar_event_id TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE group_calls ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read group calls
CREATE POLICY "Anyone can view group calls" ON group_calls
    FOR SELECT USING (true);

-- Policy: authenticated users can create calls
CREATE POLICY "Authenticated users can create calls" ON group_calls
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Policy: creator can update their calls
CREATE POLICY "Creator can update own calls" ON group_calls
    FOR UPDATE USING (auth.uid() = created_by);

-- Policy: creator can delete their calls
CREATE POLICY "Creator can delete own calls" ON group_calls
    FOR DELETE USING (auth.uid() = created_by);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE group_calls;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_group_calls_group_id ON group_calls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_calls_status ON group_calls(status);
CREATE INDEX IF NOT EXISTS idx_group_calls_scheduled_at ON group_calls(scheduled_at);
