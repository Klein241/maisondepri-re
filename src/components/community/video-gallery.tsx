'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, ArrowLeft, Loader2, RefreshCw, ExternalLink, Eye, Clock, X, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoItem {
    id: string;
    title: string;
    url: string;
    duration: number | null;
    thumbnail: string | null;
    timestamp: string | null;
    view_count: number | null;
}

interface VideoGalleryProps {
    proxyUrl: string;
    pageUrl: string;
    onClose: () => void;
}

function formatDuration(seconds: number | null) {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoGallery({ proxyUrl, pageUrl, onClose }: VideoGalleryProps) {
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadVideos = useCallback(async () => {
        if (!proxyUrl || !pageUrl) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${proxyUrl}/api/videos/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_url: pageUrl, admin_key: 'maison-de-priere-admin-2026' }),
            });
            const data = await res.json();
            if (data.videos) {
                setVideos(data.videos);
            } else {
                setError(data.error || 'Erreur de chargement');
            }
        } catch (e: any) {
            setError('Impossible de contacter le proxy: ' + e.message);
        }
        setLoading(false);
    }, [proxyUrl, pageUrl]);

    useEffect(() => { loadVideos(); }, [loadVideos]);

    const playVideo = async (video: VideoItem) => {
        setSelectedVideo(video);
        setLoadingVideo(true);
        setVideoStreamUrl(null);

        try {
            // First try to extract direct URL
            const res = await fetch(`${proxyUrl}/api/videos/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_url: video.url }),
            });
            const data = await res.json();

            if (data.direct_url) {
                // Try direct playback first
                setVideoStreamUrl(data.direct_url);
            } else {
                // Fallback: use proxy stream
                setVideoStreamUrl(`${proxyUrl}/api/videos/stream?url=${encodeURIComponent(video.url)}`);
            }
        } catch (e) {
            // Fallback: use proxy stream
            setVideoStreamUrl(`${proxyUrl}/api/videos/stream?url=${encodeURIComponent(video.url)}`);
        }
        setLoadingVideo(false);
    };

    // Player view
    if (selectedVideo) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-b from-[#050709] to-[#0a0d14]"
            >
                <header className="flex items-center gap-2 px-3 pt-10 pb-2 border-b border-white/5 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedVideo(null)} className="shrink-0 h-9 w-9">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-sm truncate">{selectedVideo.title}</h1>
                        {selectedVideo.view_count && (
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Eye className="h-2.5 w-2.5" /> {selectedVideo.view_count.toLocaleString('fr-FR')} vues
                            </p>
                        )}
                    </div>
                </header>
                <div className="flex-1 flex items-center justify-center bg-black p-2">
                    {loadingVideo ? (
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <Loader2 className="h-10 w-10 animate-spin" />
                            <p className="text-sm">Extraction de la vidéo...</p>
                        </div>
                    ) : videoStreamUrl ? (
                        <video
                            src={videoStreamUrl}
                            controls
                            autoPlay
                            playsInline
                            className="w-full max-h-[75vh] rounded-lg"
                            onError={() => {
                                // If direct URL fails, try proxy stream
                                if (videoStreamUrl && !videoStreamUrl.includes('/api/videos/stream')) {
                                    toast.info('Basculement vers le proxy...');
                                    setVideoStreamUrl(`${proxyUrl}/api/videos/stream?url=${encodeURIComponent(selectedVideo.url)}`);
                                }
                            }}
                        />
                    ) : (
                        <p className="text-slate-500">Impossible de charger la vidéo</p>
                    )}
                </div>
            </motion.div>
        );
    }

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
                    <h1 className="font-black text-sm">📺 Vidéos</h1>
                    <p className="text-[10px] text-slate-500">{videos.length} vidéo{videos.length > 1 ? 's' : ''} disponible{videos.length > 1 ? 's' : ''}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={loadVideos} className="h-8 w-8">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                    {loading ? (
                        <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
                            <Loader2 className="h-10 w-10 animate-spin" />
                            <p className="text-sm">Chargement des vidéos...</p>
                            <p className="text-[10px] text-slate-600">Extraction depuis la page Facebook via le proxy</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-sm text-red-400 mb-2">❌ {error}</p>
                            <Button variant="outline" size="sm" onClick={loadVideos}>Réessayer</Button>
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucune vidéo trouvée</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {videos.map(video => (
                                <motion.button
                                    key={video.id}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => playVideo(video)}
                                    className="relative rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700/50 hover:border-purple-500/30 transition-all text-left"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-full aspect-video bg-gradient-to-br from-purple-900/30 to-indigo-900/30 flex items-center justify-center">
                                        {video.thumbnail ? (
                                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <Play className="h-8 w-8 text-purple-300/50 fill-purple-300/20" />
                                        )}
                                        {/* Play overlay */}
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
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
                                        <div className="flex items-center gap-2 mt-1">
                                            {video.view_count && (
                                                <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                                    <Eye className="h-2.5 w-2.5" /> {video.view_count > 1000 ? `${(video.view_count / 1000).toFixed(1)}k` : video.view_count}
                                                </span>
                                            )}
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
