'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store, Plus, Edit, Trash2, Eye, EyeOff, Package, Image as ImageIcon,
    Camera, Save, X, ArrowLeft, BarChart3, ShoppingCart, MessageCircle,
    Star, MapPin, ChevronRight, Loader2, Upload, DollarSign, Tag,
    Settings, Crown, Shield, TrendingUp, Users, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
    Product, SellerProfile, ProductCategory, ProductStatus,
    PRODUCT_CATEGORIES, SELLER_PLANS, CURRENCIES, formatPrice, Order
} from '@/lib/marketplace-types';
import { ChatMarketplace } from './chat-marketplace';

interface SellerDashboardProps {
    userId: string;
    userName: string;
    userAvatar?: string;
}

export function SellerDashboard({ userId, userName, userAvatar }: SellerDashboardProps) {
    const [seller, setSeller] = useState<SellerProfile | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'dashboard' | 'products' | 'add_product' | 'edit_product' | 'orders' | 'messages' | 'settings'>('dashboard');
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [stats, setStats] = useState({ totalViews: 0, totalSales: 0, totalRevenue: 0 });

    // Product form
    const [productForm, setProductForm] = useState({
        title: '',
        description: '',
        price: '',
        currency: 'XAF',
        category: 'other' as ProductCategory,
        stock_quantity: '1',
        is_negotiable: false,
        location: '',
        delivery_options: ['pickup'] as string[],
    });
    const [productImages, setProductImages] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Shop settings
    const [shopForm, setShopForm] = useState({
        shop_name: '',
        shop_description: '',
        phone: '',
        whatsapp: '',
        location: '',
    });

    useEffect(() => {
        loadSellerProfile();
    }, [userId]);

    const loadSellerProfile = async () => {
        setIsLoading(true);
        try {
            const { data: sellerData } = await supabase
                .from('marketplace_sellers')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (sellerData) {
                setSeller(sellerData as any);
                setShopForm({
                    shop_name: sellerData.shop_name || '',
                    shop_description: sellerData.shop_description || '',
                    phone: sellerData.phone || '',
                    whatsapp: sellerData.whatsapp || '',
                    location: sellerData.location || '',
                });
                await loadProducts(sellerData.id);
                await loadOrders();
                await loadConversations();
            }
        } catch { /* Seller not yet created */ }
        setIsLoading(false);
    };

    const createSellerProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('marketplace_sellers')
                .insert({
                    user_id: userId,
                    shop_name: userName + "'s Shop",
                    plan: 'free',
                    max_products: 1,
                })
                .select()
                .single();

            if (error) throw error;
            setSeller(data as any);
            setShopForm({ ...shopForm, shop_name: data.shop_name });
            toast.success('🏪 Boutique créée !');
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    const loadProducts = async (sellerId: string) => {
        try {
            const { data } = await supabase
                .from('marketplace_products')
                .select('*')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false });

            if (data) {
                setProducts(data as any);
                const totalViews = data.reduce((sum, p) => sum + (p.views_count || 0), 0);
                setStats(prev => ({ ...prev, totalViews }));
            }
        } catch { }
    };

    const loadOrders = async () => {
        try {
            const { data } = await supabase
                .from('marketplace_orders')
                .select('*, product:marketplace_products(title, images, price, currency)')
                .eq('seller_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setOrders(data as any);
        } catch { }
    };

    const loadConversations = async () => {
        try {
            const { data } = await supabase
                .from('marketplace_conversations')
                .select('*, buyer:profiles!marketplace_conversations_buyer_id_fkey(full_name, avatar_url), product:marketplace_products(title, images, price)')
                .eq('seller_id', userId)
                .order('last_message_at', { ascending: false })
                .limit(20);
            if (data) setConversations(data as any);
        } catch { }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || productImages.length >= 4) return;

        setUploadingImage(true);
        try {
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `marketplace/${userId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('media')
                .getPublicUrl(filePath);

            setProductImages(prev => [...prev, urlData.publicUrl]);
            toast.success('Image ajoutée ✅');
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
        setUploadingImage(false);
    };

    const removeImage = (index: number) => {
        setProductImages(prev => prev.filter((_, i) => i !== index));
    };

    const saveProduct = async () => {
        if (!seller) return;
        if (!productForm.title.trim()) {
            toast.error('Le titre est requis');
            return;
        }

        // Check product limit
        if (!editingProduct && products.length >= (seller.max_products || 1)) {
            toast.error(`Limite atteinte ! Votre forfait ${seller.plan} permet ${seller.max_products} produit(s). Passez à un forfait supérieur.`);
            return;
        }

        setIsSaving(true);
        try {
            const productData = {
                seller_id: seller.id,
                title: productForm.title.trim(),
                description: productForm.description.trim(),
                price: parseFloat(productForm.price) || 0,
                currency: productForm.currency,
                category: productForm.category,
                images: productImages,
                stock_quantity: parseInt(productForm.stock_quantity) || 1,
                is_negotiable: productForm.is_negotiable,
                location: productForm.location,
                delivery_options: productForm.delivery_options,
                status: 'active' as ProductStatus,
                updated_at: new Date().toISOString(),
            };

            if (editingProduct) {
                const { error } = await supabase
                    .from('marketplace_products')
                    .update(productData)
                    .eq('id', editingProduct.id);
                if (error) throw error;
                toast.success('Produit mis à jour ✅');
            } else {
                const { error } = await supabase
                    .from('marketplace_products')
                    .insert(productData);
                if (error) throw error;
                toast.success('Produit publié 🎉');
            }

            resetProductForm();
            setView('products');
            await loadProducts(seller.id);
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
        setIsSaving(false);
    };

    const deleteProduct = async (productId: string) => {
        if (!seller) return;
        try {
            await supabase.from('marketplace_products').delete().eq('id', productId);
            setProducts(prev => prev.filter(p => p.id !== productId));
            toast.success('Produit supprimé');
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    const toggleProductStatus = async (product: Product) => {
        const newStatus = product.status === 'active' ? 'paused' : 'active';
        try {
            await supabase.from('marketplace_products')
                .update({ status: newStatus })
                .eq('id', product.id);
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
            toast.success(newStatus === 'active' ? 'Produit activé' : 'Produit suspendu');
        } catch { }
    };

    const saveShopSettings = async () => {
        if (!seller) return;
        try {
            const { error } = await supabase
                .from('marketplace_sellers')
                .update({
                    shop_name: shopForm.shop_name,
                    shop_description: shopForm.shop_description,
                    phone: shopForm.phone,
                    whatsapp: shopForm.whatsapp,
                    location: shopForm.location,
                })
                .eq('id', seller.id);
            if (error) throw error;
            toast.success('Paramètres sauvegardés ✅');
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        }
    };

    const resetProductForm = () => {
        setProductForm({
            title: '', description: '', price: '', currency: 'XAF', category: 'other',
            stock_quantity: '1', is_negotiable: false, location: '', delivery_options: ['pickup'],
        });
        setProductImages([]);
        setEditingProduct(null);
    };

    const startEditProduct = (product: Product) => {
        setEditingProduct(product);
        setProductForm({
            title: product.title,
            description: product.description,
            price: String(product.price),
            currency: product.currency,
            category: product.category,
            stock_quantity: String(product.stock_quantity),
            is_negotiable: product.is_negotiable,
            location: product.location || '',
            delivery_options: product.delivery_options || ['pickup'],
        });
        setProductImages(product.images || []);
        setView('edit_product');
    };

    // ═══════════ LOADING ═══════════
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
        );
    }

    // ═══════════ NO SELLER PROFILE ═══════════
    if (!seller) {
        return (
            <Card className="bg-linear-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
                <CardContent className="p-6 text-center">
                    <Store className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-white mb-2">Commencer à vendre</h3>
                    <p className="text-sm text-slate-400 mb-4">
                        Créez votre boutique et publiez votre premier produit gratuitement !
                    </p>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={createSellerProfile}>
                        <Store className="h-4 w-4 mr-2" /> Créer ma boutique
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ═══════════ ADD/EDIT PRODUCT ═══════════
    if (view === 'add_product' || view === 'edit_product') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => { setView('products'); resetProductForm(); }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h3 className="text-lg font-bold text-white">
                        {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                    </h3>
                </div>

                {/* Images (up to 4) */}
                <div>
                    <label className="text-xs text-slate-400 mb-2 block">Photos ({productImages.length}/4)</label>
                    <div className="grid grid-cols-4 gap-2">
                        {productImages.map((img, i) => (
                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-800">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button onClick={() => removeImage(i)}
                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                    <X className="h-3 w-3 text-white" />
                                </button>
                            </div>
                        ))}
                        {productImages.length < 4 && (
                            <button
                                onClick={() => imageInputRef.current?.click()}
                                className="aspect-square rounded-lg border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                                <span className="text-[9px] mt-1">Ajouter</span>
                            </button>
                        )}
                    </div>
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                {/* Title */}
                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Titre *</label>
                    <Input value={productForm.title} onChange={e => setProductForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Ex: iPhone 14 Pro Max" className="bg-white/5 border-white/10 text-white" />
                </div>

                {/* Price + Currency */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Prix *</label>
                        <Input type="number" value={productForm.price}
                            onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}
                            placeholder="25000" className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="w-28">
                        <label className="text-xs text-slate-400 mb-1 block">Devise</label>
                        <Select value={productForm.currency} onValueChange={v => setProductForm(f => ({ ...f, currency: v }))}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                                {CURRENCIES.map(c => (
                                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Category */}
                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Catégorie</label>
                    <Select value={productForm.category} onValueChange={(v: ProductCategory) => setProductForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                            {PRODUCT_CATEGORIES.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.icon} {c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Description */}
                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Description</label>
                    <Textarea value={productForm.description}
                        onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Décrivez votre produit..."
                        className="bg-white/5 border-white/10 text-white min-h-[100px]" />
                </div>

                {/* Stock + Location */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Quantité</label>
                        <Input type="number" value={productForm.stock_quantity}
                            onChange={e => setProductForm(f => ({ ...f, stock_quantity: e.target.value }))}
                            className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Localisation</label>
                        <Input value={productForm.location}
                            onChange={e => setProductForm(f => ({ ...f, location: e.target.value }))}
                            placeholder="Douala" className="bg-white/5 border-white/10 text-white" />
                    </div>
                </div>

                {/* Negotiable toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-10 h-5 rounded-full transition-all ${productForm.is_negotiable ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        onClick={() => setProductForm(f => ({ ...f, is_negotiable: !f.is_negotiable }))}>
                        <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-all ${productForm.is_negotiable ? 'ml-5' : 'ml-0.5'}`} />
                    </div>
                    <span className="text-sm text-white">Prix négociable</span>
                </label>

                {/* Save */}
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-bold"
                    onClick={saveProduct} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {editingProduct ? 'Mettre à jour' : 'Publier le produit'}
                </Button>
            </div>
        );
    }

    // ═══════════ SHOP SETTINGS ═══════════
    if (view === 'settings') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => setView('dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h3 className="text-lg font-bold text-white">Paramètres boutique</h3>
                </div>

                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nom de la boutique</label>
                    <Input value={shopForm.shop_name} onChange={e => setShopForm(f => ({ ...f, shop_name: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white" />
                </div>
                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Description</label>
                    <Textarea value={shopForm.shop_description} onChange={e => setShopForm(f => ({ ...f, shop_description: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white min-h-[80px]" />
                </div>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Téléphone</label>
                        <Input value={shopForm.phone} onChange={e => setShopForm(f => ({ ...f, phone: e.target.value }))}
                            className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">WhatsApp</label>
                        <Input value={shopForm.whatsapp} onChange={e => setShopForm(f => ({ ...f, whatsapp: e.target.value }))}
                            className="bg-white/5 border-white/10 text-white" />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-slate-400 mb-1 block">Localisation</label>
                    <Input value={shopForm.location} onChange={e => setShopForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Douala, Cameroun" className="bg-white/5 border-white/10 text-white" />
                </div>

                {/* Plan info */}
                <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-white">Forfait actuel</span>
                            <Badge className="bg-emerald-500/20 text-emerald-400">
                                {SELLER_PLANS.find(p => p.id === seller.plan)?.label || 'Gratuit'}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-400">
                            {products.length} / {seller.max_products} produit(s) utilisé(s)
                        </p>
                        <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                            <div className="bg-emerald-500 rounded-full h-1.5 transition-all"
                                style={{ width: `${Math.min(100, (products.length / seller.max_products) * 100)}%` }} />
                        </div>
                    </CardContent>
                </Card>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveShopSettings}>
                    <Save className="h-4 w-4 mr-2" /> Sauvegarder
                </Button>
            </div>
        );
    }

    // ═══════════ MESSAGES ═══════════
    if (view === 'messages') {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="icon" onClick={() => setView('dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h3 className="text-lg font-bold text-white">Messages clients</h3>
                </div>
                <div className="h-[60vh] rounded-xl overflow-hidden border border-white/10">
                    <ChatMarketplace userId={userId} userName={userName} userAvatar={userAvatar} />
                </div>
            </div>
        );
    }

    // ═══════════ ORDERS ═══════════
    if (view === 'orders') {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => setView('dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h3 className="text-lg font-bold text-white">Commandes</h3>
                </div>

                {orders.length === 0 ? (
                    <div className="text-center py-8">
                        <ShoppingCart className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Aucune commande</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <Card key={order.id} className="bg-white/5 border-white/10">
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                                    {(order.product as any)?.images?.[0] ? (
                                        <img src={(order.product as any).images[0]} className="w-full h-full object-cover" />
                                    ) : <Package className="h-5 w-5 text-slate-600 m-2.5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{(order.product as any)?.title || 'Produit'}</p>
                                    <p className="text-[10px] text-slate-400">Qté: {order.quantity} • {formatPrice(order.total_price)}</p>
                                </div>
                                <Badge className={`text-[9px] ${order.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                    order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                                        order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                            'bg-amber-500/20 text-amber-400'
                                    }`}>
                                    {order.status === 'pending' ? 'En attente' :
                                        order.status === 'confirmed' ? 'Confirmée' :
                                            order.status === 'shipped' ? 'Expédiée' :
                                                order.status === 'delivered' ? 'Livrée' : 'Annulée'}
                                </Badge>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        );
    }

    // ═══════════ PRODUCT LIST ═══════════
    if (view === 'products') {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setView('dashboard')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h3 className="text-lg font-bold text-white">Mes produits ({products.length})</h3>
                    </div>
                    {products.length < (seller.max_products || 1) && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => { resetProductForm(); setView('add_product'); }}>
                            <Plus className="h-4 w-4 mr-1" /> Ajouter
                        </Button>
                    )}
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-8">
                        <Package className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 mb-3">Aucun produit</p>
                        <Button className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => { resetProductForm(); setView('add_product'); }}>
                            <Plus className="h-4 w-4 mr-1" /> Publier mon premier produit
                        </Button>
                    </div>
                ) : (
                    products.map(product => (
                        <Card key={product.id} className="bg-white/5 border-white/10">
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} className="w-full h-full object-cover" />
                                    ) : <Package className="h-6 w-6 text-slate-600 m-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{product.title}</p>
                                    <p className="text-xs text-emerald-400 font-bold">{formatPrice(product.price, product.currency)}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Badge className={`text-[9px] ${product.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                            {product.status === 'active' ? 'Actif' : 'Suspendu'}
                                        </Badge>
                                        <span className="text-[9px] text-slate-500">{product.views_count} vues</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white"
                                        onClick={() => startEditProduct(product)}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-amber-400"
                                        onClick={() => toggleProductStatus(product)}>
                                        {product.status === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-400"
                                        onClick={() => deleteProduct(product.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        );
    }

    // ═══════════ DASHBOARD ═══════════
    return (
        <div className="space-y-4">
            {/* Shop header */}
            <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={seller.shop_logo || userAvatar || undefined} />
                    <AvatarFallback className="bg-linear-to-br from-emerald-500 to-teal-500 text-white font-bold">
                        {(seller.shop_name || 'S').charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-white truncate">{seller.shop_name}</p>
                        {seller.is_verified && <Shield className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400">
                        Forfait {SELLER_PLANS.find(p => p.id === seller.plan)?.label} • {products.length}/{seller.max_products} produits
                    </p>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white"
                    onClick={() => setView('settings')}>
                    <Settings className="h-5 w-5" />
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-3 text-center">
                        <Eye className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{stats.totalViews}</p>
                        <p className="text-[9px] text-slate-500">Vues</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-3 text-center">
                        <Package className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{products.length}</p>
                        <p className="text-[9px] text-slate-500">Produits</p>
                    </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-3 text-center">
                        <MessageCircle className="h-4 w-4 text-purple-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{conversations.length}</p>
                        <p className="text-[9px] text-slate-500">Messages</p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-12 border-white/10 text-white hover:bg-white/5 justify-start"
                    onClick={() => setView('products')}>
                    <Package className="h-4 w-4 mr-2 text-emerald-400" /> Mes produits
                </Button>
                <Button variant="outline" className="h-12 border-white/10 text-white hover:bg-white/5 justify-start"
                    onClick={() => setView('orders')}>
                    <ShoppingCart className="h-4 w-4 mr-2 text-amber-400" /> Commandes
                </Button>
                <Button variant="outline" className="h-12 border-white/10 text-white hover:bg-white/5 justify-start col-span-2"
                    onClick={() => setView('messages')}>
                    <MessageCircle className="h-4 w-4 mr-2 text-purple-400" /> Messages clients
                    {conversations.length > 0 && (
                        <Badge className="ml-auto bg-purple-500/20 text-purple-400 text-[9px]">{conversations.length}</Badge>
                    )}
                </Button>
                <Button variant="outline" className="h-12 border-white/10 text-white hover:bg-white/5 justify-start col-span-2"
                    onClick={() => { resetProductForm(); setView('add_product'); }}
                    disabled={products.length >= (seller.max_products || 1)}>
                    <Plus className="h-4 w-4 mr-2 text-blue-400" />
                    {products.length >= (seller.max_products || 1) ? 'Limite atteinte — Passer au forfait supérieur' : 'Ajouter un produit'}
                </Button>
            </div>

            {/* Recent products preview */}
            {products.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Produits récents</h4>
                    <div className="space-y-2">
                        {products.slice(0, 3).map(product => (
                            <Card key={product.id} className="bg-white/5 border-white/10 cursor-pointer hover:border-emerald-500/30 transition"
                                onClick={() => startEditProduct(product)}>
                                <CardContent className="p-2 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                                        {product.images?.[0] ? (
                                            <img src={product.images[0]} className="w-full h-full object-cover" />
                                        ) : <Package className="h-4 w-4 text-slate-600 m-3" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{product.title}</p>
                                        <p className="text-[10px] text-emerald-400">{formatPrice(product.price, product.currency)}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-600" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
