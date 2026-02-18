-- ============================================================================
-- SCRIPT SUPABASE : CORRECTION DES POLITIQUES RLS POUR LES GROUPES DE PRIÈRE
-- ============================================================================
-- Ce script doit être exécuté dans l'éditeur SQL de Supabase (Dashboard > SQL Editor)
-- Il corrige TOUS les problèmes RLS qui empêchent :
--   1. Les nouveaux membres de voir les messages existants
--   2. Les membres de lire/écrire des messages de groupe
--   3. Les commentaires/réactions de persister
--   4. Le group apparaît vide quand on revient
-- ============================================================================

-- =============================================
-- ÉTAPE 1: PRAYER_GROUP_MESSAGES (messages de groupe)
-- =============================================

-- Supprimer TOUTES les anciennes politiques RLS sur prayer_group_messages
DO $$ 
DECLARE 
    pol_name TEXT;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_group_messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON prayer_group_messages', pol_name);
    END LOOP;
END $$;

-- Activer RLS (requis pour que les politiques s'appliquent)
ALTER TABLE prayer_group_messages ENABLE ROW LEVEL SECURITY;

-- Politique LECTURE : Tous les utilisateurs authentifiés peuvent lire les messages
-- des groupes dont ils sont membres
CREATE POLICY "group_messages_select_members" ON prayer_group_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM prayer_group_members 
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id 
        AND prayer_group_members.user_id = auth.uid()
    )
    OR
    -- Le créateur du groupe peut aussi lire
    EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = prayer_group_messages.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
);

-- Politique INSERTION : Tous les membres peuvent envoyer des messages
CREATE POLICY "group_messages_insert_members" ON prayer_group_messages
FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
        EXISTS (
            SELECT 1 FROM prayer_group_members 
            WHERE prayer_group_members.group_id = prayer_group_messages.group_id 
            AND prayer_group_members.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM prayer_groups 
            WHERE prayer_groups.id = prayer_group_messages.group_id 
            AND prayer_groups.created_by = auth.uid()
        )
    )
);

-- Politique SUPPRESSION : L'auteur ou l'admin peut supprimer
CREATE POLICY "group_messages_delete_own" ON prayer_group_messages
FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = prayer_group_messages.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM prayer_group_members 
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id 
        AND prayer_group_members.user_id = auth.uid()
        AND prayer_group_members.role = 'admin'
    )
);


-- =============================================
-- ÉTAPE 2: PRAYER_GROUP_MEMBERS (membres de groupe)
-- =============================================

DO $$ 
DECLARE 
    pol_name TEXT;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_group_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON prayer_group_members', pol_name);
    END LOOP;
END $$;

ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir qui est membre d'un groupe
CREATE POLICY "group_members_select_all" ON prayer_group_members
FOR SELECT USING (true);

-- Un utilisateur peut rejoindre un groupe
CREATE POLICY "group_members_insert_self" ON prayer_group_members
FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = prayer_group_members.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
);

-- Un utilisateur peut quitter ou un admin peut retirer
CREATE POLICY "group_members_delete" ON prayer_group_members
FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = prayer_group_members.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
);

-- Un admin peut modifier les rôles
CREATE POLICY "group_members_update" ON prayer_group_members
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = prayer_group_members.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm2
        WHERE pgm2.group_id = prayer_group_members.group_id 
        AND pgm2.user_id = auth.uid()
        AND pgm2.role = 'admin'
    )
);


-- =============================================
-- ÉTAPE 3: PRAYER_GROUPS (groupes)
-- =============================================

DO $$ 
DECLARE 
    pol_name TEXT;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'prayer_groups'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON prayer_groups', pol_name);
    END LOOP;
END $$;

ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les groupes
CREATE POLICY "groups_select_all" ON prayer_groups
FOR SELECT USING (true);

-- Utilisateurs authentifiés peuvent créer des groupes
CREATE POLICY "groups_insert_auth" ON prayer_groups
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seul le créateur peut modifier
CREATE POLICY "groups_update_creator" ON prayer_groups
FOR UPDATE USING (auth.uid() = created_by);

-- Seul le créateur peut supprimer
CREATE POLICY "groups_delete_creator" ON prayer_groups
FOR DELETE USING (auth.uid() = created_by);


-- =============================================
-- ÉTAPE 4: TABLE DE COMMENTAIRES (NOUVEAU)
-- Créer une table pour les commentaires de messages
-- =============================================

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS group_message_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL,
    group_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_comments_message_id ON group_message_comments(message_id);
CREATE INDEX IF NOT EXISTS idx_comments_group_id ON group_message_comments(group_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON group_message_comments(created_at);

-- RLS pour les commentaires
ALTER TABLE group_message_comments ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques
DO $$ 
DECLARE 
    pol_name TEXT;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'group_message_comments'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON group_message_comments', pol_name);
    END LOOP;
END $$;

-- Lecture : les membres du groupe peuvent lire
CREATE POLICY "comments_select_members" ON group_message_comments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM prayer_group_members 
        WHERE prayer_group_members.group_id = group_message_comments.group_id 
        AND prayer_group_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = group_message_comments.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
);

-- Insertion : les membres peuvent commenter
CREATE POLICY "comments_insert_members" ON group_message_comments
FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
        EXISTS (
            SELECT 1 FROM prayer_group_members 
            WHERE prayer_group_members.group_id = group_message_comments.group_id 
            AND prayer_group_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM prayer_groups 
            WHERE prayer_groups.id = group_message_comments.group_id 
            AND prayer_groups.created_by = auth.uid()
        )
    )
);

-- Suppression : l'auteur peut supprimer son commentaire
CREATE POLICY "comments_delete_own" ON group_message_comments
FOR DELETE USING (auth.uid() = user_id);


-- =============================================
-- ÉTAPE 5: TABLE DE RÉACTIONS (NOUVEAU)
-- =============================================

CREATE TABLE IF NOT EXISTS group_message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL,
    group_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON group_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_group_id ON group_message_reactions(group_id);

ALTER TABLE group_message_reactions ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol_name TEXT;
BEGIN
    FOR pol_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'group_message_reactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON group_message_reactions', pol_name);
    END LOOP;
END $$;

CREATE POLICY "reactions_select_members" ON group_message_reactions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM prayer_group_members 
        WHERE prayer_group_members.group_id = group_message_reactions.group_id 
        AND prayer_group_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM prayer_groups 
        WHERE prayer_groups.id = group_message_reactions.group_id 
        AND prayer_groups.created_by = auth.uid()
    )
);

CREATE POLICY "reactions_insert_members" ON group_message_reactions
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "reactions_delete_own" ON group_message_reactions
FOR DELETE USING (auth.uid() = user_id);


-- =============================================
-- ÉTAPE 6: VÉRIFICATION + REALTIME
-- =============================================

-- Activer le Realtime sur les tables critiques (avec gestion d'erreur si déjà membre)
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE group_message_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE group_message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =============================================
-- ÉTAPE 7: ASSURER QUE LE CRÉATEUR EST MEMBRE
-- =============================================

INSERT INTO prayer_group_members (group_id, user_id, role)
SELECT pg.id, pg.created_by, 'admin'
FROM prayer_groups pg
LEFT JOIN prayer_group_members pgm 
    ON pgm.group_id = pg.id AND pgm.user_id = pg.created_by
WHERE pgm.id IS NULL;

-- =============================================
-- ÉTAPE 8: FONCTION POUR SUPPRIMER UN UTILISATEUR PROPREMENT
-- =============================================
-- Cette fonction supprime toutes les données liées à un utilisateur
-- puis supprime son profil. Utilisez-la quand la suppression directe échoue.

CREATE OR REPLACE FUNCTION delete_user_cascade(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Supprimer les messages privés
    DELETE FROM direct_messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;
    -- Supprimer les messages de groupe
    DELETE FROM prayer_group_messages WHERE user_id = target_user_id;
    -- Supprimer les appartenances aux groupes
    DELETE FROM prayer_group_members WHERE user_id = target_user_id;
    -- Supprimer les commentaires
    DELETE FROM group_message_comments WHERE user_id = target_user_id;
    -- Supprimer les réactions
    DELETE FROM group_message_reactions WHERE user_id = target_user_id;
    -- Supprimer les demandes d'amitié
    DELETE FROM friendships WHERE user_id = target_user_id OR friend_id = target_user_id;
    -- Supprimer les conversations
    DELETE FROM conversations WHERE user1_id = target_user_id OR user2_id = target_user_id;
    -- Supprimer les prières
    DELETE FROM prayers WHERE user_id = target_user_id;
    -- Supprimer les témoignages
    DELETE FROM testimonies WHERE user_id = target_user_id;
    -- Supprimer les demandes de rejoindre un groupe
    BEGIN DELETE FROM prayer_group_join_requests WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    -- Supprimer le profil
    DELETE FROM profiles WHERE id = target_user_id;
    -- Enfin supprimer l'utilisateur auth
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIN DU SCRIPT
-- =============================================
-- Après exécution, TOUS les membres pourront :
-- ✅ Lire les messages de groupe (y compris les anciens)
-- ✅ Écrire dans les groupes
-- ✅ Voir les commentaires des autres membres
-- ✅ Réagir aux messages avec des emojis
-- ✅ Recevoir les mises à jour en temps réel
--
-- Pour supprimer un utilisateur récalcitrant :
-- SELECT delete_user_cascade('USER_ID_ICI');
-- ============================================================================
