-- ============================================
-- VERIFICATION SCRIPT - Prayer Marathon App
-- ============================================
-- Run this script to verify your database setup

-- Check if all tables exist
SELECT 
    'Tables Check' as check_type,
    CASE 
        WHEN COUNT(*) = 5 THEN '✅ All tables exist'
        ELSE '❌ Missing tables: ' || (5 - COUNT(*))::text
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('day_resources', 'testimonials', 'prayer_requests', 'profiles', 'days');

-- Check day_resources table structure
SELECT 
    'day_resources columns' as check_type,
    COUNT(*) as column_count,
    CASE 
        WHEN COUNT(*) >= 10 THEN '✅ Correct structure'
        ELSE '❌ Missing columns'
    END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'day_resources';

-- Check testimonials table for is_approved column
SELECT 
    'testimonials.is_approved' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'testimonials' 
            AND column_name = 'is_approved'
        ) THEN '✅ Column exists'
        ELSE '❌ Column missing'
    END as status;

-- Check RLS is enabled
SELECT 
    'RLS Status' as check_type,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('day_resources', 'testimonials', 'prayer_requests', 'profiles', 'days');

-- Count existing policies
SELECT 
    'RLS Policies' as check_type,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 10 THEN '✅ Policies configured'
        ELSE '⚠️ Few policies: ' || COUNT(*)::text
    END as status
FROM pg_policies 
WHERE schemaname = 'public';

-- Check storage buckets (this will show an error if storage schema doesn't exist, which is normal)
-- You need to check buckets manually in Supabase Dashboard > Storage

-- Sample data check
SELECT 
    'Sample Data' as check_type,
    'day_resources' as table_name,
    COALESCE((SELECT COUNT(*) FROM day_resources), 0) as record_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'day_resources')
UNION ALL
SELECT 
    'Sample Data',
    'testimonials',
    COALESCE((SELECT COUNT(*) FROM testimonials), 0)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'testimonials')
UNION ALL
SELECT 
    'Sample Data',
    'prayer_requests',
    COALESCE((SELECT COUNT(*) FROM prayer_requests), 0)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prayer_requests')
UNION ALL
SELECT 
    'Sample Data',
    'days',
    COALESCE((SELECT COUNT(*) FROM days), 0)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'days');

-- ============================================
-- MANUAL CHECKS REQUIRED
-- ============================================

/*
⚠️ IMPORTANT: Check these manually in Supabase Dashboard

1. STORAGE BUCKETS:
   - Go to Storage section
   - Verify these buckets exist:
     ✓ day-resources
     ✓ testimonial-photos
     ✓ avatars
   
2. STORAGE POLICIES:
   - Click on each bucket
   - Go to Policies tab
   - Verify policies are configured for SELECT, INSERT, UPDATE, DELETE

3. AUTHENTICATION:
   - Go to Authentication > Providers
   - Verify Email and Google OAuth are enabled

4. API KEYS:
   - Go to Settings > API
   - Verify your .env.local has the correct keys:
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
*/

-- ============================================
-- QUICK FIX QUERIES
-- ============================================

-- If is_approved column is missing from testimonials:
-- ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- If photo_url column is missing from testimonials:
-- ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Enable RLS if disabled:
-- ALTER TABLE public.day_resources ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;
