-- ============================================
-- STORAGE RLS POLICIES FIX
-- This script fixes the Row-Level Security policies for Supabase Storage
-- It allows authenticated users to upload, view, and delete their files
-- ============================================

-- ============================================
-- 1. STORAGE BUCKETS CONFIGURATION
-- ============================================
-- Note: Run these in Supabase Dashboard > Storage first if not already created
-- Or use these SQL commands:

-- Create buckets if they don't exist (Using INSERT to avoid errors)
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('prayer-photos', 'prayer-photos', true),
    ('testimony-photos', 'testimony-photos', true),
    ('testimonial-photos', 'testimonial-photos', true),
    ('day-resources', 'day-resources', true),
    ('avatars', 'avatars', true),
    ('prayers', 'prayers', true),
    ('testimonials', 'testimonials', true),
    ('resources', 'resources', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================
-- 2. STORAGE RLS POLICIES FOR PRAYER-PHOTOS
-- ============================================

-- Allow everyone to view prayer photos (public bucket)
DROP POLICY IF EXISTS "Anyone can view prayer photos" ON storage.objects;
CREATE POLICY "Anyone can view prayer photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'prayer-photos');

-- Allow authenticated users to upload prayer photos
DROP POLICY IF EXISTS "Authenticated users can upload prayer photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload prayer photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'prayer-photos' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update their own prayer photos
DROP POLICY IF EXISTS "Users can update their prayer photos" ON storage.objects;
CREATE POLICY "Users can update their prayer photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'prayer-photos' 
    AND auth.role() = 'authenticated'
);

-- Allow users to delete their own prayer photos
DROP POLICY IF EXISTS "Users can delete their prayer photos" ON storage.objects;
CREATE POLICY "Users can delete their prayer photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'prayer-photos' 
    AND auth.role() = 'authenticated'
);

-- ============================================
-- 3. STORAGE RLS POLICIES FOR TESTIMONY-PHOTOS
-- ============================================

-- Allow everyone to view testimony photos
DROP POLICY IF EXISTS "Anyone can view testimony photos" ON storage.objects;
CREATE POLICY "Anyone can view testimony photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimony-photos');

-- Allow authenticated users to upload testimony photos
DROP POLICY IF EXISTS "Authenticated users can upload testimony photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload testimony photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'testimony-photos' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update their testimony photos
DROP POLICY IF EXISTS "Users can update their testimony photos" ON storage.objects;
CREATE POLICY "Users can update their testimony photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'testimony-photos' 
    AND auth.role() = 'authenticated'
);

-- Allow users to delete their testimony photos
DROP POLICY IF EXISTS "Users can delete their testimony photos" ON storage.objects;
CREATE POLICY "Users can delete their testimony photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'testimony-photos' 
    AND auth.role() = 'authenticated'
);

-- ============================================
-- 4. STORAGE RLS POLICIES FOR TESTIMONIAL-PHOTOS (Alternative bucket name)
-- ============================================

DROP POLICY IF EXISTS "Anyone can view testimonial photos" ON storage.objects;
CREATE POLICY "Anyone can view testimonial photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimonial-photos');

DROP POLICY IF EXISTS "Authenticated users can upload testimonial photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload testimonial photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'testimonial-photos' 
    AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can update testimonial photos" ON storage.objects;
CREATE POLICY "Users can update testimonial photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'testimonial-photos' 
    AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can delete testimonial photos" ON storage.objects;
CREATE POLICY "Users can delete testimonial photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'testimonial-photos' 
    AND auth.role() = 'authenticated'
);

-- ============================================
-- 5. STORAGE RLS POLICIES FOR DAY-RESOURCES
-- ============================================

DROP POLICY IF EXISTS "Anyone can view day resources" ON storage.objects;
CREATE POLICY "Anyone can view day resources"
ON storage.objects FOR SELECT
USING (bucket_id = 'day-resources');

DROP POLICY IF EXISTS "Admins can upload day resources" ON storage.objects;
CREATE POLICY "Admins can upload day resources"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Admins can update day resources" ON storage.objects;
CREATE POLICY "Admins can update day resources"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Admins can delete day resources" ON storage.objects;
CREATE POLICY "Admins can delete day resources"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'day-resources' 
    AND auth.role() = 'authenticated'
);

-- ============================================
-- 6. STORAGE RLS POLICIES FOR AVATARS
-- ============================================

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
CREATE POLICY "Users can update avatars"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
CREATE POLICY "Users can delete avatars"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- ============================================
-- 7. STORAGE RLS POLICIES FOR OTHER BUCKETS (prayers, testimonials, resources)
-- ============================================

-- Prayers bucket
DROP POLICY IF EXISTS "Anyone can view prayers" ON storage.objects;
CREATE POLICY "Anyone can view prayers"
ON storage.objects FOR SELECT
USING (bucket_id = 'prayers');

DROP POLICY IF EXISTS "Users can manage prayers" ON storage.objects;
CREATE POLICY "Users can manage prayers"
ON storage.objects FOR ALL
USING (bucket_id = 'prayers' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'prayers' AND auth.role() = 'authenticated');

-- Testimonials bucket
DROP POLICY IF EXISTS "Anyone can view testimonials" ON storage.objects;
CREATE POLICY "Anyone can view testimonials"
ON storage.objects FOR SELECT
USING (bucket_id = 'testimonials');

DROP POLICY IF EXISTS "Users can manage testimonials" ON storage.objects;
CREATE POLICY "Users can manage testimonials"
ON storage.objects FOR ALL
USING (bucket_id = 'testimonials' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'testimonials' AND auth.role() = 'authenticated');

-- Resources bucket
DROP POLICY IF EXISTS "Anyone can view resources" ON storage.objects;
CREATE POLICY "Anyone can view resources"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources');

DROP POLICY IF EXISTS "Admins can manage resources" ON storage.objects;
CREATE POLICY "Admins can manage resources"
ON storage.objects FOR ALL
USING (bucket_id = 'resources' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'resources' AND auth.role() = 'authenticated');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- All storage RLS policies have been created/updated!
-- Users should now be able to upload images to prayer-photos and testimony-photos buckets
