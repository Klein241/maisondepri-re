-- ═══════════════════════════════════════════════════════════
-- FIX PRESENCE: Ensure is_online column exists + RLS allows updates
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure columns exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- 2. Drop existing update policies that might be too restrictive
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own" ON profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- 3. Create a policy that allows users to update their own profile (including is_online/last_seen)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Ensure there's a SELECT policy for reading all profiles
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Anyone can read profiles"
ON profiles FOR SELECT
USING (true);

-- 5. Ensure there's an INSERT policy (for new users via OAuth)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 6. Enable Realtime for the profiles table (needed for postgres_changes)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- 7. Verify the setup
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('is_online', 'last_seen')
ORDER BY column_name;

-- 8. Show current RLS policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';
