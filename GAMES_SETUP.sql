-- Enable UUID extension (just in case)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Quiz Questions
CREATE TABLE IF NOT EXISTS game_questions_quiz (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings
    correct_index INTEGER NOT NULL,
    difficulty TEXT DEFAULT 'medium', -- easy, medium, hard
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Who Am I Characters
CREATE TABLE IF NOT EXISTS game_characters_whoami (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    clues JSONB NOT NULL, -- Array of strings
    difficulty TEXT DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Chrono Events
CREATE TABLE IF NOT EXISTS game_events_chrono (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event TEXT NOT NULL,
    year TEXT NOT NULL,
    year_numeric INTEGER, -- For easier sorting if needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE game_questions_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_characters_whoami ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events_chrono ENABLE ROW LEVEL SECURITY;

-- Policies
-- Public Read
CREATE POLICY "Public read quiz" ON game_questions_quiz FOR SELECT USING (true);
CREATE POLICY "Public read whoami" ON game_characters_whoami FOR SELECT USING (true);
CREATE POLICY "Public read chrono" ON game_events_chrono FOR SELECT USING (true);

-- Admin Write (assuming 'admin' role or check profile)
CREATE POLICY "Admin all quiz" ON game_questions_quiz FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);
CREATE POLICY "Admin all whoami" ON game_characters_whoami FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);
CREATE POLICY "Admin all chrono" ON game_events_chrono FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);
