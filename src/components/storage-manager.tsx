'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    HardDrive, CloudUpload, Trash2, RefreshCw, Loader2,
    Image as ImageIcon, Music, Video, FileText, CheckCircle2,
    AlertTriangle, Smartphone, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    getStorageStats,
    backupAllToGoogleDrive,
    cleanupSupabaseStorage,
    formatFileSize
} from '@/lib/media-storage';

interface StorageManagerProps {
    userId: string;
}

export function StorageManager({ userId }: StorageManagerProps) {
    const [stats, setStats] = useState<{
        totalSize: number;
        counts: Record<string, number>;
        breakdown: Record<string, number>;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBacking, setIsBacking] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
        setLastBackup(localStorage.getItem('last_gdrive_backup'));
    }, []);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const s = await getStorageStats();
            setStats(s);
        } catch (e) {
            console.error('Failed to load storage stats:', e);
        }
        setIsLoading(false);
    };

    const handleBackup = async () => {
        setIsBacking(true);
        try {
            const result = await backupAllToGoogleDrive();
            if (result.synced > 0) {
                toast.success(`☁️ ${result.synced} fichier(s) sauvegardé(s) sur Google Drive`);
                const now = new Date().toISOString();
                localStorage.setItem('last_gdrive_backup', now);
                setLastBackup(now);
            } else if (result.failed > 0) {
                toast.error(`Échec: ${result.failed} fichier(s) non sauvegardé(s)`);
            } else {
                toast.info('Tout est déjà synchronisé ✅');
            }
        } catch (e: any) {
            toast.error('Erreur backup: ' + e.message);
        }
        setIsBacking(false);
    };

    const handleCleanup = async () => {
        setIsCleaning(true);
        try {
            const deleted = await cleanupSupabaseStorage(userId, 30);
            if (deleted > 0) {
                toast.success(`🧹 ${deleted} fichier(s) nettoyé(s) du cloud (copies locales conservées)`);
            } else {
                toast.info('Rien à nettoyer');
            }
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsCleaning(false);
    };

    const icons: Record<string, any> = {
        images: ImageIcon,
        audio: Music,
        video: Video,
        documents: FileText,
    };

    const labels: Record<string, string> = {
        images: 'Images',
        audio: 'Audio',
        video: 'Vidéos',
        documents: 'Documents',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Total usage */}
            <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white">Stockage local</p>
                    <p className="text-xs text-slate-400">
                        {stats ? formatFileSize(stats.totalSize) : '0 o'} sur cet appareil
                    </p>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto text-slate-400" onClick={loadStats}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Breakdown by type */}
            {stats && (
                <div className="grid grid-cols-2 gap-2">
                    {['images', 'audio', 'video', 'documents'].map(type => {
                        const Icon = icons[type];
                        const count = stats.counts[type] || 0;
                        const size = stats.breakdown[type] || 0;

                        return (
                            <Card key={type} className="bg-white/5 border-white/10">
                                <CardContent className="p-3 flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-white">{labels[type]}</p>
                                        <p className="text-[9px] text-slate-500">
                                            {count} fichier(s) • {formatFileSize(size)}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Google Drive backup */}
            <Card className="bg-linear-to-br from-blue-500/10 to-purple-500/5 border-blue-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CloudUpload className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-semibold text-white">Sauvegarde Google Drive</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-3">
                        Comme WhatsApp, vos médias sont sauvegardés sur votre propre Google Drive.
                        Les fichiers restent aussi sur votre appareil pour un accès hors-ligne.
                    </p>
                    {lastBackup && (
                        <p className="text-[9px] text-green-400 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Dernière sauvegarde: {new Date(lastBackup).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    )}
                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs"
                        onClick={handleBackup}
                        disabled={isBacking}
                    >
                        {isBacking ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Sauvegarde en cours...</>
                        ) : (
                            <><CloudUpload className="h-3.5 w-3.5 mr-1" /> Sauvegarder maintenant</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Cleanup */}
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Trash2 className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-semibold text-white">Libérer espace cloud</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-3">
                        Supprime les fichiers de plus de 30 jours du stockage Supabase.
                        Vos copies locales et Google Drive ne sont pas affectées.
                    </p>
                    <Button
                        variant="outline"
                        className="w-full border-amber-500/20 text-amber-400 hover:bg-amber-500/10 h-9 text-xs"
                        onClick={handleCleanup}
                        disabled={isCleaning}
                    >
                        {isCleaning ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Nettoyage...</>
                        ) : (
                            <><Trash2 className="h-3.5 w-3.5 mr-1" /> Nettoyer le cloud</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Info */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                <p className="text-[10px] text-emerald-400 font-medium mb-1">💡 Comment ça marche ?</p>
                <ul className="text-[9px] text-slate-400 space-y-0.5 list-disc pl-3">
                    <li>Les médias sont stockés sur votre appareil (comme WhatsApp)</li>
                    <li>Google Drive sert de sauvegarde (votre propre espace)</li>
                    <li>Le cloud Supabase n'est qu'un relais temporaire</li>
                    <li>Tout fonctionne hors-ligne après le premier chargement</li>
                </ul>
            </div>
        </div>
    );
}
