-- =============================================================
-- FIX INFINITE RECURSION ON prayer_group_members
-- Execute each block separately if needed.
-- =============================================================

-- STEP 1: Drop ALL existing policies on prayer_group_members
DROP POLICY IF EXISTS "Users can view group members" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON prayer_group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON prayer_group_members;
DROP POLICY IF EXISTS "Creators can update members" ON prayer_group_members;

-- STEP 2: Recreate policies WITHOUT self-reference

-- Everyone can see members (no self-reference = no recursion)
CREATE POLICY "Users can view group members" ON prayer_group_members
  FOR SELECT USING (true);

-- Users can add themselves, or group owner can add anyone
CREATE POLICY "Users can join groups" ON prayer_group_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM prayer_groups pg
      WHERE pg.id = group_id
      AND pg.created_by = auth.uid()
    )
  );

-- Users can remove themselves, or group owner can remove anyone
CREATE POLICY "Users can leave groups" ON prayer_group_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM prayer_groups pg
      WHERE pg.id = group_id
      AND pg.created_by = auth.uid()
    )
  );

-- Group owner can update roles
CREATE POLICY "Creators can update members" ON prayer_group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM prayer_groups pg
      WHERE pg.id = group_id
      AND pg.created_by = auth.uid()
    )
  );

-- =============================================================
-- FIX INFINITE RECURSION ON prayer_group_join_requests
-- =============================================================

-- STEP 3: Drop ALL existing policies on prayer_group_join_requests
DROP POLICY IF EXISTS "Users can view own requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Admins can view group requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Users can create join requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Creators can update requests" ON prayer_group_join_requests;
DROP POLICY IF EXISTS "Users can delete requests" ON prayer_group_join_requests;

-- STEP 4: Recreate join request policies using prayer_groups.created_by

-- Users see their own requests + group owner sees all
CREATE POLICY "Users can view own requests" ON prayer_group_join_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM prayer_groups pg
      WHERE pg.id = group_id
      AND pg.created_by = auth.uid()
    )
  );

-- Users can create requests for themselves
CREATE POLICY "Users can create join requests" ON prayer_group_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Group owner can approve/reject
CREATE POLICY "Creators can update requests" ON prayer_group_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM prayer_groups pg
      WHERE pg.id = group_id
      AND pg.created_by = auth.uid()
    )
  );

-- Users can delete own + owner can delete any
CREATE POLICY "Users can delete requests" ON prayer_group_join_requests
  FOR DELETE USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM prayer_groups pg
      WHERE pg.id = group_id
      AND pg.created_by = auth.uid()
    )
  );

SELECT 'RLS recursion fix applied successfully!' AS status;
