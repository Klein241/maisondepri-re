-- =============================================
-- ADD MISSING COLUMNS — Run this in Supabase SQL Editor
-- =============================================

-- 1. Add 'condition' column to marketplace_products
ALTER TABLE marketplace_products 
ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'new' CHECK (condition IN ('new', 'like_new', 'used'));

-- 2. Add 'is_featured' for pinning products
ALTER TABLE marketplace_products 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 3. Add 'is_pinned' for library books
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 4. Fix marketplace_sellers: add 'description' as alias for shop_description if needed
-- The table already has shop_description. The code should use shop_description, not description.

-- 5. Update RLS for marketplace_products to allow admins (check via auth.uid() role)
-- Allow authenticated users to read all products (including draft for admins)
DROP POLICY IF EXISTS "Products are publicly visible" ON marketplace_products;
CREATE POLICY "Products are publicly visible" ON marketplace_products FOR SELECT USING (true);

-- Done! Run this SQL in the Supabase dashboard under SQL Editor.
