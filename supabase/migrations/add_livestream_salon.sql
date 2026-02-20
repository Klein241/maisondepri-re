-- ====================================================
-- Migration: Salon de Streaming en direct pour les groupes
-- Date: 2026-02-20
-- ====================================================

-- Table principale des livestreams
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

-- Table des commentaires en direct
CREATE TABLE IF NOT EXISTS livestream_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id UUID NOT NULL REFERENCES group_livestreams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    parent_id UUID REFERENCES livestream_comments(id) ON DELETE CASCADE,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des réactions en direct
CREATE TABLE IF NOT EXISTS livestream_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id UUID NOT NULL REFERENCES group_livestreams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    emoji TEXT NOT NULL DEFAULT '❤️',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des membres bannis d'un live
CREATE TABLE IF NOT EXISTS livestream_banned_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    livestream_id UUID NOT NULL REFERENCES group_livestreams(id) ON DELETE CASCADE,
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

-- RLS Policies: group_livestreams
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

-- RLS Policies: livestream_comments
CREATE POLICY "Membres peuvent voir les commentaires"
    ON livestream_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_livestreams gl
            JOIN prayer_group_members pgm ON pgm.group_id = gl.group_id
            WHERE gl.id = livestream_comments.livestream_id
            AND pgm.user_id = auth.uid()
        )
    );

CREATE POLICY "Membres peuvent commenter"
    ON livestream_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auteur ou admin peut supprimer commentaire"
    ON livestream_comments FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_livestreams gl
            WHERE gl.id = livestream_comments.livestream_id
            AND gl.created_by = auth.uid()
        )
    );

-- RLS Policies: livestream_reactions
CREATE POLICY "Membres peuvent voir les réactions"
    ON livestream_reactions FOR SELECT
    USING (true);

CREATE POLICY "Membres peuvent réagir"
    ON livestream_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies: livestream_banned_users
CREATE POLICY "Admin peut voir les bannis"
    ON livestream_banned_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_livestreams gl
            WHERE gl.id = livestream_banned_users.livestream_id
            AND gl.created_by = auth.uid()
        )
    );

CREATE POLICY "Admin peut bannir"
    ON livestream_banned_users FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_livestreams gl
            WHERE gl.id = livestream_banned_users.livestream_id
            AND gl.created_by = auth.uid()
        )
    );

CREATE POLICY "Admin peut débannir"
    ON livestream_banned_users FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM group_livestreams gl
            WHERE gl.id = livestream_banned_users.livestream_id
            AND gl.created_by = auth.uid()
        )
    );

-- Enable Realtime for live comments/reactions
ALTER PUBLICATION supabase_realtime ADD TABLE livestream_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE livestream_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE group_livestreams;
