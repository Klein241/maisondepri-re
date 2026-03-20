'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Trash2, Edit, Plus, LayoutTemplate, Loader2, MapPin, BookOpen, Home,
    ShoppingBag, Search, PanelRight, BookOpenCheck, Upload, ImageIcon,
    Eye, EyeOff, BarChart3, MousePointerClick, TrendingUp, X, ExternalLink,
    Calendar, ToggleLeft, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';

// Upload helper — sends files to Supabase Storage or Cloudflare R2
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || process.env.NEXT_PUBLIC_NOTIFICATION_WORKER_URL || '';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

async function uploadAdImage(file: File): Promise<string> {
    // Try Cloudflare R2 first
    if (WORKER_URL) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'ads');
            const res = await fetch(`${WORKER_URL}/api/r2/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ADMIN_KEY}` },
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                return data.url;
            }
        } catch { /* fallback to Supabase */ }
    }

    // Fallback: Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `ads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('library').upload(fileName, file, { upsert: true });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from('library').getPublicUrl(fileName);
    return urlData.publicUrl;
}

async function deleteAdImage(url: string) {
    if (!url) return;
    // Try R2 delete
    if (WORKER_URL && url.includes('r2')) {
        try {
            await fetch(`${WORKER_URL}/api/r2/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_KEY}` },
                body: JSON.stringify({ url }),
            });
            return;
        } catch { /* fallback */ }
    }
    // Supabase Storage fallback
    const path = url.split('/library/')[1];
    if (path) await supabase.storage.from('library').remove([path]);
}

// Les 6 emplacements publicitaires dans l'application
const AD_PLACEMENTS = [
    {
        value: 'book_detail',
        label: '📖 Détail du livre',
        description: 'Apparaît entre les suggestions de lecture',
        icon: BookOpen,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
        value: 'home_feed',
        label: '📚 Accueil bibliothèque',
        description: 'Bannière en haut de la page bibliothèque',
        icon: BookOpenCheck,
        color: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/20',
    },
    {
        value: 'marketplace',
        label: '🛍️ Marketplace',
        description: 'Annonce sponsorisée dans le marketplace',
        icon: ShoppingBag,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
        value: 'reader_end',
        label: '🏠 Page d\'accueil',
        description: 'Bannière sur la page principale',
        icon: Home,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
        value: 'search_results',
        label: '🔍 Résultats de recherche',
        description: 'Annonce ciblée dans les résultats',
        icon: Search,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
        value: 'sidebar',
        label: '📌 Barre latérale',
        description: 'Encart dans le panneau des groupes/salons',
        icon: PanelRight,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/20',
    },
];

interface LibraryAd {
    id: string;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
    display_order: number;
    click_count: number;
    view_count: number;
    placement: string;
    start_date?: string;
    end_date?: string;
    created_at?: string;
}

export default function AdminAdsPage() {
    const [ads, setAds] = useState<LibraryAd[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
    const [editingAd, setEditingAd] = useState<LibraryAd | null>(null);
    const [adForm, setAdForm] = useState({
        title: '', description: '', image_url: '', link_url: '',
        is_active: true, display_order: 0, placement: 'book_detail',
        start_date: '', end_date: '',
    });
    const [adSaving, setAdSaving] = useState(false);
    const [filterPlacement, setFilterPlacement] = useState<string>('all');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('library_ads').select('*').order('display_order');
            if (data) setAds(data);
        } catch { /* table may not exist */ }
        setIsLoading(false);
    };

    // ── Upload Image ────────────────────────
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Seules les images sont acceptées');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('L\'image ne doit pas dépasser 5 Mo');
            return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setAdForm(p => ({ ...p, image_url: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Save Ad ────────────────────────
    const saveAd = async () => {
        if (!adForm.title) {
            toast.error('Le titre est obligatoire');
            return;
        }
        if (!imageFile && !adForm.image_url) {
            toast.error('Une image est obligatoire');
            return;
        }

        setAdSaving(true);
        try {
            let imageUrl = adForm.image_url;

            // Upload new image if selected
            if (imageFile) {
                setIsUploading(true);
                imageUrl = await uploadAdImage(imageFile);
                setIsUploading(false);

                // Delete old image if editing
                if (editingAd && editingAd.image_url && editingAd.image_url !== imageUrl) {
                    await deleteAdImage(editingAd.image_url).catch(() => { });
                }
            }

            const payload = {
                title: adForm.title,
                description: adForm.description,
                image_url: imageUrl,
                link_url: adForm.link_url,
                is_active: adForm.is_active,
                display_order: adForm.display_order,
                placement: adForm.placement,
                start_date: adForm.start_date || null,
                end_date: adForm.end_date || null,
            };

            if (editingAd) {
                const { error } = await supabase.from('library_ads').update(payload).eq('id', editingAd.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('library_ads').insert(payload);
                if (error) throw error;
            }

            toast.success(editingAd ? 'Publicité modifiée ✅' : 'Publicité créée ✅');
            setIsAdDialogOpen(false);
            setEditingAd(null);
            setImageFile(null);
            setImagePreview(null);
            fetchAds();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        } finally {
            setAdSaving(false);
            setIsUploading(false);
        }
    };

    // ── Toggle Active ────────────────────────
    const toggleActive = async (ad: LibraryAd) => {
        try {
            await supabase.from('library_ads').update({ is_active: !ad.is_active }).eq('id', ad.id);
            setAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
            toast.success(ad.is_active ? 'Publicité désactivée' : 'Publicité activée');
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // ── Delete Ad ────────────────────────
    const deleteAd = async (ad: LibraryAd) => {
        if (!confirm(`Supprimer la publicité "${ad.title}" ?`)) return;
        try {
            // Delete image from storage
            if (ad.image_url) await deleteAdImage(ad.image_url).catch(() => { });
            // Delete record
            await supabase.from('library_ads').delete().eq('id', ad.id);
            toast.success('Publicité supprimée');
            fetchAds();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // ── Open Form ────────────────────────
    const openAdForm = (ad?: LibraryAd) => {
        if (ad) {
            setEditingAd(ad);
            setAdForm({
                title: ad.title, description: ad.description, image_url: ad.image_url,
                link_url: ad.link_url, is_active: ad.is_active,
                display_order: ad.display_order, placement: ad.placement || 'book_detail',
                start_date: ad.start_date || '', end_date: ad.end_date || '',
            });
            setImagePreview(ad.image_url || null);
        } else {
            setEditingAd(null);
            setAdForm({
                title: '', description: '', image_url: '', link_url: '',
                is_active: true, display_order: ads.length, placement: 'book_detail',
                start_date: '', end_date: '',
            });
            setImagePreview(null);
        }
        setImageFile(null);
        setIsAdDialogOpen(true);
    };

    // ── Reset View Count ────────────────────────
    const resetStats = async (ad: LibraryAd) => {
        if (!confirm('Remettre les statistiques à zéro pour cette publicité ?')) return;
        await supabase.from('library_ads').update({ click_count: 0, view_count: 0 }).eq('id', ad.id);
        toast.success('Statistiques remises à zéro');
        fetchAds();
    };

    const getPlacementInfo = (placement: string) =>
        AD_PLACEMENTS.find(p => p.value === placement) || AD_PLACEMENTS[0];

    const filteredAds = filterPlacement === 'all'
        ? ads
        : ads.filter(a => a.placement === filterPlacement);

    const totalClicks = ads.reduce((s, a) => s + (a.click_count || 0), 0);
    const totalViews = ads.reduce((s, a) => s + (a.view_count || 0), 0);
    const activeCount = ads.filter(a => a.is_active).length;
    const avgCtr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <LayoutTemplate className="w-6 h-6 text-amber-500" />
                        Espace Publicitaire
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Gérez les publicités affichées à travers l'application
                    </p>
                </div>
                <Button onClick={() => openAdForm()} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
                    <Plus className="w-4 h-4" /> Nouvelle pub
                </Button>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">{ads.length}</p>
                    <p className="text-xs text-muted-foreground">Total annonces</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">Actives</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">{totalViews.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" /> Impressions
                    </p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-purple-400">{totalClicks.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> Clics
                    </p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-rose-400">{avgCtr}%</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3" /> CTR moyen
                    </p>
                </div>
            </div>

            {/* Placements Map */}
            <Card className="border-white/10">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-400" />
                        Emplacements disponibles
                    </CardTitle>
                    <CardDescription className="text-xs">
                        6 zones stratégiques — cliquez pour filtrer
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {AD_PLACEMENTS.map(p => {
                            const count = ads.filter(a => a.placement === p.value).length;
                            const activeInSlot = ads.filter(a => a.placement === p.value && a.is_active).length;
                            const isSelected = filterPlacement === p.value;
                            return (
                                <button
                                    key={p.value}
                                    onClick={() => setFilterPlacement(isSelected ? 'all' : p.value)}
                                    className={`text-left p-3 rounded-xl border transition-all ${isSelected
                                        ? p.bg + ' ring-1 ring-white/20 shadow-lg'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <p.icon className={`w-4 h-4 ${p.color}`} />
                                        <span className="text-xs font-semibold text-white">{p.label}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 line-clamp-1">{p.description}</p>
                                    <div className="flex gap-1.5 mt-2">
                                        <Badge variant="outline" className="text-[9px]">
                                            {count} annonce{count !== 1 ? 's' : ''}
                                        </Badge>
                                        {activeInSlot > 0 && (
                                            <Badge className="text-[9px] bg-green-500/20 text-green-400 border-green-500/30">
                                                {activeInSlot} active{activeInSlot > 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Ads Grid */}
            <Card className="border-amber-500/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>
                                {filterPlacement === 'all'
                                    ? 'Toutes les campagnes'
                                    : `Campagnes — ${getPlacementInfo(filterPlacement).label}`}
                            </CardTitle>
                            <CardDescription>
                                {filteredAds.length} publicité{filteredAds.length !== 1 ? 's' : ''}
                                {filterPlacement !== 'all' && (
                                    <button onClick={() => setFilterPlacement('all')} className="ml-2 text-amber-400 hover:underline text-xs">
                                        Tout afficher
                                    </button>
                                )}
                            </CardDescription>
                        </div>
                        <Button onClick={() => openAdForm()} size="sm" className="bg-amber-600 hover:bg-amber-500 text-white">
                            <Plus className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" /></div>
                    ) : filteredAds.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl bg-slate-800/20">
                            <LayoutTemplate className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                            <p className="text-sm font-medium">Aucune publicité configurée</p>
                            <p className="text-xs mt-1">Créez votre première annonce pour la diffuser</p>
                            <Button onClick={() => openAdForm()} variant="outline" size="sm" className="mt-4 gap-2">
                                <Plus className="w-4 h-4" /> Créer maintenant
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredAds.map(ad => {
                                const pInfo = getPlacementInfo(ad.placement);
                                const ctr = ad.view_count > 0 ? ((ad.click_count / ad.view_count) * 100).toFixed(1) : '0.0';
                                return (
                                    <div key={ad.id} className={`rounded-xl border overflow-hidden transition-all shadow-sm group ${ad.is_active
                                        ? 'bg-slate-800/80 border-amber-500/20 hover:border-amber-500/40'
                                        : 'bg-slate-900/50 border-white/5 opacity-60'
                                        }`}>
                                        {/* Image */}
                                        {ad.image_url ? (
                                            <div className="aspect-video w-full overflow-hidden bg-slate-900 relative">
                                                <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                                                {/* Status overlay */}
                                                <div className="absolute top-2 right-2">
                                                    <Badge className={`text-[9px] ${ad.is_active
                                                        ? 'bg-green-500/90 text-white'
                                                        : 'bg-slate-700/90 text-slate-300'
                                                        }`}>
                                                        {ad.is_active ? '🟢 Active' : '⏸ Inactive'}
                                                    </Badge>
                                                </div>
                                                {/* Placement badge */}
                                                <div className="absolute bottom-2 left-2">
                                                    <Badge variant="outline" className={`text-[9px] bg-black/60 backdrop-blur-sm ${pInfo.color}`}>
                                                        <pInfo.icon className="w-3 h-3 mr-1" />
                                                        {pInfo.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="aspect-video bg-slate-800/50 flex items-center justify-center">
                                                <ImageIcon className="w-8 h-8 text-slate-600" />
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="p-3 space-y-2">
                                            <p className="text-sm font-semibold text-white truncate" title={ad.title}>
                                                {ad.title}
                                            </p>
                                            {ad.description && (
                                                <p className="text-[11px] text-slate-400 line-clamp-2">{ad.description}</p>
                                            )}

                                            {/* Stats row */}
                                            <div className="grid grid-cols-3 gap-1.5 pt-1">
                                                <div className="bg-black/30 px-1.5 py-1 rounded text-center">
                                                    <p className="text-[10px] text-blue-400 font-bold">{(ad.view_count || 0).toLocaleString()}</p>
                                                    <p className="text-[8px] text-slate-500">vues</p>
                                                </div>
                                                <div className="bg-black/30 px-1.5 py-1 rounded text-center">
                                                    <p className="text-[10px] text-amber-400 font-bold">{(ad.click_count || 0).toLocaleString()}</p>
                                                    <p className="text-[8px] text-slate-500">clics</p>
                                                </div>
                                                <div className="bg-black/30 px-1.5 py-1 rounded text-center">
                                                    <p className="text-[10px] text-rose-400 font-bold">{ctr}%</p>
                                                    <p className="text-[8px] text-slate-500">CTR</p>
                                                </div>
                                            </div>

                                            {/* Link */}
                                            {ad.link_url && (
                                                <a
                                                    href={ad.link_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline truncate"
                                                >
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                    {ad.link_url}
                                                </a>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                                <div className="flex items-center gap-1.5">
                                                    <Switch
                                                        checked={ad.is_active}
                                                        onCheckedChange={() => toggleActive(ad)}
                                                        className="scale-75"
                                                    />
                                                    <span className="text-[10px] text-slate-400">
                                                        {ad.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7 bg-white/5 hover:bg-white/10"
                                                        onClick={() => resetStats(ad)}
                                                        title="Remettre les stats à zéro"
                                                    >
                                                        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7 bg-white/5 hover:bg-white/10"
                                                        onClick={() => openAdForm(ad)}
                                                        title="Modifier"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7 text-red-400 bg-red-500/5 hover:bg-red-500/10 hover:text-red-300"
                                                        onClick={() => deleteAd(ad)}
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════ Ad Create/Edit Dialog ═══════════════ */}
            <Dialog open={isAdDialogOpen} onOpenChange={(open) => {
                setIsAdDialogOpen(open);
                if (!open) { setImageFile(null); setImagePreview(null); }
            }}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-amber-400" />
                            {editingAd ? 'Modifier la publicité' : 'Nouvelle publicité'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label>Titre de la campagne *</Label>
                            <Input
                                value={adForm.title}
                                onChange={e => setAdForm(p => ({ ...p, title: e.target.value }))}
                                placeholder="Ex: Masterclass Théologie 2026"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={adForm.description}
                                onChange={e => setAdForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="Sous-titre ou texte de l'annonce..."
                                rows={2}
                            />
                        </div>

                        {/* ── IMAGE UPLOAD (not a URL input!) ── */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                                Image de la publicité *
                            </Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                            />

                            {imagePreview ? (
                                <div className="relative">
                                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-800 border border-white/10 shadow-lg">
                                        <img
                                            src={imagePreview}
                                            alt="Aperçu"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {/* Change / Remove buttons */}
                                    <div className="absolute top-2 right-2 flex gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 bg-black/60 backdrop-blur-sm border-white/20 text-white text-[10px] gap-1"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="w-3 h-3" /> Changer
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="destructive"
                                            className="h-7 w-7"
                                            onClick={removeImage}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                    {imageFile && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            📎 {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} Ko)
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full aspect-video rounded-xl border-2 border-dashed border-white/10 bg-slate-800/30 hover:bg-slate-800/60 transition-colors flex flex-col items-center justify-center gap-2 group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                        <Upload className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-slate-300">Cliquez pour choisir une image</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WebP • Max 5 Mo</p>
                                    </div>
                                </button>
                            )}
                        </div>

                        {/* Link URL */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                                Lien de destination (optionnel)
                            </Label>
                            <Input
                                type="url"
                                value={adForm.link_url}
                                onChange={e => setAdForm(p => ({ ...p, link_url: e.target.value }))}
                                placeholder="https://votresite.com/offre"
                            />
                        </div>

                        {/* Placement selector */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                Emplacement dans l'application
                            </Label>
                            <Select value={adForm.placement} onValueChange={v => setAdForm(p => ({ ...p, placement: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {AD_PLACEMENTS.map(p => (
                                        <SelectItem key={p.value} value={p.value}>
                                            <span className="flex items-center gap-2">
                                                <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                                                {p.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-500">
                                {getPlacementInfo(adForm.placement).description}
                            </p>
                        </div>

                        {/* Date range */}
                        <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                            <div className="space-y-2">
                                <Label className="text-xs flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Date début
                                </Label>
                                <Input
                                    type="date"
                                    value={adForm.start_date}
                                    onChange={e => setAdForm(p => ({ ...p, start_date: e.target.value }))}
                                    className="text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Date fin
                                </Label>
                                <Input
                                    type="date"
                                    value={adForm.end_date}
                                    onChange={e => setAdForm(p => ({ ...p, end_date: e.target.value }))}
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        {/* Order + Status */}
                        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                            <div className="space-y-2">
                                <Label>Ordre d'affichage</Label>
                                <Input
                                    type="number" min="0"
                                    value={adForm.display_order}
                                    onChange={e => setAdForm(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Statut</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <Switch
                                        checked={adForm.is_active}
                                        onCheckedChange={v => setAdForm(p => ({ ...p, is_active: v }))}
                                    />
                                    <span className="text-sm font-medium">
                                        {adForm.is_active ? '✅ Active' : '⏸️ Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAdDialogOpen(false)}>Annuler</Button>
                        <Button
                            onClick={saveAd}
                            disabled={!adForm.title || (!imageFile && !adForm.image_url) || adSaving}
                            className="bg-amber-600 hover:bg-amber-500 text-white gap-2"
                        >
                            {adSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {isUploading ? 'Upload...' : 'Enregistrement...'}
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    {editingAd ? 'Enregistrer' : 'Créer l\'annonce'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
