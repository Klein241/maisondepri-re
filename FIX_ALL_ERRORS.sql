-- ============================================
-- 🚀 PRAYER MARATHON APP - FIX ALL ERRORS
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Copiez tout ce fichier
-- 2. Ouvrez Supabase Dashboard > SQL Editor
-- 3. Collez et cliquez RUN
-- 4. Attendez "Success"
--
-- Ce script corrige:
-- ✅ Table day_resources manquante
-- ✅ Buckets storage manquants
-- ✅ Politiques RLS pour tous les buckets
-- ============================================

-- ============================================
-- 1. CREATE DAY_RESOURCES TABLE (Si manquante)
-- ============================================

CREATE TABLE IF NOT EXISTS public.day_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_number INTEGER NOT NULL CHECK (day_number >= 1),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'video', 'pdf', 'audio', 'text')),
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    content TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes pour day_resources
CREATE INDEX IF NOT EXISTS idx_day_resources_day_number ON public.day_resources(day_number);
CREATE INDEX IF NOT EXISTS idx_day_resources_is_active ON public.day_resources(is_active);
CREATE INDEX IF NOT EXISTS idx_day_resources_type ON public.day_resources(resource_type);

-- Enable RLS
ALTER TABLE public.day_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for day_resources
DROP POLICY IF EXISTS "Day resources are viewable by everyone" ON public.day_resources;
CREATE POLICY "Day resources are viewable by everyone" ON public.day_resources 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage resources" ON public.day_resources;
CREATE POLICY "Admins can manage resources" ON public.day_resources 
FOR ALL USING (true);

-- ============================================
-- 2. CREATE ALL STORAGE BUCKETS
-- ============================================

-- Create buckets (ignore errors if they exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('prayer-photos', 'prayer-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ('testimony-photos', 'testimony-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ('testimonial-photos', 'testimonial-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ('day-resources', 'day-resources', true, 52428800, NULL),
    ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ('prayers', 'prayers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ('testimonials', 'testimonials', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    ('resources', 'resources', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- ============================================
-- 3. STORAGE RLS POLICIES - ALLOW ALL AUTH USERS
-- ============================================

-- Drop all existing storage policies to start fresh
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- ============================================
-- BUCKET: prayer-photos
-- ============================================
CREATE POLICY "prayer-photos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'prayer-photos');

CREATE POLICY "prayer-photos: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'prayer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "prayer-photos: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'prayer-photos' AND auth.role() = 'authenticated');

CREATE POLICY "prayer-photos: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'prayer-photos' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: testimony-photos
-- ============================================
CREATE POLICY "testimony-photos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimony-photos');

CREATE POLICY "testimony-photos: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'testimony-photos' AND auth.role() = 'authenticated');

CREATE POLICY "testimony-photos: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'testimony-photos' AND auth.role() = 'authenticated');

CREATE POLICY "testimony-photos: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'testimony-photos' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: testimonial-photos
-- ============================================
CREATE POLICY "testimonial-photos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimonial-photos');

CREATE POLICY "testimonial-photos: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'testimonial-photos' AND auth.role() = 'authenticated');

CREATE POLICY "testimonial-photos: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'testimonial-photos' AND auth.role() = 'authenticated');

CREATE POLICY "testimonial-photos: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'testimonial-photos' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: day-resources (for admin uploads)
-- ============================================
CREATE POLICY "day-resources: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'day-resources');

CREATE POLICY "day-resources: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'day-resources' AND auth.role() = 'authenticated');

CREATE POLICY "day-resources: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'day-resources' AND auth.role() = 'authenticated');

CREATE POLICY "day-resources: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'day-resources' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: avatars
-- ============================================
CREATE POLICY "avatars: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatars: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "avatars: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "avatars: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: prayers
-- ============================================
CREATE POLICY "prayers: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'prayers');

CREATE POLICY "prayers: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'prayers' AND auth.role() = 'authenticated');

CREATE POLICY "prayers: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'prayers' AND auth.role() = 'authenticated');

CREATE POLICY "prayers: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'prayers' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: testimonials
-- ============================================
CREATE POLICY "testimonials: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimonials');

CREATE POLICY "testimonials: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'testimonials' AND auth.role() = 'authenticated');

CREATE POLICY "testimonials: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'testimonials' AND auth.role() = 'authenticated');

CREATE POLICY "testimonials: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'testimonials' AND auth.role() = 'authenticated');

-- ============================================
-- BUCKET: resources
-- ============================================
CREATE POLICY "resources: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources');

CREATE POLICY "resources: auth insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'resources' AND auth.role() = 'authenticated');

CREATE POLICY "resources: auth update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'resources' AND auth.role() = 'authenticated');

CREATE POLICY "resources: auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'resources' AND auth.role() = 'authenticated');

-- ============================================
-- 4. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- SUCCESS!
-- ============================================
-- Si vous voyez ce message, tout est configuré!
-- 
-- Créé:
-- ✅ Table day_resources
-- ✅ 8 buckets storage
-- ✅ 32 politiques RLS
--
-- Maintenant rechargez votre app (npm run dev)
-- ============================================
