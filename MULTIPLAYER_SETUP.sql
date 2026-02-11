-- =========================================================
-- MULTIPLAYER SETUP
-- Enable Realtime for multiplayer games
-- =========================================================

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.multiplayer_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'waiting', -- waiting, playing, finished
    game_type TEXT DEFAULT 'bible_memory',
    config JSONB DEFAULT '{}'::jsonb, -- Stores the verse/game data
    host_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Players Table
CREATE TABLE IF NOT EXISTS public.multiplayer_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES multiplayer_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    display_name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    is_host BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_players ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Open for simplicity in this MVP, but tied to Auth)
-- Everyone can read rooms/players to join/watch
CREATE POLICY "Public read rooms" ON public.multiplayer_rooms FOR SELECT USING (true);
CREATE POLICY "Public read players" ON public.multiplayer_players FOR SELECT USING (true);

-- Anyone auth can insert
CREATE POLICY "Auth insert rooms" ON public.multiplayer_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert players" ON public.multiplayer_players FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Players can update their own rows (score/progress)
CREATE POLICY "Players update own" ON public.multiplayer_players FOR UPDATE USING (auth.uid() = user_id);

-- Host can update room (status)
CREATE POLICY "Host update room" ON public.multiplayer_rooms FOR UPDATE USING (auth.uid() = host_id);


-- 5. ENABLE REALTIME
-- IMPORTANT: This matches the default "supabase_realtime" publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_players;

-- 6. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.multiplayer_rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room ON public.multiplayer_players(room_id);

-- Force cache reload just in case
NOTIFY pgrst, 'reload config';
