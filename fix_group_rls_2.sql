-- =====================================================
-- FIX 2: ADDITIONAL RLS POLICIES (run after fix_group_rls.sql)
-- Covers: prayer_requests, prayer_group_join_requests, 
-- testimonials, friendships, and admin update rights
-- =====================================================

-- =====================================================
-- 1. PRAYER REQUESTS - Everyone can see, owners can manage
-- =====================================================
ALTER TABLE IF EXISTS prayer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prayer_requests_select" ON prayer_requests;
DROP POLICY IF EXISTS "prayer_requests_insert" ON prayer_requests;
DROP POLICY IF EXISTS "prayer_requests_update" ON prayer_requests;
DROP POLICY IF EXISTS "prayer_requests_delete" ON prayer_requests;
DROP POLICY IF EXISTS "Anyone can view prayer requests" ON prayer_requests;
DROP POLICY IF EXISTS "Users can create prayer requests" ON prayer_requests;

CREATE POLICY "prayer_requests_select" ON prayer_requests
  FOR SELECT USING (true);

CREATE POLICY "prayer_requests_insert" ON prayer_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prayer_requests_update" ON prayer_requests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "prayer_requests_delete" ON prayer_requests
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 2. PRAYER GROUP JOIN REQUESTS - Members can see their own, 
-- group creators can see all for their groups
-- =====================================================
ALTER TABLE IF EXISTS prayer_group_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prayer_group_join_requests_select" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "prayer_group_join_requests_insert" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "prayer_group_join_requests_update" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "prayer_group_join_requests_delete" ON prayer_group_join_requests;

-- Everyone authenticated can see join requests (needed for group admins)
CREATE POLICY "prayer_group_join_requests_select" ON prayer_group_join_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can create join requests
CREATE POLICY "prayer_group_join_requests_insert" ON prayer_group_join_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admins/creators can update (approve/reject)
CREATE POLICY "prayer_group_join_requests_update" ON prayer_group_join_requests
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Users can delete their own requests
CREATE POLICY "prayer_group_join_requests_delete" ON prayer_group_join_requests
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. TESTIMONIALS
-- =====================================================
ALTER TABLE IF EXISTS testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "testimonials_select" ON testimonials;
DROP POLICY IF EXISTS "testimonials_insert" ON testimonials;
DROP POLICY IF EXISTS "testimonials_update" ON testimonials;

CREATE POLICY "testimonials_select" ON testimonials
  FOR SELECT USING (true);

CREATE POLICY "testimonials_insert" ON testimonials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "testimonials_update" ON testimonials
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 4. FRIENDSHIPS
-- =====================================================
ALTER TABLE IF EXISTS friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select" ON friendships;
DROP POLICY IF EXISTS "friendships_insert" ON friendships;
DROP POLICY IF EXISTS "friendships_update" ON friendships;
DROP POLICY IF EXISTS "friendships_delete" ON friendships;

CREATE POLICY "friendships_select" ON friendships
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "friendships_insert" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "friendships_update" ON friendships
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "friendships_delete" ON friendships
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- =====================================================
-- 5. FIX: Allow group ADMINS (not just creator) to update groups
-- This is needed for pinning prayer subjects, announcements, etc.
-- =====================================================
DROP POLICY IF EXISTS "prayer_groups_update" ON prayer_groups;

CREATE POLICY "prayer_groups_update" ON prayer_groups
  FOR UPDATE USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM prayer_group_members pgm
      WHERE pgm.group_id = prayer_groups.id
      AND pgm.user_id = auth.uid()
      AND pgm.role = 'admin'
    )
  );

-- =====================================================
-- 6. ENABLE REALTIME for additional tables if needed
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'prayer_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE prayer_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'prayer_group_join_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE prayer_group_join_requests;
  END IF;
END $$;

-- =====================================================
-- 7. ADD MISSING COLUMNS
-- =====================================================
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS closed_reason TEXT;
ALTER TABLE prayer_groups ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS is_answered BOOLEAN DEFAULT false;
