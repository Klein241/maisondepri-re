-- ======================================================
-- BIBLE SYSTEM SETUP - Complete Schema
-- Run this in Supabase SQL Editor
-- ======================================================

-- 1. Create bible_books table
CREATE TABLE IF NOT EXISTS bible_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'genese', 'exode'
    name VARCHAR(100) NOT NULL,           -- French name
    name_en VARCHAR(100),                 -- English name
    abbreviation VARCHAR(10) NOT NULL,    -- e.g., 'Gen', 'Exo'
    testament VARCHAR(10) NOT NULL CHECK (testament IN ('AT', 'NT')),
    chapters INTEGER NOT NULL DEFAULT 1,
    book_order INTEGER NOT NULL,          -- Order in Bible (1-66)
    is_uploaded BOOLEAN DEFAULT FALSE,
    file_url TEXT,                        -- URL to the uploaded file in storage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bible_books_testament ON bible_books(testament);
CREATE INDEX IF NOT EXISTS idx_bible_books_order ON bible_books(book_order);
CREATE INDEX IF NOT EXISTS idx_bible_books_uploaded ON bible_books(is_uploaded);

-- 3. Enable RLS
ALTER TABLE bible_books ENABLE ROW LEVEL SECURITY;

-- 4. Policies - Everyone can read, only admins can modify
DROP POLICY IF EXISTS "Anyone can read bible books" ON bible_books;
CREATE POLICY "Anyone can read bible books" ON bible_books
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage bible books" ON bible_books;
CREATE POLICY "Admins can manage bible books" ON bible_books
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin')
        )
    );

-- 5. Grant permissions
GRANT SELECT ON bible_books TO authenticated;
GRANT SELECT ON bible_books TO anon;
GRANT ALL ON bible_books TO authenticated;

-- 6. Insert all 66 Bible books (initially not uploaded)
INSERT INTO bible_books (book_id, name, name_en, abbreviation, testament, chapters, book_order, is_uploaded) VALUES
-- Ancien Testament (39 books)
('genese', 'Genèse', 'Genesis', 'Gen', 'AT', 50, 1, false),
('exode', 'Exode', 'Exodus', 'Exo', 'AT', 40, 2, false),
('levitique', 'Lévitique', 'Leviticus', 'Lév', 'AT', 27, 3, false),
('nombres', 'Nombres', 'Numbers', 'Nom', 'AT', 36, 4, false),
('deuteronome', 'Deutéronome', 'Deuteronomy', 'Deu', 'AT', 34, 5, false),
('josue', 'Josué', 'Joshua', 'Jos', 'AT', 24, 6, false),
('juges', 'Juges', 'Judges', 'Jug', 'AT', 21, 7, false),
('ruth', 'Ruth', 'Ruth', 'Rut', 'AT', 4, 8, false),
('1samuel', '1 Samuel', '1 Samuel', '1Sa', 'AT', 31, 9, false),
('2samuel', '2 Samuel', '2 Samuel', '2Sa', 'AT', 24, 10, false),
('1rois', '1 Rois', '1 Kings', '1Ro', 'AT', 22, 11, false),
('2rois', '2 Rois', '2 Kings', '2Ro', 'AT', 25, 12, false),
('1chroniques', '1 Chroniques', '1 Chronicles', '1Ch', 'AT', 29, 13, false),
('2chroniques', '2 Chroniques', '2 Chronicles', '2Ch', 'AT', 36, 14, false),
('esdras', 'Esdras', 'Ezra', 'Esd', 'AT', 10, 15, false),
('nehemie', 'Néhémie', 'Nehemiah', 'Néh', 'AT', 13, 16, false),
('esther', 'Esther', 'Esther', 'Est', 'AT', 10, 17, false),
('job', 'Job', 'Job', 'Job', 'AT', 42, 18, false),
('psaumes', 'Psaumes', 'Psalms', 'Psa', 'AT', 150, 19, false),
('proverbes', 'Proverbes', 'Proverbs', 'Pro', 'AT', 31, 20, false),
('ecclesiaste', 'Ecclésiaste', 'Ecclesiastes', 'Ecc', 'AT', 12, 21, false),
('cantique', 'Cantique des Cantiques', 'Song of Solomon', 'Can', 'AT', 8, 22, false),
('esaie', 'Ésaïe', 'Isaiah', 'Ésa', 'AT', 66, 23, false),
('jeremie', 'Jérémie', 'Jeremiah', 'Jér', 'AT', 52, 24, false),
('lamentations', 'Lamentations', 'Lamentations', 'Lam', 'AT', 5, 25, false),
('ezechiel', 'Ézéchiel', 'Ezekiel', 'Ézé', 'AT', 48, 26, false),
('daniel', 'Daniel', 'Daniel', 'Dan', 'AT', 12, 27, false),
('osee', 'Osée', 'Hosea', 'Osé', 'AT', 14, 28, false),
('joel', 'Joël', 'Joel', 'Joë', 'AT', 3, 29, false),
('amos', 'Amos', 'Amos', 'Amo', 'AT', 9, 30, false),
('abdias', 'Abdias', 'Obadiah', 'Abd', 'AT', 1, 31, false),
('jonas', 'Jonas', 'Jonah', 'Jon', 'AT', 4, 32, false),
('michee', 'Michée', 'Micah', 'Mic', 'AT', 7, 33, false),
('nahum', 'Nahum', 'Nahum', 'Nah', 'AT', 3, 34, false),
('habacuc', 'Habacuc', 'Habakkuk', 'Hab', 'AT', 3, 35, false),
('sophonie', 'Sophonie', 'Zephaniah', 'Sop', 'AT', 3, 36, false),
('aggee', 'Aggée', 'Haggai', 'Agg', 'AT', 2, 37, false),
('zacharie', 'Zacharie', 'Zechariah', 'Zac', 'AT', 14, 38, false),
('malachie', 'Malachie', 'Malachi', 'Mal', 'AT', 4, 39, false),
-- Nouveau Testament (27 books)
('matthieu', 'Matthieu', 'Matthew', 'Mat', 'NT', 28, 40, false),
('marc', 'Marc', 'Mark', 'Mar', 'NT', 16, 41, false),
('luc', 'Luc', 'Luke', 'Luc', 'NT', 24, 42, false),
('jean', 'Jean', 'John', 'Jea', 'NT', 21, 43, false),
('actes', 'Actes', 'Acts', 'Act', 'NT', 28, 44, false),
('romains', 'Romains', 'Romans', 'Rom', 'NT', 16, 45, false),
('1corinthiens', '1 Corinthiens', '1 Corinthians', '1Co', 'NT', 16, 46, false),
('2corinthiens', '2 Corinthiens', '2 Corinthians', '2Co', 'NT', 13, 47, false),
('galates', 'Galates', 'Galatians', 'Gal', 'NT', 6, 48, false),
('ephesiens', 'Éphésiens', 'Ephesians', 'Éph', 'NT', 6, 49, false),
('philippiens', 'Philippiens', 'Philippians', 'Phi', 'NT', 4, 50, false),
('colossiens', 'Colossiens', 'Colossians', 'Col', 'NT', 4, 51, false),
('1thessaloniciens', '1 Thessaloniciens', '1 Thessalonians', '1Th', 'NT', 5, 52, false),
('2thessaloniciens', '2 Thessaloniciens', '2 Thessalonians', '2Th', 'NT', 3, 53, false),
('1timothee', '1 Timothée', '1 Timothy', '1Ti', 'NT', 6, 54, false),
('2timothee', '2 Timothée', '2 Timothy', '2Ti', 'NT', 4, 55, false),
('tite', 'Tite', 'Titus', 'Tit', 'NT', 3, 56, false),
('philemon', 'Philémon', 'Philemon', 'Phm', 'NT', 1, 57, false),
('hebreux', 'Hébreux', 'Hebrews', 'Héb', 'NT', 13, 58, false),
('jacques', 'Jacques', 'James', 'Jac', 'NT', 5, 59, false),
('1pierre', '1 Pierre', '1 Peter', '1Pi', 'NT', 5, 60, false),
('2pierre', '2 Pierre', '2 Peter', '2Pi', 'NT', 3, 61, false),
('1jean', '1 Jean', '1 John', '1Jn', 'NT', 5, 62, false),
('2jean', '2 Jean', '2 John', '2Jn', 'NT', 1, 63, false),
('3jean', '3 Jean', '3 John', '3Jn', 'NT', 1, 64, false),
('jude', 'Jude', 'Jude', 'Jud', 'NT', 1, 65, false),
('apocalypse', 'Apocalypse', 'Revelation', 'Apo', 'NT', 22, 66, false)
ON CONFLICT (book_id) DO NOTHING;

-- 7. Create storage bucket for Bible files (run this separately in Supabase Dashboard > Storage)
-- Or use the API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bible-files', 'bible-files', true);

-- 8. Create bible_chapters table for caching parsed content
CREATE TABLE IF NOT EXISTS bible_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id VARCHAR(50) NOT NULL REFERENCES bible_books(book_id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    content TEXT NOT NULL, -- JSON array of verses
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, chapter_number)
);

-- Enable RLS on bible_chapters
ALTER TABLE bible_chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bible chapters" ON bible_chapters;
CREATE POLICY "Anyone can read bible chapters" ON bible_chapters
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage bible chapters" ON bible_chapters;
CREATE POLICY "Admins can manage bible chapters" ON bible_chapters
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin')
        )
    );

GRANT SELECT ON bible_chapters TO authenticated;
GRANT SELECT ON bible_chapters TO anon;
GRANT ALL ON bible_chapters TO authenticated;

-- 9. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_bible_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bible_books_updated_at ON bible_books;
CREATE TRIGGER update_bible_books_updated_at
    BEFORE UPDATE ON bible_books
    FOR EACH ROW
    EXECUTE FUNCTION update_bible_books_updated_at();

-- ======================================================
-- Also run this in Storage settings:
-- Create bucket: bible-files (public)
-- ======================================================
