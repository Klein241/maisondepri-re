-- =============================================
-- ADD MISSING COLUMNS — Run this in Supabase SQL Editor
-- =============================================

-- 1. Add 'condition' column to marketplace_products
ALTER TABLE marketplace_products 
ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'new' CHECK (condition IN ('new', 'like_new', 'used'));

-- 2. Add 'is_featured' for pinning products
ALTER TABLE marketplace_products 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 3. Add 'is_pinned' for library books (correct table name: library_books)
ALTER TABLE library_books 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 4. Add 'scheduled_at' for scheduled publication
ALTER TABLE library_books
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- 5. Update RLS for marketplace_products to allow admins to read all
DROP POLICY IF EXISTS "Products are publicly visible" ON marketplace_products;
CREATE POLICY "Products are publicly visible" ON marketplace_products FOR SELECT USING (true);
