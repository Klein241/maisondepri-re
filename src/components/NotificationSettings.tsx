'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Bell, BellOff, Smartphone, Monitor, Heart,
    MessageSquare, Users, Sparkles, Clock, AtSign,
    UserPlus, Settings, ChevronRight, ArrowLeft,
    Loader2, Check, Save,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

/**
 * ══════════════════════════════════════════════════════════
 * NotificationSettings — Per-type Toggle Screen
 * ══════════════════════════════════════════════════════════
 *
 * Fetches preferences from Cloudflare Worker (or Supabase fallback),
 * renders toggles organized by category, saves on change.
 */

interface Preference {
    in_app: boolean;
    push: boolean;
}

type PreferenceMap = Record<string, Preference>;

interface SettingItem {
    key: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    category: string;
}

const SETTINGS_CONFIG: SettingItem[] = [
    // 🙏 Prayer
    {
        key: 'prayer_prayed',
        label: 'Prière reçue',
        description: 'Quelqu\'un a prié pour votre demande',
        icon: <Heart className="h-4 w-4 text-pink-400" />,
        category: '🙏 Prière',
    },
    {
        key: 'friend_prayed',
        label: 'Ami a prié',
        description: 'Un ami a prié pour un sujet',
        icon: <Heart className="h-4 w-4 text-pink-300" />,
        category: '🙏 Prière',
    },
    {
        key: 'new_prayer_published',
        label: 'Nouvelle demande',
        description: 'Nouvelle demande de prière publiée',
        icon: <Sparkles className="h-4 w-4 text-amber-400" />,
        category: '🙏 Prière',
    },
    {
        key: 'prayer_comment',
        label: 'Commentaire',
        description: 'Quelqu\'un a commenté votre demande',
        icon: <MessageSquare className="h-4 w-4 text-amber-300" />,
        category: '🙏 Prière',
    },
    {
        key: 'prayer_no_response',
        label: 'Rappel sans réponse',
        description: 'Votre demande n\'a pas reçu de prière (48h)',
        icon: <Clock className="h-4 w-4 text-slate-400" />,
        category: '🙏 Prière',
    },

    // 👥 Groups
    {
        key: 'group_access_request',
        label: 'Demande d\'accès',
        description: 'Quelqu\'un veut rejoindre votre groupe',
        icon: <Users className="h-4 w-4 text-purple-400" />,
        category: '👥 Groupes',
    },
    {
        key: 'group_access_approved',
        label: 'Accès approuvé',
        description: 'Votre demande d\'accès a été approuvée',
        icon: <Check className="h-4 w-4 text-green-400" />,
        category: '👥 Groupes',
    },
    {
        key: 'group_new_message',
        label: 'Message de groupe',
        description: 'Nouveau message dans un groupe',
        icon: <MessageSquare className="h-4 w-4 text-blue-400" />,
        category: '👥 Groupes',
    },
    {
        key: 'admin_new_group',
        label: 'Groupe officiel',
        description: 'Un administrateur a créé un groupe',
        icon: <Sparkles className="h-4 w-4 text-indigo-400" />,
        category: '👥 Groupes',
    },
    {
        key: 'group_invitation',
        label: 'Invitation',
        description: 'Vous êtes invité à rejoindre un groupe',
        icon: <UserPlus className="h-4 w-4 text-purple-300" />,
        category: '👥 Groupes',
    },
    {
        key: 'group_mention',
        label: 'Mention (@)',
        description: 'Quelqu\'un vous a mentionné dans un groupe',
        icon: <AtSign className="h-4 w-4 text-cyan-400" />,
        category: '👥 Groupes',
    },

    // 💬 Social
    {
        key: 'dm_new_message',
        label: 'Message direct',
        description: 'Nouveau message privé reçu',
        icon: <MessageSquare className="h-4 w-4 text-blue-500" />,
        category: '💬 Social',
    },
    {
        key: 'friend_request_received',
        label: 'Demande d\'ami',
        description: 'Quelqu\'un vous envoie une demande d\'ami',
        icon: <UserPlus className="h-4 w-4 text-green-400" />,
        category: '💬 Social',
    },
    {
        key: 'friend_request_accepted',
        label: 'Ami accepté',
        description: 'Votre demande d\'ami a été acceptée',
        icon: <Users className="h-4 w-4 text-green-300" />,
        category: '💬 Social',
    },
];

const DEFAULT_PREFERENCES: PreferenceMap = {
    prayer_prayed: { in_app: true, push: true },
    friend_prayed: { in_app: true, push: false },
    new_prayer_published: { in_app: true, push: false },
    prayer_comment: { in_app: true, push: true },
    prayer_no_response: { in_app: false, push: true },
    group_access_request: { in_app: true, push: true },
    group_access_approved: { in_app: true, push: true },
    group_new_message: { in_app: true, push: true },
    admin_new_group: { in_app: true, push: true },
    group_invitation: { in_app: true, push: true },
    group_mention: { in_app: true, push: true },
    dm_new_message: { in_app: true, push: true },
    friend_request_received: { in_app: true, push: true },
    friend_request_accepted: { in_app: true, push: false },
};

function getWorkerUrl(): string {
    return process.env.NEXT_PUBLIC_NOTIFICATION_WORKER_URL
        || process.env.NEXT_PUBLIC_WORKER_URL
        || '';
}

interface NotificationSettingsProps {
    onBack?: () => void;
}

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
    const user = useAppStore(s => s.user);
    const [preferences, setPreferences] = useState<PreferenceMap>(DEFAULT_PREFERENCES);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [savedRecently, setSavedRecently] = useState(false);

    const workerUrl = getWorkerUrl();

    // ── Load preferences ────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        async function loadPreferences() {
            setIsLoading(true);

            if (workerUrl) {
                try {
                    const res = await fetch(`${workerUrl}/notify/preferences`, {
                        headers: { 'X-User-Id': user!.id },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
                        setIsLoading(false);
                        return;
                    }
                } catch (e) { /* fallback */ }
            }

            // Fallback: use defaults
            setPreferences(DEFAULT_PREFERENCES);
            setIsLoading(false);
        }

        loadPreferences();
    }, [user?.id, workerUrl]);

    // ── Toggle a preference ─────────────────────────────────
    const togglePreference = useCallback((key: string, field: 'in_app' | 'push') => {
        setPreferences(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: !prev[key]?.[field],
            },
        }));
        setHasChanges(true);
    }, []);

    // ── Save preferences ───────────────────────────────────
    const savePreferences = useCallback(async () => {
        if (!user?.id || !hasChanges) return;
        setIsSaving(true);

        try {
            if (workerUrl) {
                const res = await fetch(`${workerUrl}/notify/preferences`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': user.id,
                    },
                    body: JSON.stringify({ preferences }),
                });
                if (res.ok) {
                    setHasChanges(false);
                    setSavedRecently(true);
                    setTimeout(() => setSavedRecently(false), 2000);
                }
            } else {
                // No worker — changes stay local
                setHasChanges(false);
                setSavedRecently(true);
                setTimeout(() => setSavedRecently(false), 2000);
            }
        } catch (e) {
            console.error('[NotificationSettings] Save error:', e);
        } finally {
            setIsSaving(false);
        }
    }, [user?.id, workerUrl, preferences, hasChanges]);

    // ── Auto-save on unmount if changes exist ───────────────
    useEffect(() => {
        return () => {
            if (hasChanges) savePreferences();
        };
    }, [hasChanges, savePreferences]);

    // ── Group settings by category ──────────────────────────
    const categories = SETTINGS_CONFIG.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, SettingItem[]>);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="pb-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                {onBack && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-white"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings className="h-5 w-5 text-indigo-400" />
                        Notifications
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Choisissez les notifications à recevoir
                    </p>
                </div>
                {hasChanges && (
                    <Button
                        size="sm"
                        className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                        onClick={savePreferences}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : savedRecently ? (
                            <Check className="h-3 w-3 mr-1" />
                        ) : (
                            <Save className="h-3 w-3 mr-1" />
                        )}
                        {savedRecently ? 'Sauvé !' : 'Sauvegarder'}
                    </Button>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 px-1">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Monitor className="h-3 w-3" /> In-app
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Smartphone className="h-3 w-3" /> Push
                </div>
            </div>

            {/* Categories */}
            {Object.entries(categories).map(([category, items]) => (
                <div key={category} className="mb-4">
                    <h3 className="text-xs font-bold text-slate-400 px-1 mb-2">{category}</h3>
                    <div className="bg-white/2 rounded-xl border border-white/5 overflow-hidden">
                        {items.map((item, index) => {
                            const pref = preferences[item.key] || DEFAULT_PREFERENCES[item.key];
                            return (
                                <div
                                    key={item.key}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3",
                                        index < items.length - 1 && "border-b border-white/3"
                                    )}
                                >
                                    {/* Icon */}
                                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                        {item.icon}
                                    </div>

                                    {/* Label */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-white">{item.label}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
                                    </div>

                                    {/* In-app toggle */}
                                    <ToggleSwitch
                                        active={pref?.in_app ?? true}
                                        icon={<Monitor className="h-3 w-3" />}
                                        activeColor="indigo"
                                        onClick={() => togglePreference(item.key, 'in_app')}
                                        label="In-app"
                                    />

                                    {/* Push toggle */}
                                    <ToggleSwitch
                                        active={pref?.push ?? true}
                                        icon={<Smartphone className="h-3 w-3" />}
                                        activeColor="emerald"
                                        onClick={() => togglePreference(item.key, 'push')}
                                        label="Push"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Info footer */}
            <div className="mt-6 px-4 py-3 bg-white/2 rounded-xl border border-white/5">
                <div className="flex items-start gap-2">
                    <Bell className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Les notifications <strong>In-app</strong> apparaissent dans le centre de notifications.
                            Les notifications <strong>Push</strong> sont envoyées même quand l'app est fermée.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Toggle Switch Component ──────────────────────────────

function ToggleSwitch({
    active,
    icon,
    activeColor,
    onClick,
    label,
}: {
    active: boolean;
    icon: React.ReactNode;
    activeColor: 'indigo' | 'emerald';
    onClick: () => void;
    label: string;
}) {
    const colors = {
        indigo: {
            bg: active ? 'bg-indigo-600' : 'bg-slate-700',
            dot: active ? 'bg-white' : 'bg-slate-500',
        },
        emerald: {
            bg: active ? 'bg-emerald-600' : 'bg-slate-700',
            dot: active ? 'bg-white' : 'bg-slate-500',
        },
    };

    const c = colors[activeColor];

    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-1 shrink-0"
            title={`${label}: ${active ? 'Activé' : 'Désactivé'}`}
        >
            <div className={cn(
                "relative w-9 h-5 rounded-full transition-colors duration-200",
                c.bg
            )}>
                <motion.div
                    className={cn("absolute top-0.5 h-4 w-4 rounded-full shadow-sm", c.dot)}
                    animate={{ left: active ? '18px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                    <div className="flex items-center justify-center h-full">
                        {active ? icon : <BellOff className="h-2.5 w-2.5 text-slate-600" />}
                    </div>
                </motion.div>
            </div>
        </button>
    );
}

export default NotificationSettings;
