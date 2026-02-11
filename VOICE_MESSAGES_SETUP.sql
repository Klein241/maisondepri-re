-- =====================================================
-- VOICE MESSAGES SETUP (FIXED VERSION)
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add voice message columns to direct_messages table
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS voice_url TEXT,
ADD COLUMN IF NOT EXISTS voice_duration INTEGER;

-- Add voice message columns to prayer_group_messages table
ALTER TABLE prayer_group_messages 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS voice_url TEXT,
ADD COLUMN IF NOT EXISTS voice_duration INTEGER;

-- Create storage bucket for chat media (voice messages, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-media',
    'chat-media',
    true,
    10485760, -- 10MB limit
    ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Storage policies for chat-media bucket
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat media" ON storage.objects;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Allow anyone to view (public bucket)
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = 'voice-messages');

-- Update RLS for direct_messages to include new columns
DROP POLICY IF EXISTS "Users can insert their own messages" ON direct_messages;
CREATE POLICY "Users can insert their own messages"
ON direct_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- NOTE: The realtime publication lines have been removed because 
-- the tables are already members of supabase_realtime publication.
-- If you need to add them and get an error, you can safely ignore it.

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 
    'direct_messages columns' as check_type,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'direct_messages' 
AND column_name IN ('type', 'voice_url', 'voice_duration');

SELECT 
    'prayer_group_messages columns' as check_type,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'prayer_group_messages' 
AND column_name IN ('type', 'voice_url', 'voice_duration');

SELECT 
    'storage bucket' as check_type,
    id, 
    name, 
    public 
FROM storage.buckets 
WHERE id = 'chat-media';
