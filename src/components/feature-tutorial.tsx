'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Storage key prefix ──────────────────────────────────
const FEATURE_SEEN_PREFIX = 'feature_tutorial_seen_';

// ─── Feature tutorial definitions ─────────────────────────
export interface FeatureTutorialConfig {
    id: string;
    emoji: string;
    title: string;
    description: string;
    tips?: string[];
    color: string; // tailwind gradient: 'from-emerald-500 to-teal-600'
}

export const FEATURE_TUTORIALS: Record<string, FeatureTutorialConfig> = {
    community: {
        id: 'community',
        emoji: '🙏',
        title: 'Priez ensemble',
        description: 'Partagez vos sujets de prière, rejoignez les Chambres Hautes et les Maisons de Prière pour prier en communauté.',
        tips: [
            '📤 Partagez vos sujets de prière',
            '❤️ Priez pour les demandes des autres',
            '🚪 Créez une Chambre Haute autour d\'une prière',
            '🏠 Migrez vers une Maison de Prière permanente',
        ],
        color: 'from-amber-500 to-orange-600',
    },
    bible: {
        id: 'bible',
        emoji: '📖',
        title: 'Lisez la Bible',
        description: 'Accédez à la Bible complète (LSG). Lisez, surlignez et partagez vos versets préférés.',
        tips: [
            '🔍 Recherchez par livre, chapitre ou mot-clé',
            '📋 Copiez et partagez des versets',
            '🎨 Surlignez vos passages favoris',
            '📤 Partagez dans vos groupes de prière',
        ],
        color: 'from-emerald-500 to-teal-600',
    },
    library: {
        id: 'library',
        emoji: '📚',
        title: 'Bibliothèque',
        description: 'Explorez des centaines de livres chrétiens. Lisez, téléchargez et notez vos livres préférés.',
        tips: [
            '⭐ Notez les livres que vous avez lus',
            '❤️ Ajoutez des livres à vos favoris',
            '📥 Téléchargez pour lire hors ligne',
            '🏷️ Les livres "New" sont publiés récemment',
        ],
        color: 'from-violet-500 to-purple-600',
    },
    profile: {
        id: 'profile',
        emoji: '⭐',
        title: 'Votre profil',
        description: 'Personnalisez votre profil, suivez votre progression spirituelle et gérez vos amis.',
        tips: [
            '📸 Ajoutez une photo de profil',
            '🏆 Débloquez des succès en priant',
            '👥 Gérez vos amis et invitations',
            '🔔 Configurez vos notifications',
        ],
        color: 'from-pink-500 to-rose-600',
    },
    journal: {
        id: 'journal',
        emoji: '📝',
        title: 'Journal de prière',
        description: 'Tenez un journal spirituel. Notez vos réflexions, prières et méditations quotidiennes.',
        tips: [
            '✍️ Écrivez vos pensées et prières',
            '📅 Revoyez vos anciennes entrées',
            '🙏 Liez vos entrées à des sujets de prière',
        ],
        color: 'from-blue-500 to-indigo-600',
    },
    marketplace: {
        id: 'marketplace',
        emoji: '🛍️',
        title: 'Marketplace',
        description: 'Découvrez des produits, événements et services proposés par la communauté.',
        tips: [
            '🔍 Parcourez les annonces',
            '📞 Contactez les vendeurs',
            '📢 Publiez vos propres annonces',
        ],
        color: 'from-cyan-500 to-blue-600',
    },
};

// ─── Hook: check if a feature tutorial should be shown ────
export function useFeatureTutorial(featureId: string) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Small delay to let the view render first
        const timer = setTimeout(() => {
            const seen = localStorage.getItem(FEATURE_SEEN_PREFIX + featureId);
            if (!seen) {
                setShow(true);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [featureId]);

    const dismiss = useCallback(() => {
        localStorage.setItem(FEATURE_SEEN_PREFIX + featureId, 'true');
        setShow(false);
    }, [featureId]);

    return { show, dismiss };
}

// ─── Reset all tutorials (for testing/settings) ─────────
export function resetAllFeatureTutorials() {
    Object.keys(FEATURE_TUTORIALS).forEach(key => {
        localStorage.removeItem(FEATURE_SEEN_PREFIX + key);
    });
    // Also remove old full-screen tutorial flag
    localStorage.removeItem('tutorial_completed');
}

// ─── Contextual Tutorial Overlay Component ───────────────
export function FeatureTutorialOverlay({
    featureId,
    className,
}: {
    featureId: string;
    className?: string;
}) {
    const { show, dismiss } = useFeatureTutorial(featureId);
    const config = FEATURE_TUTORIALS[featureId];

    if (!show || !config) return null;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed inset-0 z-[90] backdrop-blur-sm bg-black/60 flex items-end sm:items-center justify-center ${className || ''}`}
                    onClick={dismiss}
                >
                    <motion.div
                        initial={{ y: 100, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 100, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="w-full max-w-sm mx-4 mb-4 sm:mb-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`relative rounded-2xl overflow-hidden shadow-2xl border border-white/10`}>
                            {/* Gradient header */}
                            <div className={`bg-gradient-to-r ${config.color} p-5 pb-6`}>
                                {/* Close button */}
                                <button
                                    onClick={dismiss}
                                    className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>

                                <div className="flex items-center gap-3 mb-3">
                                    <motion.span
                                        className="text-4xl"
                                        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                                    >
                                        {config.emoji}
                                    </motion.span>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-white/80" />
                                            <span className="text-[10px] font-medium text-white/80 uppercase tracking-wider">
                                                Découvrir
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{config.title}</h3>
                                    </div>
                                </div>

                                <p className="text-sm text-white/90 leading-relaxed">
                                    {config.description}
                                </p>
                            </div>

                            {/* Tips section */}
                            {config.tips && config.tips.length > 0 && (
                                <div className="bg-[#0F1219] p-4 space-y-2.5">
                                    {config.tips.map((tip, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.1 * (i + 1) }}
                                            className="flex items-start gap-2"
                                        >
                                            <span className="text-xs leading-relaxed text-slate-300">{tip}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            {/* Footer */}
                            <div className="bg-[#0F1219] px-4 pb-4 pt-1 border-t border-white/5">
                                <Button
                                    onClick={dismiss}
                                    className={`w-full bg-gradient-to-r ${config.color} text-white font-medium shadow-lg hover:shadow-xl transition-all`}
                                >
                                    J'ai compris ! 👍
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
