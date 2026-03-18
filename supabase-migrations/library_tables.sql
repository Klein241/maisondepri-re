-- ═══════════════════════════════════════════════════════════
-- LIBRARY TABLES — Ratings, Downloads, Favorites, History
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor

-- 1. Add missing columns to library_books if not present
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- 2. RATINGS TABLE
CREATE TABLE IF NOT EXISTS library_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

-- 3. DOWNLOADS TABLE
CREATE TABLE IF NOT EXISTS library_downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FAVORITES TABLE  
CREATE TABLE IF NOT EXISTS library_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

-- 5. READING HISTORY TABLE
CREATE TABLE IF NOT EXISTS library_reading_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_page INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS — Auto-update avg_rating, rating_count, download_count
-- ═══════════════════════════════════════════════════════════

-- Trigger: Update avg_rating + rating_count when ratings change
CREATE OR REPLACE FUNCTION update_book_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE library_books
    SET 
        avg_rating = COALESCE((
            SELECT AVG(rating)::DECIMAL(3,2)
            FROM library_ratings
            WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
        ), 0),
        rating_count = COALESCE((
            SELECT COUNT(*)
            FROM library_ratings
            WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
        ), 0)
    WHERE id = COALESCE(NEW.book_id, OLD.book_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_book_rating ON library_ratings;
CREATE TRIGGER trg_update_book_rating
    AFTER INSERT OR UPDATE OR DELETE ON library_ratings
    FOR EACH ROW EXECUTE FUNCTION update_book_rating_stats();

-- Trigger: Increment download_count when a download is recorded
CREATE OR REPLACE FUNCTION increment_book_download_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE library_books
    SET download_count = download_count + 1
    WHERE id = NEW.book_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_download ON library_downloads;
CREATE TRIGGER trg_increment_download
    AFTER INSERT ON library_downloads
    FOR EACH ROW EXECUTE FUNCTION increment_book_download_count();

-- ═══════════════════════════════════════════════════════════
-- RLS POLICIES — Allow users to rate, download, favorite
-- ═══════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE library_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_reading_history ENABLE ROW LEVEL SECURITY;

-- RATINGS: Anyone can read, authenticated users can upsert their own
DROP POLICY IF EXISTS "Anyone can read ratings" ON library_ratings;
CREATE POLICY "Anyone can read ratings" ON library_ratings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own ratings" ON library_ratings;
CREATE POLICY "Users can manage own ratings" ON library_ratings
    FOR ALL USING (auth.uid() = user_id);

-- DOWNLOADS: Users insert their own, admins can read all
DROP POLICY IF EXISTS "Users can insert own downloads" ON library_downloads;
CREATE POLICY "Users can insert own downloads" ON library_downloads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read downloads" ON library_downloads;
CREATE POLICY "Anyone can read downloads" ON library_downloads
    FOR SELECT USING (true);

-- FAVORITES: Users manage their own
DROP POLICY IF EXISTS "Users can manage own favorites" ON library_favorites;
CREATE POLICY "Users can manage own favorites" ON library_favorites
    FOR ALL USING (auth.uid() = user_id);

-- READING HISTORY: Users manage their own
DROP POLICY IF EXISTS "Users can manage own history" ON library_reading_history;
CREATE POLICY "Users can manage own history" ON library_reading_history
    FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- INDEXES for performance
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_library_ratings_book ON library_ratings(book_id);
CREATE INDEX IF NOT EXISTS idx_library_ratings_user ON library_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_library_downloads_book ON library_downloads(book_id);
CREATE INDEX IF NOT EXISTS idx_library_favorites_user ON library_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_library_history_user ON library_reading_history(user_id);
