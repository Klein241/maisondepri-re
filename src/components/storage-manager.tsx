'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    HardDrive, CloudUpload, Trash2, RefreshCw, Loader2,
    Image as ImageIcon, Music, Video, FileText, CheckCircle2,
    AlertTriangle, Smartphone, ExternalLink, LogOut, Shield,
    Wifi, WifiOff, Database, ArrowUpCircle, Settings2, Mail,
    CloudOff, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getStorageStats,
    getGoogleDriveStatus,
    connectGoogleDrive,
    disconnectGoogleDrive,
    backupAllToDrive,
    getDriveUsage,
    cleanSyncedMedia,
    clearAllLocalMedia,
    formatFileSize,
    type GoogleDriveStatus,
} from '@/lib/media-storage';

interface StorageManagerProps {
    userId: string;
}

export function StorageManager({ userId }: StorageManagerProps) {
    // ═══ STATE ═══
    const [stats, setStats] = useState<{
        totalSize: number;
        counts: Record<string, number>;
        breakdown: Record<string, number>;
        unsyncedCount: number;
        unsyncedSize: number;
    } | null>(null);

    const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus>(getGoogleDriveStatus());
    const [driveUsage, setDriveUsage] = useState<{ fileCount: number; totalSize: number } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isBacking, setIsBacking] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    const [backupProgress, setBackupProgress] = useState<{
        done: number;
        total: number;
        current: string;
    } | null>(null);

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    // ═══ LOAD DATA ═══
    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        if (driveStatus.connected) {
            loadDriveUsage();
        }
    }, [driveStatus.connected]);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const s = await getStorageStats();
            setStats(s);
        } catch (e) {
            console.error('Erreur chargement stats:', e);
        }
        setIsLoading(false);
    };

    const loadDriveUsage = async () => {
        try {
            const usage = await getDriveUsage();
            if (usage) setDriveUsage(usage);
        } catch { /* ignore */ }
    };

    // ═══ GOOGLE DRIVE CONNECTION ═══
    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const status = await connectGoogleDrive();
            setDriveStatus(status);

            if (status.connected && status.email) {
                toast.success(`✅ Google Drive connecté`, {
                    description: `Compte : ${status.email}`,
                });

                // Lancer une sauvegarde automatique après connexion
                if (stats && stats.unsyncedCount > 0) {
                    toast.info(`📤 ${stats.unsyncedCount} fichier(s) en attente de sauvegarde`, {
                        description: 'La sauvegarde va commencer...',
                    });
                    setTimeout(() => handleBackup(), 2000);
                }
            }
        } catch (e: any) {
            toast.error('Connexion échouée', {
                description: e.message || 'Vérifiez votre connexion Internet',
            });
        }
        setIsConnecting(false);
    };

    const handleDisconnect = () => {
        disconnectGoogleDrive();
        setDriveStatus(getGoogleDriveStatus());
        setDriveUsage(null);
        toast.info('Google Drive déconnecté');
    };

    // ═══ BACKUP ═══
    const handleBackup = async () => {
        if (!driveStatus.connected) {
            toast.error('Connectez votre Google Drive d\'abord');
            return;
        }

        setIsBacking(true);
        setBackupProgress({ done: 0, total: 0, current: '' });

        try {
            const result = await backupAllToDrive((done, total, current) => {
                setBackupProgress({ done, total, current });
            });

            setBackupProgress(null);

            if (result.synced > 0) {
                toast.success(`☁️ ${result.synced} fichier(s) sauvegardé(s)`, {
                    description: `sur Google Drive (${driveStatus.email})`,
                });
            } else if (result.total === 0) {
                toast.info('✅ Tout est déjà synchronisé !');
            } else {
                toast.warning(`⚠️ ${result.failed} fichier(s) non sauvegardé(s)`);
            }

            // Rafraîchir les stats
            setDriveStatus(getGoogleDriveStatus());
            await loadStats();
            await loadDriveUsage();

        } catch (e: any) {
            setBackupProgress(null);
            toast.error('Erreur de sauvegarde: ' + e.message);
        }
        setIsBacking(false);
    };

    // ═══ CLEANUP ═══
    const handleCleanSynced = async () => {
        setIsCleaning(true);
        try {
            const deleted = await cleanSyncedMedia();
            if (deleted > 0) {
                toast.success(`🧹 ${deleted} fichier(s) supprimé(s) de l'appareil`, {
                    description: 'Copies sécurisées sur Google Drive',
                });
            } else {
                toast.info('Rien à nettoyer');
            }
            await loadStats();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsCleaning(false);
    };

    const handleClearAll = async () => {
        if (!confirmClear) {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 5000);
            return;
        }
        try {
            await clearAllLocalMedia();
            toast.success('Toutes les données locales ont été effacées');
            setConfirmClear(false);
            await loadStats();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    // ═══ UI HELPERS ═══
    const icons: Record<string, any> = {
        images: ImageIcon,
        audio: Music,
        video: Video,
        documents: FileText,
    };

    const labels: Record<string, string> = {
        images: 'Images',
        audio: 'Messages audio',
        video: 'Vidéos',
        documents: 'Documents',
    };

    const colors: Record<string, string> = {
        images: 'text-pink-400',
        audio: 'text-violet-400',
        video: 'text-blue-400',
        documents: 'text-amber-400',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                <span className="text-xs text-slate-400 ml-2">Chargement du stockage...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* ═══════ HEADER ═══════ */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <Database className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-bold text-white">Stockage & Sauvegarde</p>
                    <p className="text-[10px] text-slate-400">
                        {stats ? formatFileSize(stats.totalSize) : '0 o'} sur cet appareil
                    </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={loadStats}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* ═══════ STOCKAGE LOCAL ═══════ */}
            {stats && stats.totalSize > 0 && (
                <div className="space-y-2">
                    {/* Barre de progression visuelle */}
                    <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
                        {['images', 'audio', 'video', 'documents'].map(type => {
                            const pct = stats.totalSize > 0 ? (stats.breakdown[type] || 0) / stats.totalSize * 100 : 0;
                            const bgColors: Record<string, string> = {
                                images: 'bg-pink-500',
                                audio: 'bg-violet-500',
                                video: 'bg-blue-500',
                                documents: 'bg-amber-500',
                            };
                            return pct > 0 ? (
                                <div key={type} className={`${bgColors[type]} h-full transition-all`}
                                    style={{ width: `${pct}%` }} />
                            ) : null;
                        })}
                    </div>

                    {/* Détail par type */}
                    <div className="grid grid-cols-2 gap-2">
                        {['images', 'audio', 'video', 'documents'].map(type => {
                            const Icon = icons[type];
                            const count = stats.counts[type] || 0;
                            const size = stats.breakdown[type] || 0;
                            if (count === 0) return null;

                            return (
                                <div key={type} className="flex items-center gap-2 py-1">
                                    <Icon className={`h-3.5 w-3.5 ${colors[type]} shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-medium text-white truncate">{labels[type]}</p>
                                        <p className="text-[9px] text-slate-500">
                                            {count} • {formatFileSize(size)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {stats && stats.totalSize === 0 && (
                <div className="py-4 text-center">
                    <HardDrive className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Aucun média stocké sur cet appareil</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Les médias des conversations seront automatiquement sauvegardés ici
                    </p>
                </div>
            )}

            {/* ═══════ GOOGLE DRIVE ═══════ */}
            <Card className={`overflow-hidden ${driveStatus.connected
                ? 'bg-linear-to-br from-green-500/10 to-emerald-500/5 border-green-500/20'
                : 'bg-linear-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20'
                }`}>
                <CardContent className="p-4">
                    {driveStatus.connected ? (
                        /* ── CONNECTÉ ── */
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-white">Google Drive connecté</p>
                                        <Shield className="h-3 w-3 text-green-400" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        {driveStatus.email}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost" size="sm"
                                    className="text-slate-500 hover:text-red-400 h-7 px-2 text-[10px]"
                                    onClick={handleDisconnect}
                                >
                                    <LogOut className="h-3 w-3 mr-1" />
                                    Déconnecter
                                </Button>
                            </div>

                            {/* Stats Drive */}
                            <div className="flex items-center gap-4 text-[10px] text-slate-400">
                                {driveUsage && (
                                    <span className="flex items-center gap-1">
                                        <CloudUpload className="h-3 w-3 text-green-400" />
                                        {driveUsage.fileCount} fichier(s) • {formatFileSize(driveUsage.totalSize)}
                                    </span>
                                )}
                                {driveStatus.lastSync && (
                                    <span className="flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                                        Sync : {new Date(driveStatus.lastSync).toLocaleDateString('fr-FR', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                )}
                            </div>

                            {/* Fichiers en attente */}
                            {stats && stats.unsyncedCount > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                    <ArrowUpCircle className="h-4 w-4 text-amber-400 shrink-0" />
                                    <p className="text-[10px] text-amber-300 flex-1">
                                        <span className="font-bold">{stats.unsyncedCount}</span> fichier(s) en attente
                                        ({formatFileSize(stats.unsyncedSize)})
                                    </p>
                                </div>
                            )}

                            {/* Progression backup */}
                            <AnimatePresence>
                                {backupProgress && backupProgress.total > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-1.5"
                                    >
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-400 truncate max-w-[60%]">
                                                {backupProgress.current || 'Sauvegarde...'}
                                            </span>
                                            <span className="text-emerald-400 font-medium">
                                                {backupProgress.done}/{backupProgress.total}
                                            </span>
                                        </div>
                                        <Progress
                                            value={(backupProgress.done / backupProgress.total) * 100}
                                            className="h-1.5"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Bouton sauvegarder */}
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white h-9 text-xs font-bold"
                                onClick={handleBackup}
                                disabled={isBacking || (stats?.unsyncedCount === 0)}
                            >
                                {isBacking ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Sauvegarde en cours...</>
                                ) : stats?.unsyncedCount === 0 ? (
                                    <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Tout est synchronisé</>
                                ) : (
                                    <><CloudUpload className="h-3.5 w-3.5 mr-1.5" /> Sauvegarder maintenant</>
                                )}
                            </Button>
                        </div>
                    ) : (
                        /* ── NON CONNECTÉ ── */
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <CloudOff className="h-5 w-5 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white">Sauvegarde Google Drive</p>
                                    <p className="text-[10px] text-slate-400">
                                        Protégez vos médias sur votre propre Google Drive
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-3 space-y-2">
                                <p className="text-[10px] text-slate-300 font-medium">
                                    En connectant votre Google Drive :
                                </p>
                                <div className="space-y-1.5">
                                    {[
                                        { icon: Shield, text: 'Vos médias sont sauvegardés automatiquement' },
                                        { icon: Smartphone, text: 'Changez de téléphone sans perdre vos données' },
                                        { icon: Zap, text: 'Utilisez votre propre espace Google (15 Go gratuits)' },
                                        { icon: WifiOff, text: 'Tout fonctionne hors-ligne après le 1er chargement' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[9px] text-slate-400">
                                            <item.icon className="h-3 w-3 text-blue-400 shrink-0" />
                                            <span>{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button
                                className="w-full h-11 bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs rounded-xl shadow-lg"
                                onClick={handleConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Connexion en cours...</>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Connecter avec Google
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════ PARAMÈTRES AVANCÉS ═══════ */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors w-full"
            >
                <Settings2 className="h-3 w-3" />
                <span>Paramètres avancés</span>
                <div className={`ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</div>
            </button>

            <AnimatePresence>
                {showAdvanced && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden"
                    >
                        {/* Libérer espace local */}
                        {driveStatus.connected && (
                            <Card className="bg-white/5 border-white/10">
                                <CardContent className="p-3 flex items-center gap-3">
                                    <Trash2 className="h-4 w-4 text-amber-400 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-[11px] font-medium text-white">Libérer espace appareil</p>
                                        <p className="text-[9px] text-slate-500">
                                            Supprime les fichiers déjà sauvegardés sur Google Drive
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost" size="sm"
                                        className="text-amber-400 hover:bg-amber-500/10 h-7 text-[10px]"
                                        onClick={handleCleanSynced}
                                        disabled={isCleaning}
                                    >
                                        {isCleaning ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Nettoyer'}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Tout effacer */}
                        <Card className="bg-red-500/5 border-red-500/10">
                            <CardContent className="p-3 flex items-center gap-3">
                                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-[11px] font-medium text-white">Effacer toutes les données locales</p>
                                    <p className="text-[9px] text-slate-500">
                                        Irréversible si pas de sauvegarde Google Drive
                                    </p>
                                </div>
                                <Button
                                    variant="ghost" size="sm"
                                    className={`h-7 text-[10px] ${confirmClear
                                        ? 'text-red-400 bg-red-500/20 animate-pulse'
                                        : 'text-red-400 hover:bg-red-500/10'
                                        }`}
                                    onClick={handleClearAll}
                                >
                                    {confirmClear ? 'Confirmer ?' : 'Effacer tout'}
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════ COMMENT ÇA MARCHE ═══════ */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                <p className="text-[10px] text-emerald-400 font-medium mb-1.5">💡 Comment ça marche ?</p>
                <ul className="text-[9px] text-slate-400 space-y-1 list-disc pl-3">
                    <li>Les médias sont stockés sur votre appareil, comme WhatsApp</li>
                    <li>Google Drive sert de sauvegarde sur votre propre espace (15 Go gratuits)</li>
                    <li>Changez de téléphone ? Reconnectez votre Google et récupérez tout</li>
                    <li>Tout fonctionne hors-ligne après le premier chargement</li>
                </ul>
            </div>
        </div>
    );
}
