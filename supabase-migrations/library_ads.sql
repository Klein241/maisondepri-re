-- ═══════════════════════════════════════════════════════════
-- ADVERTISING SPACE — Configurable from Admin Backoffice
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS library_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    link_url TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    -- 6 placements disponibles dans l'application:
    -- 'book_detail'    → Page détail d'un livre (entre suggestions)
    -- 'home_feed'      → Flux d'accueil (entre les sections)
    -- 'marketplace'    → Boutique (produit sponsorisé en haut)
    -- 'reader_end'     → Fin de lecture d'un livre PDF/EPUB
    -- 'search_results' → Page de résultats de recherche
    -- 'sidebar'        → Barre latérale des groupes/salons
    placement TEXT DEFAULT 'book_detail' CHECK (placement IN (
        'book_detail', 'home_feed', 'marketplace',
        'reader_end', 'search_results', 'sidebar'
    )),
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Anyone can read active ads, only admins can manage
ALTER TABLE library_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active ads" ON library_ads;
CREATE POLICY "Anyone can read active ads" ON library_ads
    FOR SELECT USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "Service role manages ads" ON library_ads;
CREATE POLICY "Service role manages ads" ON library_ads
    FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_library_ads_active ON library_ads(is_active, display_order);
