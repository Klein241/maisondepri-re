-- ================================================================
-- ADMIN RLS POLICIES - FULL BACK-OFFICE ACCESS (IDEMPOTENT)
-- ================================================================
-- Safe to run MULTIPLE TIMES. Every policy is dropped before creation.
-- ================================================================

-- HELPER FUNCTION
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 1. PROFILES
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS church TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can do anything on profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Anyone can view profiles"
ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id OR is_admin());

CREATE POLICY "Users or admins can update profiles"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR is_admin());

CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE TO authenticated USING (is_admin());

-- ==========================================
-- 2. PRAYER_GROUPS
-- ==========================================
ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all groups" ON prayer_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON prayer_groups;
DROP POLICY IF EXISTS "Admins can update their groups" ON prayer_groups;
DROP POLICY IF EXISTS "Admin full access prayer_groups" ON prayer_groups;
DROP POLICY IF EXISTS "Anyone can view groups" ON prayer_groups;
DROP POLICY IF EXISTS "Users can create groups" ON prayer_groups;
DROP POLICY IF EXISTS "Creators or admins can update groups" ON prayer_groups;
DROP POLICY IF EXISTS "Creators or admins can delete groups" ON prayer_groups;

CREATE POLICY "Anyone can view groups"
ON prayer_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create groups"
ON prayer_groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by OR is_admin());

CREATE POLICY "Creators or admins can update groups"
ON prayer_groups FOR UPDATE TO authenticated
USING (
    auth.uid() = created_by OR is_admin()
    OR EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_groups.id
        AND prayer_group_members.user_id = auth.uid()
        AND prayer_group_members.role = 'admin'
    )
);

CREATE POLICY "Creators or admins can delete groups"
ON prayer_groups FOR DELETE TO authenticated
USING (auth.uid() = created_by OR is_admin());

-- ==========================================
-- 3. PRAYER_GROUP_MEMBERS
-- ==========================================
ALTER TABLE prayer_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view group members" ON prayer_group_members;
DROP POLICY IF EXISTS "Users can join or be added to groups" ON prayer_group_members;
DROP POLICY IF EXISTS "Admins can update group members" ON prayer_group_members;
DROP POLICY IF EXISTS "Members can leave or admins can remove" ON prayer_group_members;
DROP POLICY IF EXISTS "Admin full access prayer_group_members" ON prayer_group_members;
DROP POLICY IF EXISTS "Anyone can view members" ON prayer_group_members;
DROP POLICY IF EXISTS "Join or admin add members" ON prayer_group_members;
DROP POLICY IF EXISTS "Group or app admins can update members" ON prayer_group_members;
DROP POLICY IF EXISTS "Leave or admin remove members" ON prayer_group_members;

CREATE POLICY "Anyone can view members"
ON prayer_group_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Join or admin add members"
ON prayer_group_members FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id OR is_admin()
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid() AND pgm.role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM prayer_groups
        WHERE prayer_groups.id = prayer_group_members.group_id
        AND prayer_groups.created_by = auth.uid()
    )
);

CREATE POLICY "Group or app admins can update members"
ON prayer_group_members FOR UPDATE TO authenticated
USING (
    is_admin()
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid() AND pgm.role = 'admin'
    )
);

CREATE POLICY "Leave or admin remove members"
ON prayer_group_members FOR DELETE TO authenticated
USING (
    auth.uid() = user_id OR is_admin()
    OR EXISTS (
        SELECT 1 FROM prayer_group_members AS pgm
        WHERE pgm.group_id = prayer_group_members.group_id
        AND pgm.user_id = auth.uid() AND pgm.role = 'admin'
    )
);

-- ==========================================
-- 4. PRAYER_GROUP_MESSAGES
-- ==========================================
ALTER TABLE prayer_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can send group messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Members can view group messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Users can update own group messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Users can delete own group messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Admin full access prayer_group_messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Members or admin view messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Members or admin send messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Own or admin update messages" ON prayer_group_messages;
DROP POLICY IF EXISTS "Own or admin delete messages" ON prayer_group_messages;

CREATE POLICY "Members or admin view messages"
ON prayer_group_messages FOR SELECT TO authenticated
USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id
        AND prayer_group_members.user_id = auth.uid()
    )
);

CREATE POLICY "Members or admin send messages"
ON prayer_group_messages FOR INSERT TO authenticated
WITH CHECK (
    (auth.uid() = user_id AND EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id
        AND prayer_group_members.user_id = auth.uid()
    )) OR is_admin()
);

CREATE POLICY "Own or admin update messages"
ON prayer_group_messages FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Own or admin delete messages"
ON prayer_group_messages FOR DELETE TO authenticated
USING (
    auth.uid() = user_id OR is_admin()
    OR EXISTS (
        SELECT 1 FROM prayer_group_members
        WHERE prayer_group_members.group_id = prayer_group_messages.group_id
        AND prayer_group_members.user_id = auth.uid()
        AND prayer_group_members.role = 'admin'
    )
);

-- ==========================================
-- 5. DIRECT_MESSAGES
-- ==========================================
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can view own direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can update own direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Admin full access direct_messages" ON direct_messages;
DROP POLICY IF EXISTS "Participants or admin view DMs" ON direct_messages;
DROP POLICY IF EXISTS "Participants send DMs" ON direct_messages;
DROP POLICY IF EXISTS "Sender or admin update DMs" ON direct_messages;
DROP POLICY IF EXISTS "Admin delete DMs" ON direct_messages;

CREATE POLICY "Participants or admin view DMs"
ON direct_messages FOR SELECT TO authenticated
USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = direct_messages.conversation_id
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);

CREATE POLICY "Participants send DMs"
ON direct_messages FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = direct_messages.conversation_id
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);

CREATE POLICY "Sender or admin update DMs"
ON direct_messages FOR UPDATE TO authenticated
USING (auth.uid() = sender_id OR is_admin());

CREATE POLICY "Admin delete DMs"
ON direct_messages FOR DELETE TO authenticated USING (is_admin());

-- ==========================================
-- 6. CONVERSATIONS
-- ==========================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Admin full access conversations" ON conversations;
DROP POLICY IF EXISTS "Participants or admin view conversations" ON conversations;
DROP POLICY IF EXISTS "Participants create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants or admin update conversations" ON conversations;
DROP POLICY IF EXISTS "Admin delete conversations" ON conversations;

CREATE POLICY "Participants or admin view conversations"
ON conversations FOR SELECT TO authenticated
USING (auth.uid() = participant1_id OR auth.uid() = participant2_id OR is_admin());

CREATE POLICY "Participants create conversations"
ON conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Participants or admin update conversations"
ON conversations FOR UPDATE TO authenticated
USING (auth.uid() = participant1_id OR auth.uid() = participant2_id OR is_admin());

CREATE POLICY "Admin delete conversations"
ON conversations FOR DELETE TO authenticated USING (is_admin());

-- ==========================================
-- 7. PRAYER_REQUESTS
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prayer_requests') THEN
        ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view prayers" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create prayers" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own prayers" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can delete prayers" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin update prayers" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin delete prayers" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "prayer_requests_select" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "prayer_requests_insert" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "prayer_requests_update" ON prayer_requests';
        EXECUTE 'DROP POLICY IF EXISTS "prayer_requests_delete" ON prayer_requests';

        EXECUTE 'CREATE POLICY "Anyone can view prayers" ON prayer_requests FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "Users can create prayers" ON prayer_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Own or admin update prayers" ON prayer_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin())';
        EXECUTE 'CREATE POLICY "Own or admin delete prayers" ON prayer_requests FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin())';
    END IF;
END $$;

-- ==========================================
-- 8. GROUP_PRAYER_COUNTER
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_prayer_counter') THEN
        ALTER TABLE group_prayer_counter ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view prayer counts" ON group_prayer_counter';
        EXECUTE 'DROP POLICY IF EXISTS "Members can insert prayer counts" ON group_prayer_counter';
        EXECUTE 'DROP POLICY IF EXISTS "Members can update prayer counts" ON group_prayer_counter';
        EXECUTE 'DROP POLICY IF EXISTS "Members or admin insert prayer counts" ON group_prayer_counter';
        EXECUTE 'DROP POLICY IF EXISTS "Members or admin update prayer counts" ON group_prayer_counter';
        EXECUTE 'DROP POLICY IF EXISTS "Admin delete prayer counts" ON group_prayer_counter';

        EXECUTE 'CREATE POLICY "Anyone can view prayer counts" ON group_prayer_counter FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "Members or admin insert prayer counts" ON group_prayer_counter FOR INSERT TO authenticated WITH CHECK (is_admin() OR EXISTS (SELECT 1 FROM prayer_group_members WHERE prayer_group_members.group_id = group_prayer_counter.group_id AND prayer_group_members.user_id = auth.uid()))';
        EXECUTE 'CREATE POLICY "Members or admin update prayer counts" ON group_prayer_counter FOR UPDATE TO authenticated USING (is_admin() OR EXISTS (SELECT 1 FROM prayer_group_members WHERE prayer_group_members.group_id = group_prayer_counter.group_id AND prayer_group_members.user_id = auth.uid()))';
        EXECUTE 'CREATE POLICY "Admin delete prayer counts" ON group_prayer_counter FOR DELETE TO authenticated USING (is_admin())';
    END IF;
END $$;

-- ==========================================
-- 9. LIBRARY_BOOKS
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'library_books') THEN
        ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view published books" ON library_books';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage books" ON library_books';
        EXECUTE 'DROP POLICY IF EXISTS "View published books or admin sees all" ON library_books';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can insert books" ON library_books';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can update books" ON library_books';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can delete books" ON library_books';

        EXECUTE 'CREATE POLICY "View published books or admin sees all" ON library_books FOR SELECT TO authenticated USING (is_published = true OR is_admin())';
        EXECUTE 'CREATE POLICY "Admin can insert books" ON library_books FOR INSERT TO authenticated WITH CHECK (is_admin())';
        EXECUTE 'CREATE POLICY "Admin can update books" ON library_books FOR UPDATE TO authenticated USING (is_admin())';
        EXECUTE 'CREATE POLICY "Admin can delete books" ON library_books FOR DELETE TO authenticated USING (is_admin())';
    END IF;
END $$;

-- ==========================================
-- 10. FRIENDSHIPS
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friendships') THEN
        ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own friendships" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Users can send friend requests" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Receivers can respond to requests" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "friendships_select" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "friendships_insert" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "friendships_update" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "friendships_delete" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin view friendships" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Users create friendships" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin update friendships" ON friendships';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin delete friendships" ON friendships';

        EXECUTE 'CREATE POLICY "Own or admin view friendships" ON friendships FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin())';
        EXECUTE 'CREATE POLICY "Users create friendships" ON friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id)';
        EXECUTE 'CREATE POLICY "Own or admin update friendships" ON friendships FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin())';
        EXECUTE 'CREATE POLICY "Own or admin delete friendships" ON friendships FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin())';
    END IF;
END $$;

-- ==========================================
-- 11. APP_SETTINGS
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') THEN
        ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view settings" ON app_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can manage settings" ON app_settings';
        EXECUTE 'DROP POLICY IF EXISTS "app_settings_select" ON app_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can insert settings" ON app_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can update settings" ON app_settings';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can delete settings" ON app_settings';

        EXECUTE 'CREATE POLICY "Anyone can view settings" ON app_settings FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "Admin can insert settings" ON app_settings FOR INSERT TO authenticated WITH CHECK (is_admin())';
        EXECUTE 'CREATE POLICY "Admin can update settings" ON app_settings FOR UPDATE TO authenticated USING (is_admin())';
        EXECUTE 'CREATE POLICY "Admin can delete settings" ON app_settings FOR DELETE TO authenticated USING (is_admin())';
    END IF;
END $$;

-- ==========================================
-- 12. DAYS
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'days') THEN
        ALTER TABLE days ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view days" ON days';
        EXECUTE 'DROP POLICY IF EXISTS "days_select" ON days';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can manage days" ON days';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can insert days" ON days';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can update days" ON days';
        EXECUTE 'DROP POLICY IF EXISTS "Admin can delete days" ON days';

        EXECUTE 'CREATE POLICY "Anyone can view days" ON days FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "Admin can insert days" ON days FOR INSERT TO authenticated WITH CHECK (is_admin())';
        EXECUTE 'CREATE POLICY "Admin can update days" ON days FOR UPDATE TO authenticated USING (is_admin())';
        EXECUTE 'CREATE POLICY "Admin can delete days" ON days FOR DELETE TO authenticated USING (is_admin())';
    END IF;
END $$;

-- ==========================================
-- 13. NOTIFICATIONS
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Users view own notifications" ON notifications';
        EXECUTE 'DROP POLICY IF EXISTS "notifications_select" ON notifications';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin view notifications" ON notifications';
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin update notifications" ON notifications';
        EXECUTE 'DROP POLICY IF EXISTS "Own or admin delete notifications" ON notifications';

        EXECUTE 'CREATE POLICY "Own or admin view notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin())';
        EXECUTE 'CREATE POLICY "Anyone can create notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "Own or admin update notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin())';
        EXECUTE 'CREATE POLICY "Own or admin delete notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin())';
    END IF;
END $$;

-- ==========================================
-- DONE! Script is idempotent - safe to re-run.
-- ==========================================
