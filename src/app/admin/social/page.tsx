'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Radio,
    Youtube,
    Facebook,
    Plus,
    Trash2,
    Edit,
    ExternalLink,
    Loader2,
    Save,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface SocialLink {
    id: string;
    platform: string;
    title: string;
    url: string;
    embed_code: string | null;
    is_active: boolean;
    sort_order: number;
}

export default function SocialPage() {
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [liveStreamUrl, setLiveStreamUrl] = useState('');
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<SocialLink | null>(null);
    const [newLink, setNewLink] = useState({
        platform: 'youtube',
        title: '',
        url: '',
        embed_code: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load live settings
            const { data: settings } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['live_stream_active', 'live_stream_url']);

            if (settings) {
                settings.forEach(s => {
                    if (s.key === 'live_stream_active') setIsLiveActive(s.value === 'true');
                    if (s.key === 'live_stream_url') setLiveStreamUrl(s.value || '');
                });
            }

            // Load social links
            const { data: links } = await supabase
                .from('social_links')
                .select('*')
                .order('sort_order');

            if (links) setSocialLinks(links);
        } catch (e) {
            console.error('Error loading data:', e);
        }
        setIsLoading(false);
    };

    const saveLiveSettings = async () => {
        setIsSaving(true);
        try {
            await supabase.from('app_settings').upsert([
                { key: 'live_stream_active', value: isLiveActive.toString() },
                { key: 'live_stream_url', value: liveStreamUrl }
            ], { onConflict: 'key' });

            toast.success('Paramètres du live enregistrés!');
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleAddLink = async () => {
        if (!newLink.title.trim() || !newLink.url.trim()) {
            toast.error('Titre et URL requis');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase.from('social_links').insert({
                platform: newLink.platform,
                title: newLink.title.trim(),
                url: newLink.url.trim(),
                embed_code: newLink.embed_code.trim() || null,
                is_active: true,
                sort_order: socialLinks.length
            });

            if (error) throw error;

            toast.success('Lien ajouté!');
            setIsAddDialogOpen(false);
            setNewLink({ platform: 'youtube', title: '', url: '', embed_code: '' });
            loadData();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleUpdateLink = async () => {
        if (!editingLink) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('social_links')
                .update({
                    platform: editingLink.platform,
                    title: editingLink.title,
                    url: editingLink.url,
                    embed_code: editingLink.embed_code,
                    is_active: editingLink.is_active
                })
                .eq('id', editingLink.id);

            if (error) throw error;

            toast.success('Lien mis à jour!');
            setEditingLink(null);
            loadData();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleDeleteLink = async (id: string) => {
        if (!confirm('Supprimer ce lien?')) return;

        try {
            await supabase.from('social_links').delete().eq('id', id);
            toast.success('Lien supprimé');
            loadData();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const toggleLinkActive = async (link: SocialLink) => {
        try {
            await supabase
                .from('social_links')
                .update({ is_active: !link.is_active })
                .eq('id', link.id);
            loadData();
        } catch (e) {
            toast.error('Erreur');
        }
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />;
            case 'facebook': return <Facebook className="h-4 w-4 text-blue-500" />;
            case 'tiktok': return <span className="text-sm font-bold text-pink-500">TT</span>;
            default: return <ExternalLink className="h-4 w-4" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        Live & Réseaux Sociaux
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Gérez vos diffusions en direct et liens vers les réseaux sociaux
                    </p>
                </div>
                <Button variant="outline" onClick={loadData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualiser
                </Button>
            </div>

            {/* Live Streaming Section */}
            <Card className="border-red-500/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-red-500" />
                        Diffusion en Direct
                    </CardTitle>
                    <CardDescription>
                        Configurez votre stream live qui apparaîtra sur l'accueil de l'application
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                        <div className="space-y-1">
                            <p className="font-medium">Stream en direct actif</p>
                            <p className="text-sm text-muted-foreground">
                                Affiche un bouton rouge clignotant "Nous sommes en direct" sur l'accueil
                            </p>
                        </div>
                        <Switch
                            checked={isLiveActive}
                            onCheckedChange={setIsLiveActive}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>URL du Stream (YouTube, Facebook Live, etc.)</Label>
                        <Input
                            placeholder="https://www.youtube.com/embed/..."
                            value={liveStreamUrl}
                            onChange={(e) => setLiveStreamUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Utilisez l'URL d'intégration (embed) pour YouTube: youtube.com/embed/VIDEO_ID
                        </p>
                    </div>

                    {liveStreamUrl && (
                        <div className="space-y-2">
                            <Label>Aperçu</Label>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                <iframe
                                    src={liveStreamUrl}
                                    className="w-full h-full"
                                    allowFullScreen
                                />
                            </div>
                        </div>
                    )}

                    <Button onClick={saveLiveSettings} disabled={isSaving} className="bg-red-600 hover:bg-red-500">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Enregistrer les paramètres Live
                    </Button>
                </CardContent>
            </Card>

            {/* Social Links Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Liens Réseaux Sociaux</CardTitle>
                        <CardDescription>
                            Ajoutez vos liens YouTube, Facebook, TikTok, etc.
                        </CardDescription>
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-500">
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nouveau lien social</DialogTitle>
                                <DialogDescription>
                                    Ajoutez un lien vers l'un de vos réseaux sociaux
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Plateforme</Label>
                                    <Select
                                        value={newLink.platform}
                                        onValueChange={(v) => setNewLink(p => ({ ...p, platform: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="youtube">YouTube</SelectItem>
                                            <SelectItem value="facebook">Facebook</SelectItem>
                                            <SelectItem value="tiktok">TikTok</SelectItem>
                                            <SelectItem value="instagram">Instagram</SelectItem>
                                            <SelectItem value="other">Autre</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Titre *</Label>
                                    <Input
                                        placeholder="Ex: Notre chaîne YouTube"
                                        value={newLink.title}
                                        onChange={(e) => setNewLink(p => ({ ...p, title: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>URL *</Label>
                                    <Input
                                        placeholder="https://..."
                                        value={newLink.url}
                                        onChange={(e) => setNewLink(p => ({ ...p, url: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Code d'intégration (optionnel)</Label>
                                    <Textarea
                                        placeholder="<iframe>...</iframe>"
                                        value={newLink.embed_code}
                                        onChange={(e) => setNewLink(p => ({ ...p, embed_code: e.target.value }))}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleAddLink} disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Ajouter
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plateforme</TableHead>
                                <TableHead>Titre</TableHead>
                                <TableHead>URL</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {socialLinks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Aucun lien social configuré
                                    </TableCell>
                                </TableRow>
                            ) : (
                                socialLinks.map((link) => (
                                    <TableRow key={link.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getPlatformIcon(link.platform)}
                                                <span className="capitalize">{link.platform}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{link.title}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                {link.url}
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={link.is_active ? "default" : "secondary"}
                                                className="cursor-pointer"
                                                onClick={() => toggleLinkActive(link)}
                                            >
                                                {link.is_active ? "Actif" : "Inactif"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingLink(link)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500"
                                                    onClick={() => handleDeleteLink(link.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Link Dialog */}
            <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifier le lien</DialogTitle>
                        <DialogDescription>
                            Modifiez les informations du lien social
                        </DialogDescription>
                    </DialogHeader>
                    {editingLink && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Plateforme</Label>
                                <Select
                                    value={editingLink.platform}
                                    onValueChange={(v) => setEditingLink(p => p ? { ...p, platform: v } : null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="youtube">YouTube</SelectItem>
                                        <SelectItem value="facebook">Facebook</SelectItem>
                                        <SelectItem value="tiktok">TikTok</SelectItem>
                                        <SelectItem value="instagram">Instagram</SelectItem>
                                        <SelectItem value="other">Autre</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Titre</Label>
                                <Input
                                    value={editingLink.title}
                                    onChange={(e) => setEditingLink(p => p ? { ...p, title: e.target.value } : null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>URL</Label>
                                <Input
                                    value={editingLink.url}
                                    onChange={(e) => setEditingLink(p => p ? { ...p, url: e.target.value } : null)}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingLink(null)}>
                            Annuler
                        </Button>
                        <Button onClick={handleUpdateLink} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
