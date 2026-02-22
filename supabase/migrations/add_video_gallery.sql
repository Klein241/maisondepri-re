-- Video Gallery: Admin adds videos, users watch via proxy
CREATE TABLE IF NOT EXISTS video_gallery (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    description TEXT,
    duration INTEGER, -- seconds
    platform TEXT DEFAULT 'facebook',
    category TEXT DEFAULT 'predication',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow all authenticated users to read
ALTER TABLE video_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_gallery_read" ON video_gallery FOR SELECT USING (true);
CREATE POLICY "video_gallery_admin" ON video_gallery FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_video_gallery_active ON video_gallery(is_active, sort_order);
