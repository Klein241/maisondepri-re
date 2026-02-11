-- =====================================================
-- SCRIPT DE CORRECTION DES POLITIQUES RLS SUPABASE V2
-- Prayer Marathon App - Version corrigée
-- =====================================================

-- =====================================================
-- PARTIE 1: Vérifier le schéma existant
-- Exécutez cette requête d'abord pour voir les colonnes
-- =====================================================

-- Voir les colonnes de direct_messages
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'direct_messages'
ORDER BY ordinal_position;

-- =====================================================
-- PARTIE 2: Corriger prayer_group_members RLS
-- =====================================================

-- Supprimer TOUTES les politiques existantes qui causent la récursion
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_group_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON prayer_group_members', pol.policyname);
    END LOOP;
END $$;

-- Créer des politiques simples sans récursion
-- Lecture: les utilisateurs peuvent voir leurs propres memberships
CREATE POLICY "pgm_select_own" ON prayer_group_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Insertion: les utilisateurs peuvent s'ajouter eux-mêmes
CREATE POLICY "pgm_insert_own" ON prayer_group_members
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Suppression: les utilisateurs peuvent supprimer leur membership
CREATE POLICY "pgm_delete_own" ON prayer_group_members
    FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- PARTIE 3: Corriger prayer_groups RLS
-- =====================================================

-- Supprimer les politiques existantes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_groups'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON prayer_groups', pol.policyname);
    END LOOP;
END $$;

-- Permettre à tous les utilisateurs authentifiés de voir les groupes
CREATE POLICY "pg_select_auth" ON prayer_groups
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permettre aux utilisateurs authentifiés de créer des groupes
CREATE POLICY "pg_insert_auth" ON prayer_groups
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Permettre la mise à jour par le créateur
CREATE POLICY "pg_update_creator" ON prayer_groups
    FOR UPDATE
    USING (created_by = auth.uid());

-- Permettre la suppression par le créateur
CREATE POLICY "pg_delete_creator" ON prayer_groups
    FOR DELETE
    USING (created_by = auth.uid());

-- =====================================================
-- PARTIE 4: Corriger direct_messages RLS
-- =====================================================

-- Supprimer les politiques existantes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'direct_messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON direct_messages', pol.policyname);
    END LOOP;
END $$;

-- Politique simple: les utilisateurs peuvent voir les messages où ils sont sender
CREATE POLICY "dm_select_sender" ON direct_messages
    FOR SELECT
    USING (sender_id = auth.uid());

-- Les utilisateurs peuvent insérer s'ils sont l'expéditeur
CREATE POLICY "dm_insert_sender" ON direct_messages
    FOR INSERT
    WITH CHECK (sender_id = auth.uid());

-- =====================================================
-- PARTIE 5: Ajouter colonnes manquantes pour voice messages
-- =====================================================

-- Ajouter voice_duration à direct_messages si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'direct_messages' 
        AND column_name = 'voice_duration'
    ) THEN
        ALTER TABLE direct_messages ADD COLUMN voice_duration INTEGER;
    END IF;
END $$;

-- Ajouter voice_url à direct_messages si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'direct_messages' 
        AND column_name = 'voice_url'
    ) THEN
        ALTER TABLE direct_messages ADD COLUMN voice_url TEXT;
    END IF;
END $$;

-- Ajouter type à direct_messages si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'direct_messages' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE direct_messages ADD COLUMN type TEXT DEFAULT 'text';
    END IF;
END $$;

-- Même chose pour prayer_group_messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_group_messages' 
        AND column_name = 'voice_duration'
    ) THEN
        ALTER TABLE prayer_group_messages ADD COLUMN voice_duration INTEGER;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_group_messages' 
        AND column_name = 'voice_url'
    ) THEN
        ALTER TABLE prayer_group_messages ADD COLUMN voice_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'prayer_group_messages' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE prayer_group_messages ADD COLUMN type TEXT DEFAULT 'text';
    END IF;
END $$;

-- =====================================================
-- PARTIE 6: S'assurer que RLS est activé
-- =====================================================

ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

-- Vérifier les politiques créées
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('prayer_group_members', 'prayer_groups', 'direct_messages')
ORDER BY tablename, policyname;
