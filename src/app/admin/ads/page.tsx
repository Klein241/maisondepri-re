'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, LayoutTemplate, Loader2, MapPin, BookOpen, Home, ShoppingBag, Search, PanelRight, BookOpenCheck } from 'lucide-react';
import { toast } from 'sonner';

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
        label: '🏠 Accueil (Flux)',
        description: 'Bannière entre les sections de l\'accueil',
        icon: Home,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
        value: 'marketplace',
        label: '🛒 Marketplace',
        description: 'Produit sponsorisé en haut de la boutique',
        icon: ShoppingBag,
        color: 'text-orange-400',
        bg: 'bg-orange-500/10 border-orange-500/20',
    },
    {
        value: 'reader_end',
        label: '📕 Fin de lecture',
        description: 'S\'affiche quand le lecteur ferme un livre',
        icon: BookOpenCheck,
        color: 'text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/20',
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
}

export default function AdminAdsPage() {
    const [ads, setAds] = useState<LibraryAd[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
    const [editingAd, setEditingAd] = useState<LibraryAd | null>(null);
    const [adForm, setAdForm] = useState({
        title: '', description: '', image_url: '', link_url: '',
        is_active: true, display_order: 0, placement: 'book_detail',
    });
    const [adSaving, setAdSaving] = useState(false);
    const [filterPlacement, setFilterPlacement] = useState<string>('all');

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

    const saveAd = async () => {
        setAdSaving(true);
        try {
            if (editingAd) {
                await supabase.from('library_ads').update(adForm).eq('id', editingAd.id);
            } else {
                await supabase.from('library_ads').insert(adForm);
            }
            toast.success(editingAd ? 'Publicité modifiée' : 'Publicité créée');
            setIsAdDialogOpen(false);
            setEditingAd(null);
            fetchAds();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        } finally {
            setAdSaving(false);
        }
    };

    const deleteAd = async (id: string) => {
        if (!confirm('Supprimer cette publicité ?')) return;
        await supabase.from('library_ads').delete().eq('id', id);
        toast.success('Publicité supprimée');
        fetchAds();
    };

    const openAdForm = (ad?: LibraryAd) => {
        if (ad) {
            setEditingAd(ad);
            setAdForm({
                title: ad.title, description: ad.description, image_url: ad.image_url,
                link_url: ad.link_url, is_active: ad.is_active,
                display_order: ad.display_order, placement: ad.placement || 'book_detail',
            });
        } else {
            setEditingAd(null);
            setAdForm({
                title: '', description: '', image_url: '', link_url: '',
                is_active: true, display_order: ads.length, placement: 'book_detail',
            });
        }
        setIsAdDialogOpen(true);
    };

    const getPlacementInfo = (placement: string) =>
        AD_PLACEMENTS.find(p => p.value === placement) || AD_PLACEMENTS[0];

    const filteredAds = filterPlacement === 'all'
        ? ads
        : ads.filter(a => a.placement === filterPlacement);

    const totalClicks = ads.reduce((s, a) => s + (a.click_count || 0), 0);
    const totalViews = ads.reduce((s, a) => s + (a.view_count || 0), 0);
    const activeCount = ads.filter(a => a.is_active).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <LayoutTemplate className="w-6 h-6 text-amber-500" />
                    Espace Publicitaire
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Gérez les publicités affichées à travers toute l'application.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-400">{ads.length}</p>
                    <p className="text-xs text-muted-foreground">Total annonces</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">Actives</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{totalViews}</p>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-400">{totalClicks}</p>
                    <p className="text-xs text-muted-foreground">Clics</p>
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
                        6 zones stratégiques dans l'application — cliquez pour filtrer
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {AD_PLACEMENTS.map(p => {
                            const count = ads.filter(a => a.placement === p.value).length;
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
                                    <Badge variant="outline" className="mt-2 text-[9px]">
                                        {count} annonce{count !== 1 ? 's' : ''}
                                    </Badge>
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
                            <Plus className="w-4 h-4 mr-1" /> Nouvelle pub
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
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredAds.map(ad => {
                                const pInfo = getPlacementInfo(ad.placement);
                                return (
                                    <div key={ad.id} className={`rounded-xl border p-4 transition-all shadow-sm ${ad.is_active ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-800/50 border-white/5 opacity-60'}`}>
                                        {ad.image_url && (
                                            <div className="aspect-3/4 rounded-lg overflow-hidden mb-3 bg-slate-800 shadow-inner">
                                                <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <p className="text-sm font-semibold text-white truncate" title={ad.title}>{ad.title}</p>

                                        {/* Placement badge */}
                                        <div className="flex items-center gap-1 mt-1">
                                            <pInfo.icon className={`w-3 h-3 ${pInfo.color}`} />
                                            <span className="text-[10px] text-slate-400">{pInfo.label}</span>
                                        </div>

                                        <div className="flex items-center justify-between mt-4">
                                            <div className="bg-black/30 px-2 py-1 rounded text-[10px] text-amber-300 font-mono">
                                                {ad.click_count} CLICS
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/5 hover:bg-white/10" onClick={() => openAdForm(ad)}>
                                                    <Edit className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 bg-red-500/5 hover:bg-red-500/10 hover:text-red-300" onClick={() => deleteAd(ad.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ad Dialog */}
            <Dialog open={isAdDialogOpen} onOpenChange={setIsAdDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingAd ? 'Modifier la publicité' : 'Nouvelle publicité'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Titre *</Label>
                            <Input value={adForm.title} onChange={e => setAdForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Masterclass Théologie" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={adForm.description} onChange={e => setAdForm(p => ({ ...p, description: e.target.value }))} placeholder="Sous-titre de l'annonce" />
                        </div>
                        <div className="space-y-2">
                            <Label>URL de l'image (portrait recommandé) *</Label>
                            <Input value={adForm.image_url} onChange={e => setAdForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                            {adForm.image_url && (
                                <div className="mt-2 w-24 h-32 rounded-lg overflow-hidden bg-slate-800 border border-white/10 shadow-lg">
                                    <img src={adForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Lien de destination</Label>
                            <Input type="url" value={adForm.link_url} onChange={e => setAdForm(p => ({ ...p, link_url: e.target.value }))} placeholder="https://votresite.com" />
                        </div>

                        {/* Placement selector */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1">
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

                        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 mt-2">
                            <div className="space-y-2">
                                <Label>Ordre d'affichage</Label>
                                <Input type="number" min="0" value={adForm.display_order} onChange={e => setAdForm(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Statut</Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <Switch checked={adForm.is_active} onCheckedChange={v => setAdForm(p => ({ ...p, is_active: v }))} />
                                    <span className="text-sm font-medium">{adForm.is_active ? '✅ Active' : '⏸️ Inactive'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAdDialogOpen(false)}>Annuler</Button>
                        <Button onClick={saveAd} disabled={!adForm.title || !adForm.image_url || adSaving} className="bg-amber-600 hover:bg-amber-500 text-white">
                            {adSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {editingAd ? 'Enregistrer' : 'Créer l\'annonce'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
