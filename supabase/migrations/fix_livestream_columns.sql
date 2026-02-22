-- Fix missing columns for the livestream tables that were causing 400 Bad Request

-- 1. Add missing parent_id to livestream_comments
ALTER TABLE livestream_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES livestream_comments(id) ON DELETE CASCADE;

-- 2. Rename reaction to emoji in livestream_reactions, or add emoji column
ALTER TABLE livestream_reactions RENAME COLUMN reaction TO emoji;

-- If renaming fails (e.g. column didn't exist), just add it
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE livestream_reactions ADD COLUMN emoji TEXT NOT NULL DEFAULT '👍';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;
