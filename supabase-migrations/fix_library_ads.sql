-- ═══════════════════════════════════════════════════════════
-- FIX: library_ads table — update constraint to match code
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure library_ads table exists
CREATE TABLE IF NOT EXISTS library_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    is_active BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    placement TEXT DEFAULT 'book_detail',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Drop old constraint and recreate with correct values
ALTER TABLE library_ads DROP CONSTRAINT IF EXISTS library_ads_placement_check;
ALTER TABLE library_ads
    ADD CONSTRAINT library_ads_placement_check
    CHECK (placement IN (
        'book_detail',
        'home_feed',
        'marketplace',
        'reader_end',
        'search_results',
        'sidebar'
    ));

-- 3. Enable RLS
ALTER TABLE library_ads ENABLE ROW LEVEL SECURITY;

-- 4. Allow everyone to read active ads
DROP POLICY IF EXISTS "Anyone can read ads" ON library_ads;
CREATE POLICY "Anyone can read ads"
ON library_ads FOR SELECT
USING (true);

-- 5. Allow admins to manage ads (insert/update/delete)
DROP POLICY IF EXISTS "Admins can manage ads" ON library_ads;
CREATE POLICY "Admins can manage ads"
ON library_ads FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- 6. Enable Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE library_ads;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- 7. Verify
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'library_ads'
ORDER BY ordinal_position;
