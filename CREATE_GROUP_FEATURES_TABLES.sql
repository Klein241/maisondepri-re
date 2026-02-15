-- =====================================================
-- GROUP FEATURES: Polls, Prayer Counter, Events
-- Execute this in Supabase SQL Editor
-- =====================================================

-- 1. Group Polls Table
CREATE TABLE IF NOT EXISTS group_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_name TEXT DEFAULT 'Utilisateur',
    is_anonymous BOOLEAN DEFAULT false,
    is_multiple BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE group_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view polls" ON group_polls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_polls.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can create polls" ON group_polls
    FOR INSERT WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_polls.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Creator can update polls" ON group_polls
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete polls" ON group_polls
    FOR DELETE USING (
        auth.uid() = created_by 
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = group_polls.group_id 
            AND pg.created_by = auth.uid()
        )
    );


-- 2. Group Prayer Counter Table
CREATE TABLE IF NOT EXISTS group_prayer_counter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE UNIQUE,
    count INTEGER DEFAULT 0,
    goal INTEGER DEFAULT 100,
    recent_prayers JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE group_prayer_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view prayer counter" ON group_prayer_counter
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_prayer_counter.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can upsert prayer counter" ON group_prayer_counter
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_prayer_counter.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can update prayer counter" ON group_prayer_counter
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_prayer_counter.group_id 
            AND pgm.user_id = auth.uid()
        )
    );


-- 3. Group Events Table
CREATE TABLE IF NOT EXISTS group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    event_date DATE NOT NULL,
    event_time TEXT DEFAULT '18:00',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_name TEXT DEFAULT 'Utilisateur',
    attendees JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view events" ON group_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_events.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can create events" ON group_events
    FOR INSERT WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM prayer_group_members pgm 
            WHERE pgm.group_id = group_events.group_id 
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Creator can update events" ON group_events
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete events" ON group_events
    FOR DELETE USING (
        auth.uid() = created_by 
        OR EXISTS (
            SELECT 1 FROM prayer_groups pg 
            WHERE pg.id = group_events.group_id 
            AND pg.created_by = auth.uid()
        )
    );


-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_polls_group_id ON group_polls(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_group_id ON group_events(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_date ON group_events(event_date);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE group_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE group_events;
ALTER PUBLICATION supabase_realtime ADD TABLE group_prayer_counter;

-- 6. Grant permissions
GRANT ALL ON group_polls TO authenticated;
GRANT ALL ON group_prayer_counter TO authenticated;
GRANT ALL ON group_events TO authenticated;

SELECT 'Group features tables created successfully!' AS status;
