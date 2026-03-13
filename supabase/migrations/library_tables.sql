-- ================================================================
-- LIBRARY TABLES: favorites, ratings, reading_history
-- + Add slug column to library_books
-- + Fix download_count as real-time aggregate
-- ================================================================

-- 1. Add slug to library_books
ALTER TABLE library_books ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for existing books (accent-safe)
UPDATE library_books 
SET slug = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                translate(
                    title,
                    'àâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ',
                    'aaaeeeeiioouucoeAAEEEEEIIOOUUCOE'
                ),
                '[^a-zA-Z0-9 -]', '', 'g'
            ),
            '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
    )
) 
WHERE slug IS NULL;

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_books_slug ON library_books(slug);

-- 2. LIBRARY_FAVORITES
CREATE TABLE IF NOT EXISTS library_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

ALTER TABLE library_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own favorites" ON library_favorites;
DROP POLICY IF EXISTS "Users manage own favorites" ON library_favorites;
DROP POLICY IF EXISTS "Users insert own favorites" ON library_favorites;
DROP POLICY IF EXISTS "Users delete own favorites" ON library_favorites;
DROP POLICY IF EXISTS "Admin view all favorites" ON library_favorites;

CREATE POLICY "Users view own favorites" ON library_favorites
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users insert own favorites" ON library_favorites
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own favorites" ON library_favorites
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_favorites_user ON library_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_library_favorites_book ON library_favorites(book_id);

-- 3. LIBRARY_RATINGS
CREATE TABLE IF NOT EXISTS library_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

ALTER TABLE library_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view ratings" ON library_ratings;
DROP POLICY IF EXISTS "Users manage own rating" ON library_ratings;
DROP POLICY IF EXISTS "Users upsert own rating" ON library_ratings;
DROP POLICY IF EXISTS "Users delete own rating" ON library_ratings;
DROP POLICY IF EXISTS "Anyone can view ratings" ON library_ratings;

CREATE POLICY "Anyone can view ratings" ON library_ratings
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users upsert own rating" ON library_ratings
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own rating" ON library_ratings
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rating" ON library_ratings
    FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin());

CREATE INDEX IF NOT EXISTS idx_library_ratings_book ON library_ratings(book_id);

-- Trigger: auto-update avg_rating and rating_count on library_books
CREATE OR REPLACE FUNCTION update_book_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE library_books SET
        avg_rating = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM library_ratings WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)), 0),
        rating_count = COALESCE((SELECT COUNT(*) FROM library_ratings WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)), 0)
    WHERE id = COALESCE(NEW.book_id, OLD.book_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_book_ratings ON library_ratings;
CREATE TRIGGER trigger_update_book_ratings
    AFTER INSERT OR UPDATE OR DELETE ON library_ratings
    FOR EACH ROW EXECUTE FUNCTION update_book_rating_stats();

-- 4. LIBRARY_READING_HISTORY
CREATE TABLE IF NOT EXISTS library_reading_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_pages INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

ALTER TABLE library_reading_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own history" ON library_reading_history;
DROP POLICY IF EXISTS "Users manage own history" ON library_reading_history;
DROP POLICY IF EXISTS "Users insert own history" ON library_reading_history;
DROP POLICY IF EXISTS "Users update own history" ON library_reading_history;
DROP POLICY IF EXISTS "Admin view all history" ON library_reading_history;

CREATE POLICY "Users view own history" ON library_reading_history
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users insert own history" ON library_reading_history
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own history" ON library_reading_history
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_history_user ON library_reading_history(user_id);

-- 5. LIBRARY_DOWNLOADS (track real download events)
CREATE TABLE IF NOT EXISTS library_downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE library_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can log downloads" ON library_downloads;
DROP POLICY IF EXISTS "Admin view downloads" ON library_downloads;

CREATE POLICY "Anyone can log downloads" ON library_downloads
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin view downloads" ON library_downloads
    FOR SELECT TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_library_downloads_book ON library_downloads(book_id);

-- Trigger: auto-update download_count on library_books
CREATE OR REPLACE FUNCTION update_book_download_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE library_books
    SET download_count = (SELECT COUNT(*) FROM library_downloads WHERE book_id = NEW.book_id)
    WHERE id = NEW.book_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_download_count ON library_downloads;
CREATE TRIGGER trigger_update_download_count
    AFTER INSERT ON library_downloads
    FOR EACH ROW EXECUTE FUNCTION update_book_download_count();

-- ================================================================
-- FIX: Ensure notifications INSERT is open to all authenticated
-- (This was blocking notifyNewBook from working!)
-- ================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications';
        EXECUTE 'CREATE POLICY "Anyone can create notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
END $$;

-- ================================================================
-- DONE!
-- Tables: library_favorites, library_ratings, library_reading_history, library_downloads
-- Triggers: auto-update avg_rating, rating_count, download_count
-- RLS: Users manage their own data, admins see everything
-- Fix: notifications INSERT policy open for all authenticated users
-- ================================================================
