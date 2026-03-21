'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ShoppingBag, Plus, Edit, Trash2, Eye, EyeOff, Pin, PinOff,
    Image as ImageIcon, Loader2, Search, Package, Star, ArrowLeft,
    BookMarked, Upload, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    Product, PRODUCT_CATEGORIES, ProductCategory,
    formatPrice, CURRENCIES
} from '@/lib/marketplace-types';

export default function AdminMarketplacePage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'products' | 'post' | 'orders'>('products');
    const [orders, setOrders] = useState<any[]>([]);

    // Post product form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [currency, setCurrency] = useState('XAF');
    const [category, setCategory] = useState<ProductCategory>('other');
    const [location, setLocation] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [stockQuantity, setStockQuantity] = useState('1');
    const [isNegotiable, setIsNegotiable] = useState(false);
    const [deliveryOptions, setDeliveryOptions] = useState<string[]>(['pickup']);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Load all products
    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('marketplace_products')
                .select('*, seller:marketplace_sellers(id, user_id, shop_name, is_verified)')
                .order('created_at', { ascending: false });
            if (!error) setProducts((data || []) as any);
        } catch (e: any) { }
        setLoading(false);
    }, []);

    // Load orders
    const loadOrders = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('marketplace_orders')
                .select('*, product:marketplace_products(id, title, images, price, currency), buyer:profiles!marketplace_orders_buyer_id_fkey(id, full_name, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(50);
            if (data) setOrders(data);
        } catch { }
    }, []);

    useEffect(() => {
        loadProducts();
        loadOrders();
    }, [loadProducts, loadOrders]);

    // Toggle product pin (featured)
    const togglePinProduct = async (product: Product) => {
        const newVal = !(product as any).is_featured;
        const { error } = await supabase
            .from('marketplace_products')
            .update({ is_featured: newVal })
            .eq('id', product.id);
        if (!error) {
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_featured: newVal } as any : p));
            toast.success(newVal ? '📌 Produit épinglé !' : 'Produit désépinglé');
        }
    };

    // Toggle product visibility
    const toggleProductVisibility = async (product: Product) => {
        const newStatus = product.status === 'active' ? 'draft' : 'active';
        const { error } = await supabase
            .from('marketplace_products')
            .update({ status: newStatus })
            .eq('id', product.id);
        if (!error) {
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
            toast.success(newStatus === 'active' ? 'Produit visible' : 'Produit masqué');
        }
    };

    // Delete product
    const deleteProduct = async (id: string) => {
        if (!confirm('Supprimer ce produit définitivement ?')) return;
        const { error } = await supabase.from('marketplace_products').delete().eq('id', id);
        if (!error) {
            setProducts(prev => prev.filter(p => p.id !== id));
            toast.success('Produit supprimé');
        }
    };

    // Update order status
    const updateOrderStatus = async (orderId: string, status: string) => {
        const { error } = await supabase
            .from('marketplace_orders')
            .update({ status })
            .eq('id', orderId);
        if (!error) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
            toast.success(`Commande ${status === 'confirmed' ? 'confirmée' : status === 'shipped' ? 'expédiée' : status === 'delivered' ? 'livrée' : status === 'cancelled' ? 'annulée' : 'mise à jour'}`);
        }
    };

    // Image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        const newImages = [...images];

        for (const file of Array.from(files)) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error(`${file.name} trop volumineux (max 5 Mo)`);
                continue;
            }
            const ext = file.name.split('.').pop();
            const path = `marketplace/admin_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage.from('chat-files').upload(path, file, { upsert: true });
            if (!error) {
                const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path);
                newImages.push(urlData.publicUrl);
            }
        }
        setImages(newImages);
        e.target.value = '';
        setIsUploading(false);
    };

    // Save product (create or edit)
    const saveProduct = async () => {
        if (!title.trim()) { toast.error('Titre requis'); return; }
        if (!price || parseFloat(price) <= 0) { toast.error('Prix invalide'); return; }
        if (images.length === 0) { toast.error('Ajoutez au moins une image'); return; }

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Non connecté');

            // Get or create admin seller profile
            let { data: seller } = await supabase
                .from('marketplace_sellers')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!seller) {
                const { data: newSeller, error: sellerErr } = await supabase
                    .from('marketplace_sellers')
                    .insert({
                        user_id: user.id,
                        shop_name: 'Boutique Admin',
                        is_verified: true,
                        plan: 'enterprise',
                        max_products: 999,
                    })
                    .select('id')
                    .single();
                if (sellerErr) throw sellerErr;
                seller = newSeller;
            }

            const productData: Record<string, any> = {
                seller_id: seller!.id,
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price),
                currency,
                category,
                location: location.trim() || null,
                images,
                stock_quantity: parseInt(stockQuantity) || 1,
                is_negotiable: isNegotiable,
                delivery_options: deliveryOptions,
                status: 'active' as const,
            };

            if (editingProduct) {
                const { error } = await supabase
                    .from('marketplace_products')
                    .update(productData)
                    .eq('id', editingProduct.id);
                if (error) throw error;
                toast.success('Produit mis à jour !');
            } else {
                const { error } = await supabase
                    .from('marketplace_products')
                    .insert(productData);
                if (error) throw error;
                toast.success('Produit publié sur la marketplace !');
            }

            resetForm();
            setTab('products');
            loadProducts();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        }
        setIsSaving(false);
    };

    const resetForm = () => {
        setTitle(''); setDescription(''); setPrice(''); setCurrency('XAF');
        setCategory('other'); setLocation('');
        setImages([]); setEditingProduct(null);
        setStockQuantity('1'); setIsNegotiable(false);
        setDeliveryOptions(['pickup']);
    };

    const startEdit = (product: Product) => {
        setTitle(product.title);
        setDescription(product.description || '');
        setPrice(String(product.price));
        setCurrency(product.currency);
        setCategory(product.category);
        setLocation(product.location || '');
        setImages(product.images || []);
        setStockQuantity(String(product.stock_quantity || 1));
        setIsNegotiable(product.is_negotiable || false);
        setDeliveryOptions(product.delivery_options || ['pickup']);
        setEditingProduct(product);
        setTab('post');
    };

    const filtered = products.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.category.includes(search.toLowerCase())
    );

    const pinnedProducts = products.filter(p => (p as any).is_featured);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge className="bg-amber-500/20 text-amber-400 border-none text-[9px]">⏳ En attente</Badge>;
            case 'confirmed': return <Badge className="bg-blue-500/20 text-blue-400 border-none text-[9px]">✅ Confirmée</Badge>;
            case 'shipped': return <Badge className="bg-purple-500/20 text-purple-400 border-none text-[9px]">📦 Expédiée</Badge>;
            case 'delivered': return <Badge className="bg-green-500/20 text-green-400 border-none text-[9px]">✓ Livrée</Badge>;
            case 'cancelled': return <Badge className="bg-red-500/20 text-red-400 border-none text-[9px]">✗ Annulée</Badge>;
            default: return <Badge className="bg-slate-500/20 text-slate-400 border-none text-[9px]">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingBag className="h-6 w-6 text-orange-400" />
                        Gestion Marketplace
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {products.length} produits · {pinnedProducts.length} épinglés · {orders.length} commandes
                    </p>
                </div>
                <Button onClick={() => { resetForm(); setTab('post'); }} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="h-4 w-4 mr-2" /> Poster un article
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <Button
                    variant={tab === 'products' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTab('products')}
                    className={tab === 'products' ? 'bg-orange-600' : ''}
                >
                    <Package className="h-4 w-4 mr-1" /> Produits ({products.length})
                </Button>
                <Button
                    variant={tab === 'orders' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setTab('orders'); loadOrders(); }}
                    className={tab === 'orders' ? 'bg-blue-600' : ''}
                >
                    <ShoppingBag className="h-4 w-4 mr-1" /> Commandes ({orders.length})
                </Button>
                <Button
                    variant={tab === 'post' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { resetForm(); setTab('post'); }}
                    className={tab === 'post' ? 'bg-green-600' : ''}
                >
                    <Plus className="h-4 w-4 mr-1" /> Poster
                </Button>
            </div>

            {/* ═══ PRODUCTS TAB ═══ */}
            {tab === 'products' && (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Rechercher un produit..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 bg-white/5 border-white/10"
                        />
                    </div>

                    {/* Pinned Products section */}
                    {pinnedProducts.length > 0 && (
                        <Card className="border-orange-500/20 bg-orange-500/5">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
                                    <Pin className="h-4 w-4" /> Produits épinglés ({pinnedProducts.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {pinnedProducts.map(p => (
                                        <Badge key={p.id} className="bg-orange-600/20 text-orange-300 border-orange-500/30 gap-1">
                                            📌 {p.title}
                                            <button onClick={() => togglePinProduct(p)} className="ml-1 hover:text-red-400">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>Aucun produit trouvé</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filtered.map(product => (
                                <Card key={product.id} className="bg-white/5 border-white/10">
                                    <CardContent className="p-4">
                                        <div className="flex gap-4">
                                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <ImageIcon className="h-6 w-6 text-slate-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-sm truncate">{product.title}</h3>
                                                    {(product as any).is_featured && (
                                                        <Badge className="bg-orange-600/20 text-orange-400 text-[9px] border-none">📌</Badge>
                                                    )}
                                                    <Badge className={product.status === 'active'
                                                        ? 'bg-green-600/20 text-green-400 border-none text-[9px]'
                                                        : 'bg-slate-600/20 text-slate-400 border-none text-[9px]'
                                                    }>
                                                        {product.status === 'active' ? 'Visible' : 'Masqué'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {formatPrice(product.price, product.currency)} · {product.category} · Stock: {product.stock_quantity}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePinProduct(product)}
                                                    title={(product as any).is_featured ? 'Désépingler' : 'Épingler'}>
                                                    {(product as any).is_featured
                                                        ? <PinOff className="h-4 w-4 text-orange-400" />
                                                        : <Pin className="h-4 w-4 text-slate-400" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleProductVisibility(product)}>
                                                    {product.status === 'active'
                                                        ? <Eye className="h-4 w-4 text-green-400" />
                                                        : <EyeOff className="h-4 w-4 text-slate-400" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(product)}>
                                                    <Edit className="h-4 w-4 text-blue-400" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteProduct(product.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ ORDERS TAB ═══ */}
            {tab === 'orders' && (
                <div className="space-y-4">
                    {orders.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>Aucune commande pour le moment</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {orders.map(order => (
                                <Card key={order.id} className="bg-white/5 border-white/10">
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                                                {order.product?.images?.[0] ? (
                                                    <img src={order.product.images[0]} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="h-5 w-5 text-slate-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-sm truncate">{order.product?.title || 'Produit supprimé'}</h3>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Acheteur: {order.buyer?.full_name || 'Inconnu'} · Qté: {order.quantity} · {formatPrice(order.total_price, order.product?.currency || 'XAF')}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                {order.delivery_address && (
                                                    <p className="text-[10px] text-slate-500 mt-0.5">📍 {order.delivery_address}</p>
                                                )}
                                                {order.notes && (
                                                    <p className="text-[10px] text-slate-500 mt-0.5">📝 {order.notes}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 shrink-0">
                                                {order.status === 'pending' && (
                                                    <>
                                                        <Button size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700"
                                                            onClick={() => updateOrderStatus(order.id, 'confirmed')}>
                                                            ✅ Confirmer
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-400 border-red-500/30"
                                                            onClick={() => updateOrderStatus(order.id, 'cancelled')}>
                                                            ✗ Annuler
                                                        </Button>
                                                    </>
                                                )}
                                                {order.status === 'confirmed' && (
                                                    <Button size="sm" className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700"
                                                        onClick={() => updateOrderStatus(order.id, 'shipped')}>
                                                        📦 Expédier
                                                    </Button>
                                                )}
                                                {order.status === 'shipped' && (
                                                    <Button size="sm" className="h-7 text-[10px] bg-green-600 hover:bg-green-700"
                                                        onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                                        ✓ Livrée
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ POST PRODUCT TAB ═══ */}
            {tab === 'post' && (
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {editingProduct ? <Edit className="h-5 w-5 text-blue-400" /> : <Plus className="h-5 w-5 text-green-400" />}
                            {editingProduct ? 'Modifier le produit' : 'Poster un nouvel article'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs text-slate-400">Titre</Label>
                            <Input
                                placeholder="Nom du produit..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        <div>
                            <Label className="text-xs text-slate-400">Description</Label>
                            <Textarea
                                placeholder="Décrivez le produit..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="bg-white/5 border-white/10 min-h-[80px]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-slate-400">Prix</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-400">Devise</Label>
                                <select
                                    value={currency}
                                    onChange={e => setCurrency(e.target.value)}
                                    className="w-full h-10 rounded-md bg-slate-800 border border-white/10 px-3 text-sm text-white [&>option]:bg-slate-800 [&>option]:text-white"
                                >
                                    {CURRENCIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-slate-400">Catégorie</Label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value as ProductCategory)}
                                    className="w-full h-10 rounded-md bg-slate-800 border border-white/10 px-3 text-sm text-white [&>option]:bg-slate-800 [&>option]:text-white"
                                >
                                    {PRODUCT_CATEGORIES.map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-400">Stock</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={stockQuantity}
                                    onChange={e => setStockQuantity(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="negotiable"
                                    checked={isNegotiable}
                                    onChange={e => setIsNegotiable(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5"
                                />
                                <Label htmlFor="negotiable" className="text-xs text-slate-400 cursor-pointer">Prix négociable</Label>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-400">Livraison</Label>
                                <div className="flex gap-2 mt-1">
                                    {['pickup', 'delivery', 'shipping'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => {
                                                setDeliveryOptions(prev =>
                                                    prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
                                                );
                                            }}
                                            className={`text-[10px] px-2 py-1 rounded-lg transition-all ${deliveryOptions.includes(opt)
                                                    ? 'bg-orange-600/30 text-orange-300 border border-orange-500/30'
                                                    : 'bg-white/5 text-slate-500 border border-white/10'
                                                }`}
                                        >
                                            {opt === 'pickup' ? '🏪 Retrait' : opt === 'delivery' ? '🚗 Livraison' : '📦 Expédition'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-xs text-slate-400">Localisation (optionnel)</Label>
                            <Input
                                placeholder="Ville, pays..."
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                className="bg-white/5 border-white/10"
                            />
                        </div>

                        {/* Images */}
                        <div>
                            <Label className="text-xs text-slate-400">Photos ({images.length}/5)</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {images.map((img, i) => (
                                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden">
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute top-0.5 right-0.5 bg-red-500 rounded-full p-0.5"
                                        >
                                            <X className="h-3 w-3 text-white" />
                                        </button>
                                    </div>
                                ))}
                                {images.length < 5 && (
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-orange-400 transition-colors"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                                        ) : (
                                            <Upload className="h-5 w-5 text-slate-400" />
                                        )}
                                    </button>
                                )}
                            </div>
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => { resetForm(); setTab('products'); }} className="flex-1">
                                Annuler
                            </Button>
                            <Button
                                onClick={saveProduct}
                                disabled={isSaving}
                                className="flex-1 bg-orange-600 hover:bg-orange-700"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : editingProduct ? (
                                    <Check className="h-4 w-4 mr-2" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                {editingProduct ? 'Sauvegarder' : 'Publier'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
