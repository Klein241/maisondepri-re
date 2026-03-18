-- ═══════════════════════════════════════════════════════════
-- UPGRADE: Add "placement" column to library_ads
-- Run this in Supabase SQL Editor if library_ads already exists
-- ═══════════════════════════════════════════════════════════

-- Add the placement column (safe to re-run)
ALTER TABLE library_ads 
    ADD COLUMN IF NOT EXISTS placement TEXT DEFAULT 'book_detail';

-- Add a CHECK constraint for valid placements
-- (ignore error if constraint already exists)
DO $$
BEGIN
    ALTER TABLE library_ads
        ADD CONSTRAINT library_ads_placement_check
        CHECK (placement IN (
            'book_detail',   -- Page détail d'un livre (entre suggestions)
            'home_feed',     -- Flux d'accueil (entre les sections)
            'marketplace',   -- Boutique (produit sponsorisé en haut)
            'reader_end',    -- Fin de lecture d'un livre PDF/EPUB
            'search_results',-- Page de résultats de recherche
            'sidebar'        -- Barre latérale des groupes/salons
        ));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- constraint already exists, skip
END $$;

-- Index on placement for filtered queries
CREATE INDEX IF NOT EXISTS idx_library_ads_placement ON library_ads(placement);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'library_ads' 
ORDER BY ordinal_position;
