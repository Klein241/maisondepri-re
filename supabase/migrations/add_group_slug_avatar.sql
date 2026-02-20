-- ====================================================
-- Migration: Ajouter slug et avatar_url aux prayer_groups
-- Date: 2026-02-20
-- ====================================================

-- Ajouter la colonne slug (unique, pour les liens partageables)
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Ajouter la colonne avatar_url (photo de profil du groupe)
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Index pour recherche rapide par slug
CREATE INDEX IF NOT EXISTS idx_prayer_groups_slug ON prayer_groups(slug);

-- Générer les slugs pour les groupes existants qui n'en ont pas
UPDATE prayer_groups
SET slug = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            TRANSLATE(name, 'àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ', 'aaaeeeeiioouuyçAAAEEEEIIOOUUYC'),
            '[^a-zA-Z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
    )
) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Générer les avatars pour les groupes existants qui n'en ont pas
UPDATE prayer_groups
SET avatar_url = 'https://api.dicebear.com/7.x/shapes/svg?seed=' || ENCODE(name::bytea, 'base64') || '&backgroundColor=6366f1,8b5cf6,a855f7'
WHERE avatar_url IS NULL;
