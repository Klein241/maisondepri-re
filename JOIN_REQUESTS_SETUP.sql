
-- Add public/private toggle and timestamps
ALTER TABLE multiplayer_rooms ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE multiplayer_rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create Join Requests table
CREATE TABLE IF NOT EXISTS multiplayer_join_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES multiplayer_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    display_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE multiplayer_join_requests ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any to avoid "already exists" errors
DROP POLICY IF EXISTS "Users can see their own requests" ON multiplayer_join_requests;
DROP POLICY IF EXISTS "Hosts can see requests for their rooms" ON multiplayer_join_requests;
DROP POLICY IF EXISTS "Users can create requests" ON multiplayer_join_requests;
DROP POLICY IF EXISTS "Hosts can update requests (accept/reject)" ON multiplayer_join_requests;

-- Policies for requests
CREATE POLICY "Users can see their own requests" ON multiplayer_join_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Hosts can see requests for their rooms" ON multiplayer_join_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM multiplayer_rooms 
            WHERE id = multiplayer_join_requests.room_id 
            AND host_id = auth.uid()
        )
    );

CREATE POLICY "Users can create requests" ON multiplayer_join_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts can update requests (accept/reject)" ON multiplayer_join_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM multiplayer_rooms 
            WHERE id = multiplayer_join_requests.room_id 
            AND host_id = auth.uid()
        )
    );
