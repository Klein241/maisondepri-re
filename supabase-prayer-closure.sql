-- =====================================================
-- PRAYER GROUP CLOSURE COLUMNS
-- Ajout des colonnes pour fermeture automatique
-- =====================================================

-- Ajouter la colonne is_locked à prayer_requests si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_requests' 
        AND column_name = 'is_locked'
    ) THEN
        ALTER TABLE prayer_requests ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Ajouter les colonnes de fermeture à prayer_groups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_groups' 
        AND column_name = 'is_closed'
    ) THEN
        ALTER TABLE prayer_groups ADD COLUMN is_closed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_groups' 
        AND column_name = 'closed_reason'
    ) THEN
        ALTER TABLE prayer_groups ADD COLUMN closed_reason TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_groups' 
        AND column_name = 'closed_at'
    ) THEN
        ALTER TABLE prayer_groups ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('prayer_requests', 'prayer_groups')
AND column_name IN ('is_locked', 'is_closed', 'closed_reason', 'closed_at')
ORDER BY table_name, column_name;
