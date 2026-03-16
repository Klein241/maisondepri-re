-- =============================================
-- MARKETPLACE SCHEMA — Maison de Prière
-- =============================================

-- Seller profiles
CREATE TABLE IF NOT EXISTS marketplace_sellers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    shop_name TEXT NOT NULL,
    shop_description TEXT,
    shop_logo TEXT,
    shop_banner TEXT,
    phone TEXT,
    whatsapp TEXT,
    location TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    max_products INT DEFAULT 1,
    rating NUMERIC(2,1) DEFAULT 0,
    total_sales INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS marketplace_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES marketplace_sellers(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'XAF',
    category TEXT DEFAULT 'other',
    images TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold', 'draft')),
    stock_quantity INT DEFAULT 1,
    is_negotiable BOOLEAN DEFAULT FALSE,
    location TEXT,
    delivery_options TEXT[] DEFAULT '{pickup}',
    views_count INT DEFAULT 0,
    favorites_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product favorites
CREATE TABLE IF NOT EXISTS marketplace_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES marketplace_products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- Product reviews
CREATE TABLE IF NOT EXISTS marketplace_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES marketplace_products(id) ON DELETE CASCADE NOT NULL,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, buyer_id)
);

-- Marketplace conversations (buyer <-> seller around a product)
CREATE TABLE IF NOT EXISTS marketplace_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(buyer_id, seller_id, product_id)
);

-- Marketplace messages
CREATE TABLE IF NOT EXISTS marketplace_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES marketplace_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'product_card', 'offer')),
    product_reference_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
    offer_amount NUMERIC(12,2),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    quantity INT DEFAULT 1,
    total_price NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    delivery_address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_seller ON marketplace_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON marketplace_products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON marketplace_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON marketplace_orders(seller_id);

-- RLS Policies
ALTER TABLE marketplace_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Public read for products and sellers
CREATE POLICY "Products are publicly visible" ON marketplace_products FOR SELECT USING (status = 'active');
CREATE POLICY "Sellers manage own products" ON marketplace_products FOR ALL USING (seller_id IN (SELECT id FROM marketplace_sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers are publicly visible" ON marketplace_sellers FOR SELECT USING (true);
CREATE POLICY "Users manage own seller profile" ON marketplace_sellers FOR ALL USING (user_id = auth.uid());

-- Favorites
CREATE POLICY "Users manage own favorites" ON marketplace_favorites FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Public favorite count" ON marketplace_favorites FOR SELECT USING (true);

-- Reviews
CREATE POLICY "Reviews are public" ON marketplace_reviews FOR SELECT USING (true);
CREATE POLICY "Users write own reviews" ON marketplace_reviews FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Conversations & Messages
CREATE POLICY "Users see own conversations" ON marketplace_conversations FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "Users create conversations" ON marketplace_conversations FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Users see own messages" ON marketplace_messages FOR SELECT USING (conversation_id IN (SELECT id FROM marketplace_conversations WHERE buyer_id = auth.uid() OR seller_id = auth.uid()));
CREATE POLICY "Users send messages" ON marketplace_messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Orders
CREATE POLICY "Users see own orders" ON marketplace_orders FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "Buyers create orders" ON marketplace_orders FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Sellers update orders" ON marketplace_orders FOR UPDATE USING (seller_id = auth.uid());
