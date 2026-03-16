'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, Image as ImageIcon, Paperclip, MoreVertical,
    Phone, Package, Pin, Search, X, Loader2, Check, CheckCheck,
    ShoppingBag, Store, Star, MapPin, Tag, ChevronRight, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import {
    Product, MarketplaceConversation, MarketplaceMessage,
    formatPrice, PRODUCT_CATEGORIES
} from '@/lib/marketplace-types';

interface ChatMarketplaceProps {
    userId: string;
    userName: string;
    userAvatar?: string;
}

// ─── Product Card in Chat ───
function ProductCardBubble({ product, onPin }: { product: Product; onPin?: () => void }) {
    return (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden max-w-[260px]">
            {product.images?.[0] && (
                <img src={product.images[0]} alt="" className="w-full h-32 object-cover" />
            )}
            <div className="p-3">
                <p className="text-xs font-bold text-white truncate">{product.title}</p>
                <p className="text-sm font-black text-emerald-400 mt-0.5">
                    {formatPrice(product.price, product.currency)}
                </p>
                {onPin && (
                    <button onClick={onPin}
                        className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300">
                        <Pin className="h-3 w-3" /> Épingler ce produit
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Offer Bubble ───
function OfferBubble({ amount, currency, isMine }: { amount: number; currency: string; isMine: boolean }) {
    return (
        <div className={`rounded-xl px-4 py-3 ${isMine ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-amber-600/20 border border-amber-500/30'}`}>
            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                {isMine ? '💰 Votre offre' : '💰 Offre reçue'}
            </p>
            <p className="text-lg font-black text-white">{formatPrice(amount, currency)}</p>
        </div>
    );
}

export function ChatMarketplace({ userId, userName, userAvatar }: ChatMarketplaceProps) {
    // ─── State ───
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeConversation, setActiveConversation] = useState<any | null>(null);
    const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
    const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // ─── Load conversations ───
    useEffect(() => {
        loadConversations();
        const channel = supabase
            .channel('marketplace-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'marketplace_messages',
            }, (payload) => {
                const msg = payload.new as MarketplaceMessage;
                if (msg.conversation_id === activeConversation?.id) {
                    setMessages(prev => [...prev, msg]);
                    setTimeout(scrollToBottom, 100);
                    // Mark as read
                    if (msg.sender_id !== userId) {
                        markAsRead(msg.id);
                    }
                } else {
                    // Increment unread
                    setUnreadCounts(prev => ({
                        ...prev,
                        [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1
                    }));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, activeConversation?.id]);

    const loadConversations = async () => {
        setIsLoading(true);
        try {
            // Buyer conversations
            const { data: buyerConvos } = await supabase
                .from('marketplace_conversations')
                .select('*, product:marketplace_products(id, title, images, price, currency)')
                .eq('buyer_id', userId)
                .order('last_message_at', { ascending: false });

            // Seller conversations
            const { data: sellerConvos } = await supabase
                .from('marketplace_conversations')
                .select('*, product:marketplace_products(id, title, images, price, currency)')
                .eq('seller_id', userId)
                .order('last_message_at', { ascending: false });

            const all = [...(buyerConvos || []), ...(sellerConvos || [])];
            // Deduplicate
            const unique = all.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

            // Load participant profiles
            const participantIds = new Set<string>();
            unique.forEach(c => {
                participantIds.add(c.buyer_id);
                participantIds.add(c.seller_id);
            });

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', Array.from(participantIds));

            const profileMap: Record<string, any> = {};
            profiles?.forEach(p => { profileMap[p.id] = p; });

            const enriched = unique.map(c => ({
                ...c,
                otherUser: profileMap[c.buyer_id === userId ? c.seller_id : c.buyer_id] || { full_name: 'Utilisateur', avatar_url: null },
                isSeller: c.seller_id === userId,
            }));

            setConversations(enriched);
        } catch (e) {
            console.error('Error loading marketplace conversations:', e);
        }
        setIsLoading(false);
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const { data } = await supabase
                .from('marketplace_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (data) {
                setMessages(data as any);
                // Mark unread as read
                const unread = data.filter(m => m.sender_id !== userId && !m.is_read);
                for (const m of unread) {
                    markAsRead(m.id);
                }
                setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
            }
        } catch { }
        setTimeout(scrollToBottom, 200);
    };

    const loadSellerProducts = async (sellerId: string) => {
        try {
            // Find seller profile
            const { data: sellerProfile } = await supabase
                .from('marketplace_sellers')
                .select('id')
                .eq('user_id', sellerId)
                .single();

            if (sellerProfile) {
                const { data } = await supabase
                    .from('marketplace_products')
                    .select('*')
                    .eq('seller_id', sellerProfile.id)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false });

                if (data) setSellerProducts(data as any);
            }
        } catch { }
    };

    const markAsRead = async (messageId: string) => {
        try {
            await supabase.from('marketplace_messages')
                .update({ is_read: true })
                .eq('id', messageId);
        } catch { }
    };

    const sendMessage = async (content: string, type: 'text' | 'image' | 'product_card' | 'offer' = 'text', productRefId?: string, offerAmount?: number) => {
        if (!activeConversation || (!content.trim() && type === 'text')) return;

        setIsSending(true);
        try {
            const { error } = await supabase.from('marketplace_messages').insert({
                conversation_id: activeConversation.id,
                sender_id: userId,
                content: content.trim(),
                message_type: type,
                product_reference_id: productRefId || null,
                offer_amount: offerAmount || null,
            });

            if (error) throw error;

            // Update conversation last message
            await supabase.from('marketplace_conversations')
                .update({
                    last_message: content.trim().substring(0, 100),
                    last_message_at: new Date().toISOString(),
                })
                .eq('id', activeConversation.id);

            setInputText('');
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSending(false);
    };

    const sendProductCard = (product: Product) => {
        sendMessage(`📦 ${product.title} — ${formatPrice(product.price, product.currency)}`, 'product_card', product.id);
        setShowCatalog(false);
    };

    const pinProduct = async (product: Product) => {
        setPinnedProduct(product);
        toast.success(`📌 ${product.title} épinglé`);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const openConversation = (conv: any) => {
        setActiveConversation(conv);
        loadMessages(conv.id);
        // Load seller's product catalog
        const sellerId = conv.isSeller ? userId : conv.seller_id;
        loadSellerProducts(sellerId);
        // If there's a linked product, pin it
        if (conv.product) {
            setPinnedProduct(conv.product);
        }
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 86400000) return 'Aujourd\'hui';
        if (diff < 172800000) return 'Hier';
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    // ═══════════════════ CATALOG SIDEBAR ═══════════════════
    const CatalogPanel = () => (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute inset-0 z-50 bg-[#0B0E14] flex flex-col"
        >
            <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setShowCatalog(false)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h3 className="text-sm font-bold text-white">Catalogue du vendeur</h3>
                    <p className="text-[10px] text-slate-400">{sellerProducts.length} produits</p>
                </div>
            </header>

            {/* Search */}
            <div className="px-4 py-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un produit..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-4 py-2 space-y-2">
                    {sellerProducts
                        .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(product => (
                            <Card key={product.id}
                                className="bg-white/5 border-white/10 cursor-pointer hover:border-emerald-500/30 transition-all"
                                onClick={() => sendProductCard(product)}>
                                <CardContent className="p-2 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                                        {product.images?.[0] ? (
                                            <img src={product.images[0]} className="w-full h-full object-cover" />
                                        ) : <Package className="h-5 w-5 text-slate-600 m-3.5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white truncate">{product.title}</p>
                                        <p className="text-xs text-emerald-400 font-bold">
                                            {formatPrice(product.price, product.currency)}
                                        </p>
                                    </div>
                                    <Send className="h-4 w-4 text-slate-500" />
                                </CardContent>
                            </Card>
                        ))}

                    {sellerProducts.length === 0 && (
                        <div className="text-center py-8">
                            <Package className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                            <p className="text-xs text-slate-500">Aucun produit dans le catalogue</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </motion.div>
    );

    // ═══════════════════ CONVERSATION VIEW ═══════════════════
    if (activeConversation) {
        const other = activeConversation.otherUser;

        return (
            <div className="flex flex-col h-full relative">
                {/* Header */}
                <header className="px-3 py-2.5 border-b border-white/10 flex items-center gap-3 bg-[#0F1219] shrink-0">
                    <Button variant="ghost" size="icon" className="shrink-0"
                        onClick={() => { setActiveConversation(null); setPinnedProduct(null); setShowCatalog(false); }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={other?.avatar_url || undefined} />
                        <AvatarFallback className="bg-linear-to-br from-emerald-500 to-teal-500 text-white text-xs font-bold">
                            {(other?.full_name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{other?.full_name || 'Utilisateur'}</p>
                        <p className="text-[10px] text-slate-400">
                            {activeConversation.isSeller ? '👤 Acheteur' : '🏪 Vendeur'}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-slate-400"
                        onClick={() => setShowCatalog(true)}>
                        <ShoppingBag className="h-5 w-5" />
                    </Button>
                </header>

                {/* Pinned product */}
                {pinnedProduct && (
                    <div className="px-3 py-2 border-b border-white/10 bg-emerald-500/5 flex items-center gap-3">
                        <Pin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        {pinnedProduct.images?.[0] && (
                            <img src={pinnedProduct.images[0]} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-white truncate">{pinnedProduct.title}</p>
                            <p className="text-[10px] text-emerald-400 font-bold">
                                {formatPrice(pinnedProduct.price, pinnedProduct.currency)}
                            </p>
                        </div>
                        <button onClick={() => setPinnedProduct(null)} className="text-slate-500 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {/* Messages */}
                <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-3 py-3">
                    <div className="space-y-3">
                        {messages.map((msg, idx) => {
                            const isMine = msg.sender_id === userId;
                            const showDate = idx === 0 || formatDate(messages[idx - 1].created_at) !== formatDate(msg.created_at);

                            return (
                                <div key={msg.id}>
                                    {showDate && (
                                        <div className="text-center my-3">
                                            <span className="text-[10px] text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                                                {formatDate(msg.created_at)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] ${isMine ? 'items-end' : 'items-start'}`}>
                                            {msg.message_type === 'offer' && msg.offer_amount ? (
                                                <OfferBubble amount={msg.offer_amount} currency="XAF" isMine={isMine} />
                                            ) : (
                                                <div className={`rounded-2xl px-3.5 py-2 ${isMine
                                                    ? 'bg-emerald-600 text-white rounded-br-sm'
                                                    : 'bg-white/10 text-white rounded-bl-sm'
                                                    }`}>
                                                    {msg.message_type === 'product_card' ? (
                                                        <div className="flex items-center gap-2">
                                                            <Package className="h-4 w-4 text-emerald-200 shrink-0" />
                                                            <p className="text-sm">{msg.content}</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                    )}
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : ''}`}>
                                                <span className="text-[9px] text-slate-500">{formatTime(msg.created_at)}</span>
                                                {isMine && (
                                                    msg.is_read
                                                        ? <CheckCheck className="h-3 w-3 text-blue-400" />
                                                        : <Check className="h-3 w-3 text-slate-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input bar */}
                <div className="px-3 py-2 border-t border-white/10 bg-[#0F1219] shrink-0">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon"
                            className="h-9 w-9 text-slate-400 hover:text-emerald-400 shrink-0"
                            onClick={() => setShowCatalog(true)}>
                            <ShoppingBag className="h-5 w-5" />
                        </Button>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); } }}
                                placeholder="Écrire un message..."
                                className="w-full px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <Button
                            size="icon"
                            className="h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-500 shrink-0"
                            onClick={() => sendMessage(inputText)}
                            disabled={!inputText.trim() || isSending}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {/* Catalog overlay */}
                <AnimatePresence>
                    {showCatalog && <CatalogPanel />}
                </AnimatePresence>
            </div>
        );
    }

    // ═══════════════════ CONVERSATION LIST ═══════════════════
    return (
        <div className="flex flex-col h-full">
            <header className="px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">Marketplace Chat</h3>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{conversations.length} conversation(s)</p>
            </header>

            {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                </div>
            ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 px-4">
                    <ShoppingBag className="h-12 w-12 text-slate-700 mb-3" />
                    <p className="text-sm text-slate-400 text-center">
                        Aucune conversation marketplace.
                    </p>
                    <p className="text-xs text-slate-500 text-center mt-1">
                        Cliquez sur "Discuter" sur un produit pour commencer.
                    </p>
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-white/5">
                        {conversations.map(conv => {
                            const other = conv.otherUser;
                            const unread = unreadCounts[conv.id] || 0;

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => openConversation(conv)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="relative">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={other?.avatar_url || undefined} />
                                            <AvatarFallback className="bg-linear-to-br from-emerald-500 to-teal-500 text-white text-sm font-bold">
                                                {(other?.full_name || 'U').charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {unread > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                                {unread}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-white truncate">{other?.full_name}</p>
                                            {conv.last_message_at && (
                                                <span className="text-[10px] text-slate-500 shrink-0">
                                                    {formatDate(conv.last_message_at)}
                                                </span>
                                            )}
                                        </div>
                                        {conv.product && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Package className="h-3 w-3 text-emerald-400 shrink-0" />
                                                <span className="text-[10px] text-emerald-400 truncate">{conv.product.title}</span>
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 truncate mt-0.5">{conv.last_message || 'Nouvelle conversation'}</p>
                                    </div>
                                    <Badge className={`text-[8px] ${conv.isSeller ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {conv.isSeller ? 'Vendeur' : 'Acheteur'}
                                    </Badge>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
