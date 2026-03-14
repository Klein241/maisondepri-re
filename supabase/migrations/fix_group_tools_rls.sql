-- ============================================================
-- Migration: Fix group_polls, group_events, group tools RLS
-- Fixes: 403 errors (RLS) and missing tables/columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: ADD COLUMNS TO EXISTING TABLES
-- ============================================================

-- Add reactions (JSONB) and comment_count to messages tables
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
ALTER TABLE prayer_group_messages ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- ============================================================
-- STEP 2: CREATE TABLES (IF NOT EXISTS)
-- ============================================================

-- group_polls
CREATE TABLE IF NOT EXISTS group_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    votes JSONB NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    allow_multiple BOOLEAN DEFAULT false
);

-- group_events
CREATE TABLE IF NOT EXISTS group_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    event_end_date TIMESTAMPTZ,
    location TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    attendees JSONB DEFAULT '[]',
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT
);

-- group_announcements
CREATE TABLE IF NOT EXISTS group_announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    pinned BOOLEAN DEFAULT false
);

-- group_verse_of_day
CREATE TABLE IF NOT EXISTS group_verse_of_day (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: group_prayer_counter already exists (from fix_missing_columns_and_rls.sql)
-- It has schema: group_id, count, last_prayer_at — NO user_id column (one counter per group)

-- ============================================================
-- STEP 3: ENABLE RLS
-- ============================================================

ALTER TABLE group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_verse_of_day ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: DROP OLD POLICIES (safe, ignores if not exist)
-- ============================================================

-- group_polls
DROP POLICY IF EXISTS "Members can read polls" ON group_polls;
DROP POLICY IF EXISTS "Members can insert polls" ON group_polls;
DROP POLICY IF EXISTS "Members can update polls (vote)" ON group_polls;
DROP POLICY IF EXISTS "Admins can delete polls" ON group_polls;

-- group_events
DROP POLICY IF EXISTS "Members can read events" ON group_events;
DROP POLICY IF EXISTS "Admins can insert events" ON group_events;
DROP POLICY IF EXISTS "Admins can update events" ON group_events;
DROP POLICY IF EXISTS "Admins can delete events" ON group_events;

-- group_announcements
DROP POLICY IF EXISTS "Members can read announcements" ON group_announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON group_announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON group_announcements;

-- group_verse_of_day
DROP POLICY IF EXISTS "Members can read verse" ON group_verse_of_day;
DROP POLICY IF EXISTS "Admins can insert verse" ON group_verse_of_day;
DROP POLICY IF EXISTS "Admins can delete verse" ON group_verse_of_day;

-- ============================================================
-- STEP 5: CREATE RLS POLICIES
-- Uses prayer_group_members.user_id (confirmed exists in that table)
-- ============================================================

-- ═══════════ group_polls ═══════════
CREATE POLICY "Members can read polls" ON group_polls
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_polls.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can insert polls" ON group_polls
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_polls.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can update polls (vote)" ON group_polls
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_polls.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete polls" ON group_polls
    FOR DELETE TO authenticated USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_polls.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = group_polls.group_id
            AND pg.created_by = auth.uid()
        )
    );

-- ═══════════ group_events ═══════════
CREATE POLICY "Members can read events" ON group_events
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_events.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert events" ON group_events
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_events.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update events" ON group_events
    FOR UPDATE TO authenticated USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_events.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
    );

CREATE POLICY "Admins can delete events" ON group_events
    FOR DELETE TO authenticated USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_events.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
    );

-- ═══════════ group_announcements ═══════════
CREATE POLICY "Members can read announcements" ON group_announcements
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_announcements.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert announcements" ON group_announcements
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_announcements.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = group_announcements.group_id
            AND pg.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can delete announcements" ON group_announcements
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_announcements.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = group_announcements.group_id
            AND pg.created_by = auth.uid()
        )
    );

-- ═══════════ group_verse_of_day ═══════════
CREATE POLICY "Members can read verse" ON group_verse_of_day
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_verse_of_day.group_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert verse" ON group_verse_of_day
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_verse_of_day.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = group_verse_of_day.group_id
            AND pg.created_by = auth.uid()
        )
    );

CREATE POLICY "Admins can delete verse" ON group_verse_of_day
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm
            WHERE pgm.group_id = group_verse_of_day.group_id
            AND pgm.user_id = auth.uid()
            AND pgm.role IN ('admin', 'creator')
        )
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg
            WHERE pg.id = group_verse_of_day.group_id
            AND pg.created_by = auth.uid()
        )
    );

-- ============================================================
-- STEP 6: ENABLE REALTIME (ignore errors if already added)
-- ============================================================
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_polls;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_events;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_announcements;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_verse_of_day;
EXCEPTION WHEN others THEN NULL;
END $$;
