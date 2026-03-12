-- ================================================================
-- LIBRARY TABLES - Books, Ratings, Favorites, Reading History
-- ================================================================
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. BOOKS TABLE
CREATE TABLE IF NOT EXISTS library_books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Auteur inconnu',
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'other',
    cover_url TEXT, -- URL of the cover image in Supabase Storage
    file_url TEXT NOT NULL, -- URL of the PDF/EPUB in Supabase Storage
    file_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0, -- in bytes
    file_type TEXT DEFAULT 'pdf', -- pdf, epub
    page_count INTEGER DEFAULT 0,
    avg_rating NUMERIC(2,1) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;

-- Everyone can read published books
CREATE POLICY "Anyone can view published books"
ON library_books FOR SELECT TO authenticated
USING (is_published = true);

-- Admin can do everything (we check in app layer)
CREATE POLICY "Admins can manage books"
ON library_books FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 2. BOOK RATINGS TABLE
CREATE TABLE IF NOT EXISTS library_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(book_id, user_id)
);

ALTER TABLE library_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all ratings"
ON library_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can rate books"
ON library_ratings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
ON library_ratings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
ON library_ratings FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 3. BOOK FAVORITES TABLE
CREATE TABLE IF NOT EXISTS library_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(book_id, user_id)
);

ALTER TABLE library_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
ON library_favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
ON library_favorites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
ON library_favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 4. READING HISTORY TABLE
CREATE TABLE IF NOT EXISTS library_reading_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_page INTEGER DEFAULT 1,
    total_pages INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    last_read_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(book_id, user_id)
);

ALTER TABLE library_reading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
ON library_reading_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert history"
ON library_reading_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history"
ON library_reading_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 5. CREATE STORAGE BUCKET FOR LIBRARY FILES
INSERT INTO storage.buckets (id, name, public)
VALUES ('library', 'library', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for library bucket
CREATE POLICY "Anyone can view library files"
ON storage.objects FOR SELECT
USING (bucket_id = 'library');

CREATE POLICY "Authenticated users can upload library files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library');

CREATE POLICY "Authenticated users can update library files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library');

CREATE POLICY "Authenticated users can delete library files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library');

-- 6. FUNCTION: Update average rating when a rating is added/changed
CREATE OR REPLACE FUNCTION update_book_avg_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE library_books SET
        avg_rating = COALESCE((
            SELECT AVG(rating)::NUMERIC(2,1)
            FROM library_ratings
            WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
        ), 0),
        rating_count = (
            SELECT COUNT(*)
            FROM library_ratings
            WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
        ),
        updated_at = now()
    WHERE id = COALESCE(NEW.book_id, OLD.book_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_book_rating ON library_ratings;
CREATE TRIGGER trg_update_book_rating
AFTER INSERT OR UPDATE OR DELETE ON library_ratings
FOR EACH ROW EXECUTE FUNCTION update_book_avg_rating();

-- 7. REALTIME
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE library_books; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ==========================================
-- DONE!
-- ✅ library_books: stores all books with cover + file URLs
-- ✅ library_ratings: per-user star ratings with auto avg calculation
-- ✅ library_favorites: per-user favorites
-- ✅ library_reading_history: per-user reading progress
-- ✅ Storage bucket 'library' for PDFs/EPUBs/covers
-- ==========================================
