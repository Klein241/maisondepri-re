-- =====================================================
-- SCRIPT DE CORRECTION DES POLITIQUES RLS SUPABASE
-- Prayer Marathon App - À exécuter dans Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PARTIE 1: Corriger la table prayer_group_members
-- =====================================================

-- D'abord, supprimer les politiques existantes qui causent la récursion
DROP POLICY IF EXISTS "prayer_group_members_select" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_insert" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_update" ON prayer_group_members;
DROP POLICY IF EXISTS "prayer_group_members_delete" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can view group membership" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON prayer_group_members;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON prayer_group_members;
DROP POLICY IF EXISTS "Allow authenticated access" ON prayer_group_members;
DROP POLICY IF EXISTS "Allow all authenticated users" ON prayer_group_members;

-- Désactiver temporairement RLS pour vérifier la structure
-- ALTER TABLE prayer_group_members DISABLE ROW LEVEL SECURITY;

-- Créer des politiques simples qui ne causent pas de récursion
-- Politique de lecture: les utilisateurs peuvent voir leurs propres memberships
CREATE POLICY "prayer_group_members_select_own" ON prayer_group_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Politique d'insertion: les utilisateurs peuvent s'ajouter eux-mêmes
CREATE POLICY "prayer_group_members_insert_own" ON prayer_group_members
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Politique de suppression: les utilisateurs peuvent supprimer leur membership
CREATE POLICY "prayer_group_members_delete_own" ON prayer_group_members
    FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- PARTIE 2: Ajouter une politique pour les admins (optionnel)
-- =====================================================

-- Si vous avez un système d'admin, ajoutez cette politique
-- Cette politique permet aux admins de tout voir/modifier

-- CREATE POLICY "prayer_group_members_admin_all" ON prayer_group_members
--     FOR ALL
--     USING (
--         EXISTS (
--             SELECT 1 FROM profiles 
--             WHERE profiles.id = auth.uid() 
--             AND profiles.role = 'admin'
--         )
--     );

-- =====================================================
-- PARTIE 3: Corriger les clés étrangères de direct_messages
-- =====================================================

-- Vérifier si les clés étrangères existent déjà
-- Si non, les créer

-- Ajouter la clé étrangère pour sender_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'direct_messages_sender_id_fkey'
        AND table_name = 'direct_messages'
    ) THEN
        ALTER TABLE direct_messages
        ADD CONSTRAINT direct_messages_sender_id_fkey
        FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ajouter la clé étrangère pour receiver_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'direct_messages_receiver_id_fkey'
        AND table_name = 'direct_messages'
    ) THEN
        ALTER TABLE direct_messages
        ADD CONSTRAINT direct_messages_receiver_id_fkey
        FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- PARTIE 4: Ajouter la colonne voice_duration si manquante
-- =====================================================

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

-- =====================================================
-- PARTIE 5: Corriger les politiques de prayer_groups
-- =====================================================

-- Si prayer_groups a des politiques problématiques, les remplacer
DROP POLICY IF EXISTS "prayer_groups_select" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_insert" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_update" ON prayer_groups;
DROP POLICY IF EXISTS "prayer_groups_delete" ON prayer_groups;

-- Permettre à tous les utilisateurs authentifiés de voir les groupes
CREATE POLICY "prayer_groups_select_all" ON prayer_groups
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permettre aux utilisateurs authentifiés de créer des groupes
CREATE POLICY "prayer_groups_insert_auth" ON prayer_groups
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Permettre la mise à jour par le créateur (ou admin)
CREATE POLICY "prayer_groups_update_creator" ON prayer_groups
    FOR UPDATE
    USING (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- =====================================================
-- PARTIE 6: S'assurer que RLS est activé
-- =====================================================

ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Vérifier les politiques créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('prayer_group_members', 'prayer_groups', 'direct_messages')
ORDER BY tablename, policyname;
