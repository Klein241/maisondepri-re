// Marketplace Types
// ==================

export type ProductCategory =
    | 'electronics'
    | 'clothing'
    | 'food'
    | 'beauty'
    | 'home'
    | 'books'
    | 'handmade'
    | 'services'
    | 'spiritual'
    | 'other';

export type ProductStatus = 'active' | 'paused' | 'sold' | 'draft';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export type SellerPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Product {
    id: string;
    seller_id: string;
    title: string;
    description: string;
    price: number;
    currency: string; // XAF, EUR, USD
    category: ProductCategory;
    images: string[]; // up to 4
    status: ProductStatus;
    stock_quantity: number;
    is_negotiable: boolean;
    location?: string;
    delivery_options: string[]; // 'pickup', 'delivery', 'shipping'
    views_count: number;
    favorites_count: number;
    created_at: string;
    updated_at: string;
    // Joined seller info
    seller?: SellerProfile;
}

export interface SellerProfile {
    id: string;
    user_id: string;
    shop_name: string;
    shop_description?: string;
    shop_logo?: string;
    shop_banner?: string;
    phone?: string;
    whatsapp?: string;
    location?: string;
    plan: SellerPlan;
    max_products: number; // free=1, starter=10, pro=50, enterprise=unlimited
    rating: number;
    total_sales: number;
    is_verified: boolean;
    created_at: string;
}

export interface MarketplaceConversation {
    id: string;
    buyer_id: string;
    seller_id: string;
    product_id: string;
    pinned_product?: Product;
    last_message?: string;
    last_message_at?: string;
    buyer?: { id: string; full_name: string; avatar_url?: string };
    seller?: { id: string; full_name: string; avatar_url?: string };
}

export interface MarketplaceMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'image' | 'product_card' | 'offer';
    product_reference_id?: string;
    offer_amount?: number;
    is_read: boolean;
    created_at: string;
}

export interface ProductReview {
    id: string;
    product_id: string;
    buyer_id: string;
    rating: number;
    comment?: string;
    created_at: string;
    buyer?: { full_name: string; avatar_url?: string };
}

export interface Order {
    id: string;
    product_id: string;
    buyer_id: string;
    seller_id: string;
    quantity: number;
    total_price: number;
    status: OrderStatus;
    delivery_address?: string;
    notes?: string;
    created_at: string;
    product?: Product;
    buyer?: { full_name: string; avatar_url?: string };
}

export const PRODUCT_CATEGORIES: { id: ProductCategory; label: string; icon: string }[] = [
    { id: 'electronics', label: 'Électronique', icon: '📱' },
    { id: 'clothing', label: 'Vêtements', icon: '👗' },
    { id: 'food', label: 'Alimentation', icon: '🍲' },
    { id: 'beauty', label: 'Beauté', icon: '💄' },
    { id: 'home', label: 'Maison', icon: '🏠' },
    { id: 'books', label: 'Livres', icon: '📚' },
    { id: 'handmade', label: 'Artisanat', icon: '🎨' },
    { id: 'services', label: 'Services', icon: '💼' },
    { id: 'spiritual', label: 'Spirituel', icon: '✝️' },
    { id: 'other', label: 'Autres', icon: '📦' },
];

export const SELLER_PLANS: { id: SellerPlan; label: string; maxProducts: number; price: string }[] = [
    { id: 'free', label: 'Gratuit', maxProducts: 1, price: '0' },
    { id: 'starter', label: 'Starter', maxProducts: 10, price: '2,000 XAF/mois' },
    { id: 'pro', label: 'Pro', maxProducts: 50, price: '5,000 XAF/mois' },
    { id: 'enterprise', label: 'Enterprise', maxProducts: 999, price: '15,000 XAF/mois' },
];

export const CURRENCIES = [
    { code: 'XAF', symbol: 'FCFA', label: 'Franc CFA' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'USD', symbol: '$', label: 'Dollar US' },
];

export function formatPrice(price: number, currency: string = 'XAF'): string {
    const curr = CURRENCIES.find(c => c.code === currency);
    if (currency === 'XAF') {
        return `${price.toLocaleString('fr-FR')} ${curr?.symbol || 'FCFA'}`;
    }
    return `${curr?.symbol || ''}${price.toLocaleString('fr-FR')}`;
}
