'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, BookOpen, MessageSquare, Users, Heart, Star, Gamepad2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TUTORIAL_SEEN_KEY = 'tutorial_completed';

interface TutorialStep {
    title: string;
    description: string;
    icon: any;
    color: string;
    bgGradient: string;
    emoji: string;
}

const STEPS: TutorialStep[] = [
    {
        title: 'Bienvenue dans Maison de Prière ! 🙏',
        description: 'Votre espace de communion, de prière et de partage spirituel. Découvrons ensemble les fonctionnalités principales.',
        icon: Heart,
        color: 'text-pink-400',
        bgGradient: 'from-pink-600/20 to-rose-600/10',
        emoji: '🏠',
    },
    {
        title: 'Priez ensemble',
        description: 'Partagez vos sujets de prière, priez pour les demandes des autres et voyez vos prières exaucées. Un compteur affiche combien de personnes prient pour chaque demande.',
        icon: Star,
        color: 'text-amber-400',
        bgGradient: 'from-amber-600/20 to-yellow-600/10',
        emoji: '🙏',
    },
    {
        title: 'Groupes de prière',
        description: 'Créez ou rejoignez des groupes de prière. Les admins peuvent envoyer des annonces, créer des événements, lancer des jeûnes collectifs et épingler des sujets de prière.',
        icon: Users,
        color: 'text-indigo-400',
        bgGradient: 'from-indigo-600/20 to-blue-600/10',
        emoji: '👥',
    },
    {
        title: 'Messages privés',
        description: 'Discutez en privé avec vos amis. Envoyez des messages texte, des notes vocales, partagez des versets bibliques et des fichiers.',
        icon: MessageSquare,
        color: 'text-blue-400',
        bgGradient: 'from-blue-600/20 to-cyan-600/10',
        emoji: '💬',
    },
    {
        title: 'Lisez la Bible',
        description: 'Accédez à la Bible complète dans l\'app. Lisez, surlignez et partagez vos versets préférés avec la communauté ou dans vos groupes.',
        icon: BookOpen,
        color: 'text-emerald-400',
        bgGradient: 'from-emerald-600/20 to-teal-600/10',
        emoji: '📖',
    },
    {
        title: 'Bibliothèque',
        description: 'Explorez notre bibliothèque de plus de 5000 livres chrétiens. Lisez, téléchargez, notez vos livres préférés et gardez un historique de lecture.',
        icon: Gamepad2,
        color: 'text-teal-400',
        bgGradient: 'from-teal-600/20 to-emerald-600/10',
        emoji: '📚',
    },
    {
        title: 'Votre profil',
        description: 'Personnalisez votre profil, suivez votre progression spirituelle, gérez vos groupes et vos amis. Débloquez des succès en priant régulièrement !',
        icon: User,
        color: 'text-purple-400',
        bgGradient: 'from-purple-600/20 to-violet-600/10',
        emoji: '⭐',
    },
];

export function AppTutorial({ onComplete }: { onComplete: () => void }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState(1);

    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;
    const isFirst = currentStep === 0;

    const handleNext = () => {
        if (isLast) {
            localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
            onComplete();
            return;
        }
        setDirection(1);
        setCurrentStep(prev => prev + 1);
    };

    const handlePrev = () => {
        if (isFirst) return;
        setDirection(-1);
        setCurrentStep(prev => prev - 1);
    };

    const handleSkip = () => {
        localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
        onComplete();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 bg-[#0B0E14]/98 backdrop-blur-xl flex items-center justify-center"
        >
            <div className="w-full max-w-md mx-auto px-6">
                {/* Skip button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
                >
                    Passer <X className="h-4 w-4" />
                </button>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mb-8">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep
                                ? 'w-8 bg-primary'
                                : i < currentStep
                                    ? 'w-3 bg-primary/40'
                                    : 'w-3 bg-white/10'
                                }`}
                        />
                    ))}
                </div>

                {/* Step content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ x: direction * 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -direction * 100, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="text-center"
                    >
                        {/* Icon circle */}
                        <div className={`mx-auto w-24 h-24 rounded-3xl bg-linear-to-br ${step.bgGradient} flex items-center justify-center mb-6 shadow-2xl`}>
                            <span className="text-5xl">{step.emoji}</span>
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-white mb-3">{step.title}</h2>

                        {/* Description */}
                        <p className="text-sm text-slate-300 leading-relaxed mb-8 max-w-xs mx-auto">{step.description}</p>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`text-slate-400 hover:text-white ${isFirst ? 'invisible' : ''}`}
                        onClick={handlePrev}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                    </Button>

                    <Button
                        className="bg-linear-to-r from-primary to-purple-600 text-white px-6 shadow-lg shadow-primary/30"
                        onClick={handleNext}
                    >
                        {isLast ? "C'est parti ! 🚀" : 'Suivant'}
                        {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
                    </Button>
                </div>

                {/* Step counter */}
                <p className="text-center text-[10px] text-slate-600 mt-6">
                    {currentStep + 1} / {STEPS.length}
                </p>
            </div>
        </motion.div>
    );
}

// Hook to check if tutorial should be shown
export function useTutorial() {
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
        if (!seen) {
            // Show tutorial after a small delay (after splash screen)
            const timer = setTimeout(() => setShowTutorial(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    return { showTutorial, setShowTutorial };
}
