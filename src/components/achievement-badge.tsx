'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
    icon: string;
    name: string;
    description: string;
    isUnlocked: boolean;
    unlockedAt?: string;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}

export function AchievementBadge({
    icon,
    name,
    description,
    isUnlocked,
    unlockedAt,
    size = 'md',
    onClick,
}: AchievementBadgeProps) {
    const sizeClasses = {
        sm: 'w-16 h-16 text-2xl',
        md: 'w-20 h-20 text-3xl',
        lg: 'w-24 h-24 text-4xl',
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={isUnlocked ? { scale: 1.05 } : undefined}
            className={cn(
                'flex flex-col items-center gap-2 cursor-pointer',
                !isUnlocked && 'opacity-40'
            )}
            onClick={onClick}
        >
            <div
                className={cn(
                    'relative rounded-full flex items-center justify-center transition-all duration-300',
                    sizeClasses[size],
                    isUnlocked
                        ? 'bg-gradient-to-br from-gold to-amber-500 shadow-lg animate-pulse-gold'
                        : 'bg-muted'
                )}
            >
                <span className={isUnlocked ? '' : 'grayscale'}>{icon}</span>
                {isUnlocked && (
                    <motion.div
                        className="absolute inset-0 rounded-full bg-white/20"
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{
                            duration: 1,
                            repeat: Infinity,
                            repeatDelay: 2,
                        }}
                    />
                )}
            </div>
            <div className="text-center">
                <h4 className="font-semibold text-sm">{name}</h4>
                <p className="text-xs text-muted-foreground max-w-[120px]">
                    {description}
                </p>
                {isUnlocked && unlockedAt && (
                    <p className="text-xs text-primary mt-1">
                        Débloqué le {new Date(unlockedAt).toLocaleDateString('fr-FR')}
                    </p>
                )}
            </div>
        </motion.div>
    );
}
