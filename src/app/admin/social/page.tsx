'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Radio,
    Youtube,
    Facebook,
    Instagram,
    Tv,
    Monitor,
    Plus,
    Trash2,
    Edit,
    ExternalLink,
    Loader2,
    Save,
    RefreshCw,
    MessageSquare,
    Eye,
    Users,
    AlertTriangle,
    Play
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SocialLink {
    id: string;
    platform: string;
    title: string;
    url: string;
    embed_code: string | null;
    is_active: boolean;
    sort_order: number;
}

interface LiveComment {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profile?: { full_name: string | null; avatar_url: string | null };
}

const PLATFORM_OPTIONS = [
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500', hint: 'https://www.youtube.com/embed/VIDEO_ID' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500', hint: 'https://www.facebook.com/.../videos/...' },
    { id: 'tiktok', name: 'TikTok', icon: Tv, color: 'text-pink-500', hint: 'Collez le lien TikTok Live' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-purple-500', hint: 'Collez le lien Instagram Live' },
    { id: 'twitch', name: 'Twitch', icon: Monitor, color: 'text-violet-500', hint: 'https://player.twitch.tv/?channel=CHANNEL' },
    { id: 'other', name: 'Autre', icon: ExternalLink, color: 'text-gray-400', hint: "Collez l'URL d'intégration (embed)" },
];

export default function SocialPage() {
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [liveStreamUrl, setLiveStreamUrl] = useState('');
    const [liveStreamUrlBackup, setLiveStreamUrlBackup] = useState('');
    const [livePlatform, setLivePlatform] = useState('youtube');
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

    // Live comments management
    const [liveComments, setLiveComments] = useState<LiveComment[]>([]);
    const [showCommentsPanel, setShowCommentsPanel] = useState(false);
    const [liveStats, setLiveStats] = useState({ comments: 0, reactions: 0 });

    // Replay management
    const [replays, setReplays] = useState<any[]>([]);
    const [showReplayForm, setShowReplayForm] = useState(false);
    const [newReplayTitle, setNewReplayTitle] = useState('');
    const [newReplayUrl, setNewReplayUrl] = useState('');

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
                .in('key', ['live_stream_active', 'live_stream_url', 'live_stream_url_backup', 'live_platform']);

            if (settings) {
                settings.forEach(s => {
                    if (s.key === 'live_stream_active') setIsLiveActive(s.value === 'true');
                    if (s.key === 'live_stream_url') setLiveStreamUrl(s.value || '');
                    if (s.key === 'live_stream_url_backup') setLiveStreamUrlBackup(s.value || '');
                    if (s.key === 'live_platform') setLivePlatform(s.value || 'youtube');
                });
            }

            // Load social links
            const { data: links } = await supabase
                .from('social_links')
                .select('*')
                .order('sort_order');

            if (links) setSocialLinks(links);

            // Load live stats
            try {
                const { count: commentCount } = await supabase
                    .from('livestream_comments')
                    .select('*', { count: 'exact', head: true })
                    .eq('livestream_id', 'global-live');
                const { count: reactionCount } = await supabase
                    .from('livestream_reactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('livestream_id', 'global-live');
                setLiveStats({
                    comments: commentCount || 0,
                    reactions: reactionCount || 0,
                });
            } catch (e) { /* tables might not exist */ }

            // Load replays
            try {
                const { data: replayData } = await supabase
                    .from('live_replays')
                    .select('*')
                    .order('recorded_at', { ascending: false });
                if (replayData) setReplays(replayData);
            } catch (e) { /* table might not exist */ }
        } catch (e) {
            console.error('Error loading data:', e);
        }
        setIsLoading(false);
    };

    // Load live comments for admin moderation
    const loadLiveComments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('livestream_comments')
                .select('*')
                .eq('livestream_id', 'global-live')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error || !data) return;

            const userIds = [...new Set(data.map(c => c.user_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds.length > 0 ? userIds : ['none']);

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            setLiveComments(data.map(c => ({
                ...c,
                profile: profileMap.get(c.user_id) || { full_name: null, avatar_url: null }
            })));
        } catch (e) {
            // Table might not exist
        }
    }, []);

    useEffect(() => {
        if (showCommentsPanel) {
            loadLiveComments();
            // Real-time
            const channel = supabase
                .channel('admin-live-comments')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'livestream_comments',
                    filter: 'livestream_id=eq.global-live'
                }, () => loadLiveComments())
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [showCommentsPanel, loadLiveComments]);

    const convertToEmbed = (url: string, platform: string): string => {
        try {
            const u = new URL(url.trim());

            // YouTube: extract video ID and use low-latency embed params
            if (platform === 'youtube') {
                let videoId = '';
                if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
                    videoId = u.searchParams.get('v')!;
                } else if (u.hostname === 'youtu.be') {
                    videoId = u.pathname.slice(1);
                } else if (u.pathname.includes('/embed/')) {
                    videoId = u.pathname.split('/embed/')[1]?.split('?')[0] || '';
                } else if (u.pathname.includes('/live/')) {
                    videoId = u.pathname.split('/live/')[1]?.split('?')[0] || '';
                }
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&playsinline=1&modestbranding=1`;
                }
            }

            // Facebook: use plugins/video.php with proper params for sound
            if (platform === 'facebook') {
                // If already an embed URL, return as-is
                if (u.pathname.includes('plugins/video.php')) return url.trim();
                return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.trim())}&width=500&show_text=false&autoplay=true&allowfullscreen=true&muted=false`;
            }

            // Twitch: convert channel URL to embed
            if (platform === 'twitch') {
                const channel = u.pathname.split('/').filter(Boolean)[0];
                if (channel && !u.pathname.includes('player.twitch.tv')) {
                    const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'maisondepriere.netlify.app';
                    return `https://player.twitch.tv/?channel=${channel}&parent=${parentDomain}&muted=false&autoplay=true`;
                }
            }
        } catch (e) { /* not a valid URL, return as-is */ }
        return url.trim();
    };

    const saveLiveSettings = async () => {
        setIsSaving(true);
        try {
            const embedUrl = convertToEmbed(liveStreamUrl, livePlatform);
            // Auto-detect backup platform (try youtube first, then other)
            let backupPlatform = 'youtube';
            try {
                const bu = new URL(liveStreamUrlBackup.trim());
                if (bu.hostname.includes('youtube') || bu.hostname === 'youtu.be') backupPlatform = 'youtube';
                else if (bu.hostname.includes('facebook')) backupPlatform = 'facebook';
                else if (bu.hostname.includes('twitch')) backupPlatform = 'twitch';
            } catch (e) { }
            const embedUrlBackup = liveStreamUrlBackup.trim() ? convertToEmbed(liveStreamUrlBackup.trim(), backupPlatform) : '';

            await supabase.from('app_settings').upsert([
                { key: 'live_stream_active', value: isLiveActive.toString() },
                { key: 'live_stream_url', value: embedUrl },
                { key: 'live_stream_url_backup', value: embedUrlBackup },
                { key: 'live_platform', value: livePlatform },
            ], { onConflict: 'key' });

            setLiveStreamUrl(embedUrl);
            setLiveStreamUrlBackup(embedUrlBackup);
            toast.success('🔴 Paramètres du live enregistrés!');
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleAddReplay = async () => {
        if (!newReplayTitle.trim() || !newReplayUrl.trim()) return;
        setIsSaving(true);
        try {
            // Auto-detect platform
            let replayPlatform = 'other';
            try {
                const u = new URL(newReplayUrl.trim());
                if (u.hostname.includes('youtube') || u.hostname === 'youtu.be') replayPlatform = 'youtube';
                else if (u.hostname.includes('facebook')) replayPlatform = 'facebook';
                else if (u.hostname.includes('twitch')) replayPlatform = 'twitch';
                else if (u.hostname.includes('tiktok')) replayPlatform = 'tiktok';
            } catch (e) { }

            const embedUrl = convertToEmbed(newReplayUrl.trim(), replayPlatform);

            const { error } = await supabase.from('live_replays').insert({
                title: newReplayTitle.trim(),
                platform: replayPlatform,
                embed_url: embedUrl,
            });

            if (error) throw error;
            toast.success('⏪ Replay ajouté!');
            setNewReplayTitle('');
            setNewReplayUrl('');
            setShowReplayForm(false);
            loadData();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleDeleteReplay = async (id: string) => {
        if (!confirm('Supprimer ce replay ?')) return;
        try {
            await supabase.from('live_replays').delete().eq('id', id);
            toast.success('Replay supprimé');
            setReplays(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            toast.error('Erreur');
        }
    };

    const handleDeleteComment = async (id: string) => {
        try {
            await supabase.from('livestream_comments').delete().eq('id', id);
            toast.success('Commentaire supprimé');
            loadLiveComments();
        } catch (e: any) {
            toast.error('Erreur');
        }
    };

    const handleClearAllComments = async () => {
        if (!confirm('Supprimer TOUS les commentaires du live ?')) return;
        try {
            await supabase.from('livestream_comments').delete().eq('livestream_id', 'global-live');
            toast.success('Tous les commentaires supprimés');
            setLiveComments([]);
        } catch (e: any) {
            toast.error('Erreur');
        }
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
        const p = PLATFORM_OPTIONS.find(o => o.id === platform);
        if (!p) return <ExternalLink className="h-4 w-4" />;
        const Icon = p.icon;
        return <Icon className={`h-4 w-4 ${p.color}`} />;
    };

    const selectedPlatformConfig = PLATFORM_OPTIONS.find(p => p.id === livePlatform) || PLATFORM_OPTIONS[0];

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
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Radio className="h-5 w-5 text-red-500" />
                                Diffusion en Direct
                                {isLiveActive && (
                                    <Badge className="bg-red-600/20 text-red-400 gap-1 text-[10px] animate-pulse">
                                        EN DIRECT
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Configurez votre stream live qui apparaîtra sur l'accueil de l'application
                            </CardDescription>
                        </div>
                        {/* Admin Comments Moderation Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                        >
                            <MessageSquare className="h-4 w-4" />
                            Commentaires
                            {liveComments.length > 0 && (
                                <Badge className="bg-red-500 text-white text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                    {liveComments.length}
                                </Badge>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Active Toggle */}
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

                    {/* Live Stats */}
                    {isLiveActive && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-2xl font-bold text-blue-400">{liveStats.comments}</p>
                                <p className="text-xs text-muted-foreground">Commentaires</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                <p className="text-2xl font-bold text-pink-400">{liveStats.reactions}</p>
                                <p className="text-xs text-muted-foreground">Réactions</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                <button
                                    className="text-xs text-green-400 hover:underline font-medium"
                                    onClick={() => {
                                        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/?live=1`;
                                        navigator.clipboard?.writeText(url);
                                        toast.success('🔗 Lien du live copié !');
                                    }}
                                >
                                    📋 Copier le lien
                                </button>
                                <p className="text-[10px] text-muted-foreground mt-1">Lien partageable</p>
                            </div>
                        </div>
                    )}

                    {/* Platform Selection */}
                    <div className="space-y-2">
                        <Label>Plateforme du Stream</Label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {PLATFORM_OPTIONS.map(p => {
                                const Icon = p.icon;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => setLivePlatform(p.id)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${livePlatform === p.id
                                            ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                                            : 'bg-muted/30 border-muted hover:bg-muted/50'
                                            }`}
                                    >
                                        <Icon className={`h-5 w-5 ${p.color}`} />
                                        <span className="text-[10px] font-bold">{p.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stream URL */}
                    <div className="space-y-2">
                        <Label>URL du Stream ({selectedPlatformConfig.name})</Label>
                        <Input
                            placeholder={selectedPlatformConfig.hint}
                            value={liveStreamUrl}
                            onChange={(e) => setLiveStreamUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            💡 Collez le lien de votre live ou l'URL d'intégration. La conversion embed est automatique pour YouTube et Facebook.
                        </p>
                    </div>

                    {/* Backup URL - for blocked platforms */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            🔄 URL de secours (obligatoire si la plateforme est bloquée)
                        </Label>
                        <Input
                            placeholder="Ex: lien YouTube si votre live principal est sur Facebook"
                            value={liveStreamUrlBackup}
                            onChange={(e) => setLiveStreamUrlBackup(e.target.value)}
                        />
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-300 font-medium mb-1">⚠️ Important : plateformes bloquées</p>
                            <p className="text-xs text-muted-foreground">
                                Si Facebook/YouTube/TikTok est bloqué dans le pays de vos utilisateurs, l'app basculera automatiquement sur cette URL.
                                <br />
                                <strong>Conseil :</strong> Utilisez <a href="https://restream.io" target="_blank" className="text-blue-400 underline">Restream.io</a> ou <a href="https://streamyard.com" target="_blank" className="text-blue-400 underline">StreamYard</a> pour streamer simultanément sur plusieurs plateformes.
                            </p>
                        </div>
                    </div>

                    {/* Preview */}
                    {liveStreamUrl && (
                        <div className="space-y-2">
                            <Label>Aperçu</Label>
                            <div className={`bg-black rounded-lg overflow-hidden border border-muted mx-auto ${livePlatform === 'facebook' || livePlatform === 'tiktok' || livePlatform === 'instagram' ? 'max-w-[300px]' : 'w-full'}`}
                                style={{ aspectRatio: ['facebook', 'tiktok', 'instagram'].includes(livePlatform) ? '9/16' : '16/9' }}
                            >
                                <iframe
                                    src={convertToEmbed(liveStreamUrl, livePlatform)}
                                    className="w-full h-full"
                                    allowFullScreen
                                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                                />
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <Button onClick={saveLiveSettings} disabled={isSaving} className="bg-red-600 hover:bg-red-500">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Enregistrer les paramètres Live
                    </Button>

                    {/* Comments Moderation Panel */}
                    {showCommentsPanel && (
                        <div className="border border-muted rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Commentaires du Live ({liveComments.length})
                                </h4>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={loadLiveComments}>
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Rafraîchir
                                    </Button>
                                    {liveComments.length > 0 && (
                                        <Button variant="destructive" size="sm" onClick={handleClearAllComments}>
                                            <Trash2 className="h-3 w-3 mr-1" />
                                            Tout supprimer
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <ScrollArea className="max-h-[400px]">
                                <div className="space-y-2">
                                    {liveComments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-6">
                                            Aucun commentaire pour le moment
                                        </p>
                                    ) : (
                                        liveComments.map(comment => (
                                            <div key={comment.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 group">
                                                <Avatar className="h-7 w-7 shrink-0">
                                                    <AvatarFallback className="text-[10px]">
                                                        {(comment.profile?.full_name || '?')[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs">
                                                            {comment.profile?.full_name || 'Utilisateur'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm break-words">{comment.content}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-500"
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ============ REPLAY SECTION ============ */}
            <Card className="border-purple-500/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Play className="h-5 w-5 text-purple-500" />
                                Replays / Lives passés
                            </CardTitle>
                            <CardDescription>
                                Ajoutez les enregistrements des lives passés pour que les fidèles puissent revoir
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowReplayForm(!showReplayForm)}>
                            <Plus className="h-4 w-4" />
                            Ajouter un replay
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add replay form */}
                    {showReplayForm && (
                        <div className="border border-purple-500/20 rounded-xl p-4 space-y-3 bg-purple-500/5">
                            <div className="space-y-2">
                                <Label>Titre du replay</Label>
                                <Input
                                    placeholder="Ex: Prière du dimanche 20 février"
                                    value={newReplayTitle}
                                    onChange={(e) => setNewReplayTitle(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>URL de la vidéo (YouTube, Facebook, etc.)</Label>
                                <Input
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={newReplayUrl}
                                    onChange={(e) => setNewReplayUrl(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">💡 Collez le lien YouTube/Facebook. La conversion embed est automatique.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleAddReplay}
                                    disabled={isSaving || !newReplayTitle.trim() || !newReplayUrl.trim()}
                                    className="bg-purple-600 hover:bg-purple-500"
                                >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Enregistrer le replay
                                </Button>
                                <Button variant="outline" onClick={() => setShowReplayForm(false)}>Annuler</Button>
                            </div>
                        </div>
                    )}

                    {/* Replays list */}
                    {replays.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            Aucun replay enregistré. Ajoutez vos lives passés pour que les fidèles puissent les revoir.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {replays.map(replay => (
                                <div key={replay.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border group">
                                    <div className="w-16 h-10 bg-black rounded overflow-hidden flex items-center justify-center shrink-0">
                                        <Play className="h-5 w-5 text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{replay.title}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {replay.platform} • {new Date(replay.recorded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100"
                                        onClick={() => handleDeleteReplay(replay.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
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
                                            <SelectItem value="twitch">Twitch</SelectItem>
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
                                        <SelectItem value="twitch">Twitch</SelectItem>
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
