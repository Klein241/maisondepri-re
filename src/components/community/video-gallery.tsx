'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Play, ArrowLeft, Loader2, RefreshCw, Eye, Video, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface VideoItem {
    id: string;
    title: string;
    video_url: string;
    thumbnail_url: string | null;
    description: string | null;
    duration: number | null;
    platform: string;
    category: string;
    view_count: number;
}

interface VideoGalleryProps {
    proxyUrl: string;
    pageUrl?: string;
    onClose: () => void;
}

function formatDuration(seconds: number | null) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const CATEGORY_LABELS: Record<string, string> = {
    predication: '🎤 Prédication',
    louange: '🎵 Louange',
    temoignage: '💬 Témoignage',
    enseignement: '📖 Enseignement',
    priere: '🙏 Prière',
    autre: '📺 Autre',
};

export function VideoGallery({ proxyUrl, onClose }: VideoGalleryProps) {
    const router = useRouter();
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);

    const loadVideos = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: err } = await supabase
                .from('video_gallery')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (err) throw err;
            setVideos(data || []);
        } catch (e: any) {
            console.error('Video gallery error:', e);
            setError(e.message || 'Erreur de chargement');
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadVideos(); }, [loadVideos]);

    const openVideo = (video: VideoItem) => {
        // Navigate to dedicated page with URL, comments, reactions, share
        onClose(); // close the gallery overlay first
        router.push(`/video/${video.id}`);
    };

    const shareVideo = async (e: React.MouseEvent, video: VideoItem) => {
        e.stopPropagation();
        const url = `${window.location.origin}/video/${video.id}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: video.title, url });
                return;
            } catch (err) { }
        }
        await navigator.clipboard.writeText(url);
        toast.success('🔗 Lien copié !');
    };

    const categories = ['all', ...new Set(videos.map(v => v.category))];
    const filteredVideos = activeCategory === 'all' ? videos : videos.filter(v => v.category === activeCategory);

    // Gallery grid view
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#050709] to-[#0a0d14]"
        >
            <header className="flex items-center gap-2 px-3 pt-10 pb-2 border-b border-white/5 shrink-0">
                <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-9 w-9">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-black text-sm">📺 Vidéos & Prédications</h1>
                    <p className="text-[10px] text-slate-500">{videos.length} vidéo{videos.length > 1 ? 's' : ''} • Sans VPN</p>
                </div>
                <Button variant="ghost" size="icon" onClick={loadVideos} className="h-8 w-8">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
            </header>

            {/* Category tabs */}
            {categories.length > 2 && (
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all",
                                activeCategory === cat
                                    ? "bg-purple-600 text-white"
                                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            )}
                        >
                            {cat === 'all' ? '📺 Tout' : CATEGORY_LABELS[cat] || cat}
                        </button>
                    ))}
                </div>
            )}

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                    {loading ? (
                        <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
                            <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
                            <p className="text-sm">Chargement des vidéos...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-sm text-red-400 mb-2">❌ {error}</p>
                            <Button variant="outline" size="sm" onClick={loadVideos}>Réessayer</Button>
                        </div>
                    ) : filteredVideos.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold">Aucune vidéo disponible</p>
                            <p className="text-[10px] text-slate-600 mt-1">Les vidéos seront ajoutées par l'administrateur</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {filteredVideos.map(video => (
                                <motion.button
                                    key={video.id}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => openVideo(video)}
                                    className="relative rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700/50 hover:border-purple-500/30 transition-all text-left"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-full aspect-video bg-gradient-to-br from-purple-900/30 to-indigo-900/30 flex items-center justify-center">
                                        {video.thumbnail_url ? (
                                            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <Play className="h-8 w-8 text-purple-300/50 fill-purple-300/20" />
                                        )}
                                        {/* Play overlay */}
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                <Play className="h-5 w-5 text-white fill-white" />
                                            </div>
                                        </div>
                                        {/* Duration badge */}
                                        {video.duration && (
                                            <Badge className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 py-0">
                                                {formatDuration(video.duration)}
                                            </Badge>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div className="p-2">
                                        <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">{video.title}</p>
                                        <div className="flex items-center justify-between gap-1 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                {video.view_count > 0 && (
                                                    <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                                        <Eye className="h-2.5 w-2.5" /> {video.view_count > 1000 ? `${(video.view_count / 1000).toFixed(1)}k` : video.view_count}
                                                    </span>
                                                )}
                                                <span className="text-[8px] text-purple-400/60">
                                                    {CATEGORY_LABELS[video.category]?.split(' ')[0] || '📺'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => shareVideo(e, video)}
                                                className="p-1 text-slate-500 hover:text-white transition-colors"
                                                title="Partager"
                                            >
                                                <Share2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </motion.div>
    );
}

export default VideoGallery;
