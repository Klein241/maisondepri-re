'use client';

import { motion } from 'framer-motion';
import { Check, Lock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface DayCardProps {
    day: number;
    title: string;
    isCompleted: boolean;
    isUnlocked: boolean;
    isCurrent: boolean;
    isStreak?: boolean;
    onClick?: () => void;
}

export function DayCard({
    day,
    title,
    isCompleted,
    isUnlocked,
    isCurrent,
    isStreak = false,
    onClick,
}: DayCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: day * 0.02 }}
            whileHover={isUnlocked ? { scale: 1.02 } : undefined}
            whileTap={isUnlocked ? { scale: 0.98 } : undefined}
        >
            <Card
                className={cn(
                    'cursor-pointer transition-all duration-300 overflow-hidden relative',
                    isCompleted && 'border-primary/50 bg-primary/5',
                    isCurrent && 'ring-2 ring-primary ring-offset-2 animate-pulse-gold',
                    !isUnlocked && 'opacity-50 cursor-not-allowed',
                    isStreak && isCompleted && 'border-gold bg-gold/10'
                )}
                onClick={isUnlocked ? onClick : undefined}
            >
                <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold',
                                        isCompleted
                                            ? 'bg-primary text-primary-foreground'
                                            : isCurrent
                                                ? 'bg-gold text-gold-foreground'
                                                : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    {day}
                                </span>
                                {isStreak && isCompleted && (
                                    <Flame className="w-4 h-4 text-orange-500" />
                                )}
                            </div>
                            <h3 className="mt-2 font-semibold text-sm line-clamp-2">
                                {title}
                            </h3>
                        </div>
                        <div className="ml-2">
                            {isCompleted ? (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                                >
                                    <Check className="w-4 h-4 text-white" />
                                </motion.div>
                            ) : !isUnlocked ? (
                                <Lock className="w-5 h-5 text-muted-foreground" />
                            ) : null}
                        </div>
                    </div>
                </CardContent>

                {/* Progress indicator at bottom */}
                {isCompleted && (
                    <motion.div
                        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.5 }}
                    />
                )}
            </Card>
        </motion.div>
    );
}
