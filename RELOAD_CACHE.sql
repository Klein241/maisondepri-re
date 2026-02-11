-- =========================================================
-- RELOAD SCHEMA CACHE
-- Execute this to fix "Could not find column" errors
-- =========================================================

NOTIFY pgrst, 'reload config';

-- If the above doesn't work immediately, you can also go to:
-- Supabase Dashboard > Settings > API > "Reload Schema Cache" button.
