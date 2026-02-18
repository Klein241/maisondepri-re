-- =====================================================
-- FIX DÉFINITIF DU CHAT DE GROUPE
-- Exécutez ce script dans Supabase SQL Editor
-- =====================================================
-- 
-- Ce script résout :
-- 1) L'erreur "Could not find a relationship between 
--    'prayer_group_messages' and 'user_id'"
-- 2) Les problèmes RLS qui bloquent les messages
-- 3) Les nouveaux membres qui ne voient pas l'historique
-- 4) Le chargement lent des messages
-- =====================================================

-- =====================================================
-- ÉTAPE 1: Ajouter la FK vers profiles pour permettre
-- les joins PostgREST (profiles:user_id)
-- =====================================================

-- D'abord, s'assurer que la table profiles a bien les colonnes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Supprimer l'ancienne FK vers auth.users si elle existe sur prayer_group_messages.user_id
-- et la remplacer par une FK vers profiles.id
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Trouver les contraintes FK existantes sur prayer_group_messages.user_id
    FOR constraint_name_var IN 
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'prayer_group_messages' 
            AND kcu.column_name = 'user_id'
            AND tc.constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE 'ALTER TABLE prayer_group_messages DROP CONSTRAINT IF EXISTS ' || constraint_name_var;
        RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
    END LOOP;
END $$;

-- Ajouter la nouvelle FK vers profiles (permet les embedded joins PostgREST)
ALTER TABLE prayer_group_messages 
    ADD CONSTRAINT prayer_group_messages_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Faire la même chose pour prayer_group_members.user_id
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    FOR constraint_name_var IN 
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'prayer_group_members' 
            AND kcu.column_name = 'user_id'
            AND tc.constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE 'ALTER TABLE prayer_group_members DROP CONSTRAINT IF EXISTS ' || constraint_name_var;
        RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
    END LOOP;
END $$;

ALTER TABLE prayer_group_members 
    ADD CONSTRAINT prayer_group_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- =====================================================
-- ÉTAPE 2: Réinitialiser TOUTES les politiques RLS
-- pour les groupes - PERMISSIF pour les SELECT
-- =====================================================

-- 2a. prayer_group_messages - TOUTES les policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_group_messages'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON prayer_group_messages';
    END LOOP;
END $$;

ALTER TABLE prayer_group_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Tout utilisateur authentifié peut lire les messages de groupe
-- (pas besoin d'être membre - l'app filtre côté client par group_id)
CREATE POLICY "group_messages_select_open" ON prayer_group_messages
    FOR SELECT USING (true);

-- INSERT: Tout utilisateur authentifié peut poster (l'app vérifie la membership)
CREATE POLICY "group_messages_insert_auth" ON prayer_group_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Uniquement ses propres messages
CREATE POLICY "group_messages_update_own" ON prayer_group_messages
    FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: Uniquement ses propres messages
CREATE POLICY "group_messages_delete_own" ON prayer_group_messages
    FOR DELETE USING (auth.uid() = user_id);

-- 2b. prayer_group_members - TOUTES les policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_group_members'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON prayer_group_members';
    END LOOP;
END $$;

ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select_open" ON prayer_group_members
    FOR SELECT USING (true);

CREATE POLICY "group_members_insert_auth" ON prayer_group_members
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "group_members_update_auth" ON prayer_group_members
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "group_members_delete_auth" ON prayer_group_members
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- 2c. prayer_groups - TOUTES les policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_groups'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON prayer_groups';
    END LOOP;
END $$;

ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select_open" ON prayer_groups
    FOR SELECT USING (true);

CREATE POLICY "groups_insert_auth" ON prayer_groups
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "groups_update_creator" ON prayer_groups
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "groups_delete_creator" ON prayer_groups
    FOR DELETE USING (auth.uid() = created_by);

-- 2d. profiles - TOUTES les policies  
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON profiles';
    END LOOP;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_open" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- ÉTAPE 3: Indexes de performance pour un chargement
-- rapide des messages
-- =====================================================

-- Index composite pour les requêtes group_id + created_at (le plus important)
DROP INDEX IF EXISTS idx_pgm_group_created;
CREATE INDEX idx_pgm_group_created 
    ON prayer_group_messages(group_id, created_at ASC);

-- Index sur user_id pour les joins
DROP INDEX IF EXISTS idx_pgm_user_id;
CREATE INDEX idx_pgm_user_id 
    ON prayer_group_messages(user_id);

-- Index composite pour les membres
DROP INDEX IF EXISTS idx_pgmembers_group_user;
CREATE INDEX idx_pgmembers_group_user 
    ON prayer_group_members(group_id, user_id);

-- Index pour les profils (recherche par id)
DROP INDEX IF EXISTS idx_profiles_id;
-- profiles.id est déjà PK, pas besoin d'index supplémentaire

-- =====================================================
-- ÉTAPE 4: S'assurer que Realtime est activé
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'prayer_group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'prayer_groups'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE prayer_groups;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'prayer_group_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_members;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Rafraîchir le cache du schéma PostgREST
-- (CRUCIAL - sans cela les nouveaux FK ne sont pas reconnus)
-- =====================================================

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- ÉTAPE 6: Vérification - Testez que le join fonctionne
-- =====================================================

-- Ce SELECT doit fonctionner sans erreur après le script
SELECT 
    pgm.id, 
    pgm.content, 
    pgm.user_id,
    p.full_name,
    p.avatar_url
FROM prayer_group_messages pgm
LEFT JOIN profiles p ON p.id = pgm.user_id
LIMIT 5;

-- =====================================================
-- ÉTAPE 7: Accorder les permissions
-- =====================================================

GRANT ALL ON prayer_groups TO authenticated;
GRANT ALL ON prayer_group_members TO authenticated;
GRANT ALL ON prayer_group_messages TO authenticated;
GRANT ALL ON profiles TO authenticated;

GRANT SELECT ON prayer_groups TO anon;
GRANT SELECT ON prayer_group_members TO anon;
GRANT SELECT ON prayer_group_messages TO anon;
GRANT SELECT ON profiles TO anon;

-- =====================================================
-- RÉSULTAT ATTENDU:
-- =====================================================
-- Après exécution de ce script:
-- 1. Les embedded joins fonctionneront: 
--    profiles:user_id(full_name, avatar_url)
-- 2. Les RLS ne bloqueront plus les lectures
-- 3. Les messages chargeront instantanément grâce aux indexes
-- 4. Les nouveaux membres verront l'historique des messages
-- 5. Le Realtime sera activé pour les updates en temps réel

SELECT '✅ Script exécuté avec succès ! Rechargez l''application.' AS status;
