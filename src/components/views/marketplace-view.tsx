'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Heart, ShoppingBag, Star, MapPin, MessageCircle,
    Filter, ChevronRight, Loader2, X, Eye, ArrowLeft,
    Share2, Phone, Clock, Shield, TrendingUp, Sparkles,
    Package, Store, ChevronLeft, ShoppingCart, Truck, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import {
    Product, PRODUCT_CATEGORIES, ProductCategory,
    formatPrice, CURRENCIES
} from '@/lib/marketplace-types';
import { AdBanner } from '@/components/ads/ad-banner';

// Product image placeholder
function ProductImagePlaceholder({ category }: { category: string }) {
    const gradients: Record<string, string> = {
        electronics: 'from-blue-600 to-cyan-600',
        clothing: 'from-pink-600 to-rose-600',
        food: 'from-orange-600 to-amber-600',
        beauty: 'from-fuchsia-600 to-purple-600',
        home: 'from-emerald-600 to-teal-600',
        books: 'from-indigo-600 to-violet-600',
        handmade: 'from-amber-600 to-yellow-600',
        services: 'from-sky-600 to-blue-600',
        spiritual: 'from-violet-600 to-purple-600',
        other: 'from-slate-600 to-gray-600',
    };
    return (
        <div className={`w-full h-full bg-linear-to-br ${gradients[category] || gradients.other} flex items-center justify-center`}>
            <Package className="h-8 w-8 text-white/40" />
        </div>
    );
}

export function MarketplaceView() {
    const { user } = useAppStore();
    const setGlobalActiveTab = useAppStore(s => s.setActiveTab);

    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'popular'>('recent');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showOrderForm, setShowOrderForm] = useState(false);
    const [orderQuantity, setOrderQuantity] = useState(1);
    const [orderAddress, setOrderAddress] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [isOrdering, setIsOrdering] = useState(false);
    const [myOrders, setMyOrders] = useState<any[]>([]);
    const [showMyOrders, setShowMyOrders] = useState(false);

    // Load products
    useEffect(() => {
        loadProducts();
    }, []);

    // Load user favorites & orders
    useEffect(() => {
        if (user?.id) {
            loadFavorites();
            loadMyOrders();
        }
    }, [user?.id]);

    const loadProducts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('marketplace_products')
                .select('*, seller:marketplace_sellers(id, user_id, shop_name, shop_logo, rating, is_verified, location)')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setProducts(data as any);
            }
        } catch (e) {
            console.error('Error loading products:', e);
        }
        setIsLoading(false);
    };

    const loadFavorites = async () => {
        try {
            const { data } = await supabase
                .from('marketplace_favorites')
                .select('product_id')
                .eq('user_id', user?.id);
            if (data) setFavorites(new Set(data.map(d => d.product_id)));
        } catch { /* table may not exist */ }
    };

    const loadMyOrders = async () => {
        try {
            const { data } = await supabase
                .from('marketplace_orders')
                .select('*, product:marketplace_products(id, title, images, price, currency)')
                .eq('buyer_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setMyOrders(data);
        } catch { }
    };

    const toggleFavorite = useCallback(async (productId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user?.id) {
            setGlobalActiveTab('profile');
            toast.info('Connectez-vous pour ajouter aux favoris');
            return;
        }

        const isFav = favorites.has(productId);
        setFavorites(prev => {
            const next = new Set(prev);
            isFav ? next.delete(productId) : next.add(productId);
            return next;
        });

        try {
            if (isFav) {
                await supabase.from('marketplace_favorites').delete()
                    .eq('product_id', productId).eq('user_id', user.id);
            } else {
                await supabase.from('marketplace_favorites').insert({ product_id: productId, user_id: user.id });
                toast.success('❤️ Ajouté aux favoris');
            }
        } catch {
            setFavorites(prev => {
                const next = new Set(prev);
                isFav ? next.add(productId) : next.delete(productId);
                return next;
            });
        }
    }, [user?.id, favorites]);

    const startChat = useCallback(async (product: Product) => {
        if (!user?.id) {
            setGlobalActiveTab('profile');
            toast.info('Connectez-vous pour contacter le vendeur');
            return;
        }
        if (product.seller_id === user.id) {
            toast.info("C'est votre propre produit !");
            return;
        }

        try {
            const sellerId = (product.seller as any)?.user_id || product.seller_id;

            const { data: existing } = await supabase
                .from('marketplace_conversations')
                .select('id')
                .eq('buyer_id', user.id)
                .eq('seller_id', sellerId)
                .eq('product_id', product.id)
                .single();

            if (existing) {
                toast.success('💬 Conversation existante ouverte');
                return;
            }

            await supabase.from('marketplace_conversations').insert({
                buyer_id: user.id,
                seller_id: sellerId,
                product_id: product.id,
            });
            toast.success('💬 Conversation créée avec le vendeur');
        } catch (e) {
            console.error(e);
            toast.error('Erreur lors de la création de la conversation');
        }
    }, [user?.id]);

    const placeOrder = async () => {
        if (!user?.id || !selectedProduct) return;
        setIsOrdering(true);
        try {
            const sellerId = (selectedProduct.seller as any)?.user_id || selectedProduct.seller_id;
            const totalPrice = selectedProduct.price * orderQuantity;

            const { error } = await supabase.from('marketplace_orders').insert({
                product_id: selectedProduct.id,
                buyer_id: user.id,
                seller_id: sellerId,
                quantity: orderQuantity,
                total_price: totalPrice,
                delivery_address: orderAddress.trim() || null,
                notes: orderNotes.trim() || null,
                status: 'pending',
            });

            if (error) throw error;

            toast.success('🎉 Commande passée avec succès !');
            setShowOrderForm(false);
            setOrderQuantity(1);
            setOrderAddress('');
            setOrderNotes('');
            loadMyOrders();
        } catch (e: any) {
            toast.error(e.message || 'Erreur lors de la commande');
        }
        setIsOrdering(false);
    };

    const shareProduct = useCallback(async (product: Product) => {
        const url = `${window.location.origin}/marketplace/?p=${product.id}`;
        const text = `🛒 ${product.title}\n💰 ${formatPrice(product.price, product.currency)}\n\nDécouvrez sur Maison de Prière !`;

        if (navigator.share) {
            try { await navigator.share({ title: product.title, text, url }); } catch { }
        } else {
            await navigator.clipboard.writeText(text + '\n' + url);
            toast.success('Lien copié 📋');
        }
    }, []);

    // Filter & sort
    const filteredProducts = products
        .filter(p => {
            const matchSearch = !searchQuery ||
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
            return matchSearch && matchCategory;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'price_asc': return a.price - b.price;
                case 'price_desc': return b.price - a.price;
                case 'popular': return b.views_count - a.views_count;
                default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

    const getOrderStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return '⏳ En attente';
            case 'confirmed': return '✅ Confirmée';
            case 'shipped': return '📦 Expédiée';
            case 'delivered': return '✓ Livrée';
            case 'cancelled': return '✗ Annulée';
            default: return status;
        }
    };

    // ═══════════════════════ MY ORDERS VIEW ═══════════════════════
    if (showMyOrders) {
        return (
            <div className="relative min-h-screen bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
                <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => setShowMyOrders(false)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-lg font-bold">Mes commandes ({myOrders.length})</h2>
                    </div>

                    {myOrders.length === 0 ? (
                        <div className="text-center py-16">
                            <ShoppingBag className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-400">Aucune commande pour le moment</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myOrders.map(order => (
                                <Card key={order.id} className="bg-white/5 border-white/10">
                                    <CardContent className="p-4">
                                        <div className="flex gap-3">
                                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0">
                                                {order.product?.images?.[0] ? (
                                                    <img src={order.product.images[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="h-5 w-5 text-slate-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-sm truncate">{order.product?.title || 'Produit'}</h3>
                                                <p className="text-xs text-emerald-400 font-bold">
                                                    {formatPrice(order.total_price, order.product?.currency || 'XAF')} · Qté: {order.quantity}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                </p>
                                            </div>
                                            <Badge className={`shrink-0 h-fit text-[9px] ${order.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                                    order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                                        order.status === 'shipped' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-amber-500/20 text-amber-400'
                                                } border-none`}>
                                                {getOrderStatusLabel(order.status)}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════ PRODUCT DETAIL ═══════════════════════
    if (selectedProduct) {
        const seller = selectedProduct.seller as any;
        const isFav = favorites.has(selectedProduct.id);
        const productImages = selectedProduct.images?.length ? selectedProduct.images : [];
        const isOwnProduct = (seller?.user_id || selectedProduct.seller_id) === user?.id;

        return (
            <div className="relative min-h-screen bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
                <div className="relative z-10 max-w-lg mx-auto w-full">
                    {/* Product images gallery */}
                    <div className="relative">
                        <div className="w-full aspect-square overflow-hidden bg-slate-800">
                            {productImages.length > 0 ? (
                                <img src={productImages[currentImageIndex]} alt={selectedProduct.title}
                                    className="w-full h-full object-cover" />
                            ) : (
                                <ProductImagePlaceholder category={selectedProduct.category} />
                            )}
                        </div>
                        <Button variant="ghost" size="icon"
                            className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white rounded-full"
                            onClick={() => { setSelectedProduct(null); setCurrentImageIndex(0); setShowOrderForm(false); }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon"
                            className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm text-white rounded-full"
                            onClick={(e) => toggleFavorite(selectedProduct.id, e)}>
                            <Heart className={`h-5 w-5 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                        </Button>

                        {/* Image navigation */}
                        {productImages.length > 1 && (
                            <>
                                {currentImageIndex > 0 && (
                                    <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm rounded-full p-1.5"
                                        onClick={() => setCurrentImageIndex(i => i - 1)}>
                                        <ChevronLeft className="h-5 w-5 text-white" />
                                    </button>
                                )}
                                {currentImageIndex < productImages.length - 1 && (
                                    <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm rounded-full p-1.5"
                                        onClick={() => setCurrentImageIndex(i => i + 1)}>
                                        <ChevronRight className="h-5 w-5 text-white" />
                                    </button>
                                )}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                    {productImages.map((_, i) => (
                                        <button key={i}
                                            onClick={() => setCurrentImageIndex(i)}
                                            className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-4' : 'bg-white/40'}`} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="px-4 pt-4">
                        {/* Price + Title */}
                        <div className="mb-4">
                            <p className="text-2xl font-black text-emerald-400">
                                {formatPrice(selectedProduct.price, selectedProduct.currency)}
                            </p>
                            <h2 className="text-lg font-bold text-white mt-1">{selectedProduct.title}</h2>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                {selectedProduct.is_negotiable && (
                                    <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Prix négociable</Badge>
                                )}
                                {selectedProduct.delivery_options?.map(opt => (
                                    <Badge key={opt} className="bg-blue-500/20 text-blue-400 text-[10px]">
                                        {opt === 'pickup' ? '🏪 Retrait' : opt === 'delivery' ? '🚗 Livraison' : '📦 Expédition'}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {selectedProduct.views_count} vues</span>
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {selectedProduct.favorites_count} favoris</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(selectedProduct.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>

                        {/* Description */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-white mb-2">Description</h3>
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedProduct.description}</p>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Card className="bg-white/5 border-white/10">
                                <CardContent className="p-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Catégorie</p>
                                    <p className="text-xs text-white mt-0.5">
                                        {PRODUCT_CATEGORIES.find(c => c.id === selectedProduct.category)?.icon}{' '}
                                        {PRODUCT_CATEGORIES.find(c => c.id === selectedProduct.category)?.label}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white/5 border-white/10">
                                <CardContent className="p-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Stock</p>
                                    <p className="text-xs text-white mt-0.5">
                                        {selectedProduct.stock_quantity > 0 ? `${selectedProduct.stock_quantity} disponible(s)` : '❌ Épuisé'}
                                    </p>
                                </CardContent>
                            </Card>
                            {selectedProduct.location && (
                                <Card className="bg-white/5 border-white/10 col-span-2">
                                    <CardContent className="p-3 flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                        <p className="text-xs text-white">{selectedProduct.location}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Seller card */}
                        {seller && (
                            <Card className="bg-white/5 border-white/10 mb-6">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={seller.shop_logo || undefined} />
                                        <AvatarFallback className="bg-linear-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold">
                                            {seller.shop_name?.charAt(0) || 'V'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-semibold text-white text-sm truncate">{seller.shop_name}</p>
                                            {seller.is_verified && (
                                                <Shield className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                            {seller.rating > 0 && (
                                                <span className="flex items-center gap-0.5">
                                                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                                    {Number(seller.rating).toFixed(1)}
                                                </span>
                                            )}
                                            {seller.location && (
                                                <span className="flex items-center gap-0.5">
                                                    <MapPin className="h-3 w-3" /> {seller.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Store className="h-5 w-5 text-slate-500" />
                                </CardContent>
                            </Card>
                        )}

                        {/* Order Form */}
                        <AnimatePresence>
                            {showOrderForm && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden mb-4"
                                >
                                    <Card className="bg-emerald-500/5 border-emerald-500/20">
                                        <CardContent className="p-4 space-y-3">
                                            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                                <ShoppingCart className="h-4 w-4" /> Passer commande
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <label className="text-xs text-slate-400">Quantité:</label>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setOrderQuantity(q => Math.max(1, q - 1))}
                                                        className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center">−</button>
                                                    <span className="text-white font-bold w-8 text-center">{orderQuantity}</span>
                                                    <button onClick={() => setOrderQuantity(q => Math.min(selectedProduct.stock_quantity, q + 1))}
                                                        className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center">+</button>
                                                </div>
                                                <p className="text-emerald-400 font-bold text-sm ml-auto">
                                                    {formatPrice(selectedProduct.price * orderQuantity, selectedProduct.currency)}
                                                </p>
                                            </div>
                                            <Input
                                                placeholder="Adresse de livraison (optionnel)"
                                                value={orderAddress}
                                                onChange={e => setOrderAddress(e.target.value)}
                                                className="bg-white/5 border-white/10 text-white text-sm h-9"
                                            />
                                            <Input
                                                placeholder="Notes pour le vendeur (optionnel)"
                                                value={orderNotes}
                                                onChange={e => setOrderNotes(e.target.value)}
                                                className="bg-white/5 border-white/10 text-white text-sm h-9"
                                            />
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setShowOrderForm(false)}
                                                    className="flex-1 text-xs border-white/10">
                                                    Annuler
                                                </Button>
                                                <Button size="sm" onClick={placeOrder} disabled={isOrdering}
                                                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                                                    {isOrdering ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                                    Confirmer ({formatPrice(selectedProduct.price * orderQuantity, selectedProduct.currency)})
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action buttons */}
                        <div className="flex gap-3 mb-8">
                            {!isOwnProduct && selectedProduct.stock_quantity > 0 && (
                                <Button
                                    className="flex-1 h-12 bg-linear-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30"
                                    onClick={() => {
                                        if (!user?.id) {
                                            setGlobalActiveTab('profile');
                                            toast.info('Connectez-vous pour commander');
                                            return;
                                        }
                                        setShowOrderForm(!showOrderForm);
                                    }}>
                                    <ShoppingCart className="h-5 w-5 mr-2" />
                                    Commander
                                </Button>
                            )}
                            {!isOwnProduct && (
                                <Button
                                    variant="outline"
                                    className="h-12 border-white/10 text-white hover:bg-white/5 rounded-xl px-4"
                                    onClick={() => startChat(selectedProduct)}>
                                    <MessageCircle className="h-5 w-5 mr-2" />
                                    Discuter
                                </Button>
                            )}
                            <Button variant="outline" size="icon"
                                className="h-12 w-12 border-white/10 text-white hover:bg-white/5 rounded-xl"
                                onClick={() => shareProduct(selectedProduct)}>
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════ MAIN MARKETPLACE ═══════════════════════
    return (
        <div className="relative min-h-screen bg-linear-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-teal-600/5 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto w-full px-4 pt-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight bg-linear-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent flex items-center gap-2">
                            <ShoppingBag className="h-6 w-6 text-emerald-400" />
                            Marketplace
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">{products.length} produits disponibles</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {user && myOrders.length > 0 && (
                            <Button size="sm" variant="ghost"
                                className="text-amber-400 hover:bg-amber-500/10 text-xs"
                                onClick={() => setShowMyOrders(true)}>
                                <ShoppingCart className="h-4 w-4 mr-1" /> Commandes ({myOrders.length})
                            </Button>
                        )}
                        {user && (
                            <Button size="sm" variant="ghost"
                                className="text-emerald-400 hover:bg-emerald-500/10 text-xs"
                                onClick={() => setGlobalActiveTab('profile')}>
                                <Store className="h-4 w-4 mr-1" /> Ma boutique
                            </Button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Rechercher un produit..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-11 rounded-xl"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-4 w-4 text-slate-500 hover:text-white" />
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategory === 'all'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}>
                        🏪 Tout
                    </button>
                    {PRODUCT_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCategory === cat.id
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                }`}>
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="flex gap-2 mb-4">
                    {[
                        { id: 'recent' as const, label: '🆕 Récents' },
                        { id: 'popular' as const, label: '🔥 Populaires' },
                        { id: 'price_asc' as const, label: '💰 Prix ↑' },
                        { id: 'price_desc' as const, label: '💸 Prix ↓' },
                    ].map(s => (
                        <button key={s.id}
                            onClick={() => setSortBy(s.id)}
                            className={`text-[10px] px-2 py-1 rounded-lg transition-all ${sortBy === s.id
                                ? 'bg-white/10 text-white font-semibold'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Marketplace Ad */}
                <AdBanner placement="marketplace" variant="banner" className="mb-4" />

                {/* Products Grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
                        <p className="text-sm text-slate-400">Chargement du marketplace...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <ShoppingBag className="h-12 w-12 text-slate-600 mb-3" />
                        <p className="text-sm text-slate-400">Aucun produit trouvé</p>
                        {user && (
                            <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => setGlobalActiveTab('profile')}>
                                <Store className="h-4 w-4 mr-2" /> Vendre un produit
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {filteredProducts.map((product, idx) => {
                            const isFav = favorites.has(product.id);
                            return (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => { setSelectedProduct(product); setCurrentImageIndex(0); }}
                                    className="cursor-pointer group"
                                >
                                    <div className="relative">
                                        <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg mb-2 bg-slate-800">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt={product.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <ProductImagePlaceholder category={product.category} />
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => toggleFavorite(product.id, e)}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
                                        >
                                            <Heart className={`h-3.5 w-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                                        </button>
                                        {product.is_negotiable && (
                                            <Badge className="absolute top-2 left-2 bg-amber-500/80 text-[8px] text-white px-1.5 py-0.5">
                                                Négociable
                                            </Badge>
                                        )}
                                        {product.stock_quantity === 0 && (
                                            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                                <Badge className="bg-red-600 text-white text-xs">Épuisé</Badge>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-emerald-400 font-bold text-sm">
                                        {formatPrice(product.price, product.currency)}
                                    </p>
                                    <p className="text-[11px] font-medium text-white truncate">{product.title}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {product.location && (
                                            <span className="text-[9px] text-slate-500 flex items-center gap-0.5 truncate">
                                                <MapPin className="h-2.5 w-2.5" /> {product.location}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
