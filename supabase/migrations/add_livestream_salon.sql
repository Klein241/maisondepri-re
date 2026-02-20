-- ====================================================
-- Migration: Salon de Streaming en direct (IDEMPOTENT)
-- Peut être exécutée plusieurs fois sans erreur
-- Date: 2026-02-20 (fix: 2026-02-21)
-- ====================================================

-- 1. Table principale des livestreams de groupe
CREATE TABLE IF NOT EXISTS group_livestreams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES prayer_groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL DEFAULT 'Diffusion en direct',
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'youtube', 'tiktok', 'instagram', 'twitch', 'other')),
    embed_url TEXT,
    embed_code TEXT,
    is_active BOOLEAN DEFAULT true,
    viewer_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des commentaires en direct (FK optionnelle pour support du live global)
CREATE TABLE IF NOT EXISTS livestream_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL,  -- TEXT pour supporter group UUID et 'global-live'
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    parent_id UUID REFERENCES livestream_comments(id) ON DELETE CASCADE,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des réactions en direct
CREATE TABLE IF NOT EXISTS livestream_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL,  -- TEXT pour supporter group UUID et 'global-live'
    user_id UUID NOT NULL REFERENCES auth.users(id),
    emoji TEXT NOT NULL DEFAULT '❤️',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des membres bannis d'un live
CREATE TABLE IF NOT EXISTS livestream_banned_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    banned_by UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(livestream_id, user_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_livestreams_group ON group_livestreams(group_id);
CREATE INDEX IF NOT EXISTS idx_livestreams_active ON group_livestreams(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_livestream_comments_stream ON livestream_comments(livestream_id, created_at);
CREATE INDEX IF NOT EXISTS idx_livestream_comments_parent ON livestream_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_livestream_reactions_stream ON livestream_reactions(livestream_id);

-- Enable RLS
ALTER TABLE group_livestreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestream_banned_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP existing policies before recreating (IDEMPOTENT)
-- =====================================================

-- group_livestreams policies
DROP POLICY IF EXISTS "Membres du groupe peuvent voir les lives" ON group_livestreams;
DROP POLICY IF EXISTS "Admin du groupe peut créer des lives" ON group_livestreams;
DROP POLICY IF EXISTS "Créateur peut modifier/terminer son live" ON group_livestreams;
DROP POLICY IF EXISTS "Créateur peut supprimer son live" ON group_livestreams;

-- livestream_comments policies
DROP POLICY IF EXISTS "Membres peuvent voir les commentaires" ON livestream_comments;
DROP POLICY IF EXISTS "Membres peuvent commenter" ON livestream_comments;
DROP POLICY IF EXISTS "Auteur ou admin peut supprimer commentaire" ON livestream_comments;
DROP POLICY IF EXISTS "Tout le monde peut voir les commentaires" ON livestream_comments;
DROP POLICY IF EXISTS "Utilisateur connecte peut commenter" ON livestream_comments;
DROP POLICY IF EXISTS "Auteur ou admin peut supprimer" ON livestream_comments;

-- livestream_reactions policies
DROP POLICY IF EXISTS "Membres peuvent voir les réactions" ON livestream_reactions;
DROP POLICY IF EXISTS "Membres peuvent réagir" ON livestream_reactions;
DROP POLICY IF EXISTS "Tout le monde peut voir les reactions" ON livestream_reactions;
DROP POLICY IF EXISTS "Utilisateur connecte peut reagir" ON livestream_reactions;

-- livestream_banned_users policies
DROP POLICY IF EXISTS "Admin peut voir les bannis" ON livestream_banned_users;
DROP POLICY IF EXISTS "Admin peut bannir" ON livestream_banned_users;
DROP POLICY IF EXISTS "Admin peut débannir" ON livestream_banned_users;

-- =====================================================
-- CREATE new policies (plus permissives pour le live global)
-- =====================================================

-- group_livestreams: accès via membership de groupe
CREATE POLICY "Membres du groupe peuvent voir les lives"
    ON group_livestreams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prayer_group_members
            WHERE prayer_group_members.group_id = group_livestreams.group_id
            AND prayer_group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Admin du groupe peut créer des lives"
    ON group_livestreams FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prayer_group_members
            WHERE prayer_group_members.group_id = group_livestreams.group_id
            AND prayer_group_members.user_id = auth.uid()
            AND prayer_group_members.role IN ('admin', 'moderator')
        )
    );

CREATE POLICY "Créateur peut modifier/terminer son live"
    ON group_livestreams FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Créateur peut supprimer son live"
    ON group_livestreams FOR DELETE
    USING (created_by = auth.uid());

-- livestream_comments: ouvert à tout utilisateur connecté (pour le live global)
CREATE POLICY "Tout le monde peut voir les commentaires"
    ON livestream_comments FOR SELECT
    USING (true);

CREATE POLICY "Utilisateur connecte peut commenter"
    ON livestream_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auteur ou admin peut supprimer"
    ON livestream_comments FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- livestream_reactions: ouvert à tout utilisateur connecté
CREATE POLICY "Tout le monde peut voir les reactions"
    ON livestream_reactions FOR SELECT
    USING (true);

CREATE POLICY "Utilisateur connecte peut reagir"
    ON livestream_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- livestream_banned_users: admin seulement
CREATE POLICY "Admin peut voir les bannis"
    ON livestream_banned_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin peut bannir"
    ON livestream_banned_users FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin peut débannir"
    ON livestream_banned_users FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Enable Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE livestream_comments;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE livestream_reactions;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_livestreams;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure app_settings table has live settings
INSERT INTO app_settings (key, value) VALUES ('live_stream_active', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('live_stream_url', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('live_platform', 'youtube') ON CONFLICT (key) DO NOTHING;
