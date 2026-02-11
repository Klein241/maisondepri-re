'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Heart, Share2, MoreVertical, Users, MessageCircle,
    CheckCircle2, Clock, Sparkles, Lock, Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { PRAYER_CATEGORIES, PrayerCategory } from '@/lib/types';
import { JoinPrayerGroupButton } from './prayer-group-manager';

interface PrayerRequest {
    id: string;
    user_id: string;
    content: string;
    category: PrayerCategory;
    is_anonymous: boolean;
    is_answered: boolean;
    is_locked: boolean;
    prayer_count: number;
    prayed_by: string[];
    created_at: string;
    answered_at?: string;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface EnhancedPrayerCardProps {
    prayer: PrayerRequest;
    currentUserId?: string;
    onPray: () => void;
    onAnswered?: (prayerId: string, isAnswered: boolean) => void;
    onCreateTestimony?: (prayerId: string, prayerContent: string) => void;
    onJoinPrayerGroup?: (prayerId: string) => void;
    isAdmin?: boolean;
}

export function EnhancedPrayerCard({
    prayer,
    currentUserId,
    onPray,
    onAnswered,
    onCreateTestimony,
    onJoinPrayerGroup,
    isAdmin = false
}: EnhancedPrayerCardProps) {
    // Local state for optimistic UI
    const [hasPrayed, setHasPrayed] = useState(
        currentUserId ? prayer.prayed_by?.includes(currentUserId) : false
    );
    const [prayerCount, setPrayerCount] = useState(prayer.prayer_count || 0);
    const [isAnswered, setIsAnswered] = useState(prayer.is_answered || false);
    const [isLocked, setIsLocked] = useState(prayer.is_locked || false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showTestimonyDialog, setShowTestimonyDialog] = useState(false);
    const [testimonyContent, setTestimonyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isOwner = currentUserId === prayer.user_id;
    const canManage = isOwner || isAdmin;

    // Sync with props
    useEffect(() => {
        setHasPrayed(currentUserId ? prayer.prayed_by?.includes(currentUserId) : false);
        setPrayerCount(prayer.prayer_count || 0);
        setIsAnswered(prayer.is_answered || false);
        setIsLocked(prayer.is_locked || false);
    }, [prayer, currentUserId]);

    const getCategoryInfo = (catId: PrayerCategory) => {
        return PRAYER_CATEGORIES.find(c => c.id === catId) || PRAYER_CATEGORIES.find(c => c.id === 'other')!;
    };

    const category = getCategoryInfo(prayer.category || 'other');

    const handlePray = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasPrayed) return;

        // Optimistic update
        setHasPrayed(true);
        setPrayerCount(prev => prev + 1);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 1000);

        onPray();
        toast.success("Votre prière a été comptabilisée 🙏");
    };

    const handleToggleAnswered = async () => {
        if (!canManage) return;

        // If already answered, only admin can revert (owner cannot cancel once answered)
        if (isAnswered && !isAdmin) {
            toast.info("Cette prière a été exaucée. Cette action est définitive.");
            return;
        }

        const newStatus = !isAnswered;
        setIsAnswered(newStatus);

        try {
            const { error } = await supabase
                .from('prayer_requests')
                .update({
                    is_answered: newStatus,
                    answered_at: newStatus ? new Date().toISOString() : null
                })
                .eq('id', prayer.id);

            if (error) throw error;

            if (newStatus) {
                // Close associated prayer group automatically
                try {
                    await supabase
                        .from('prayer_groups')
                        .update({
                            status: 'answered',
                            is_open: false,
                            closed_at: new Date().toISOString()
                        })
                        .eq('prayer_request_id', prayer.id);
                } catch (groupError) {
                    console.warn('Could not close group:', groupError);
                }

                toast.success("🙌 Prière marquée comme exaucée! Le groupe a été fermé.");
                // Show testimony dialog
                if (isOwner) {
                    setShowTestimonyDialog(true);
                }
            } else {
                toast.info("Statut mis à jour (Admin)");
            }

            onAnswered?.(prayer.id, newStatus);
        } catch (e: any) {
            console.error('Error updating prayer:', e);
            setIsAnswered(!newStatus); // Revert
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const handleToggleLocked = async () => {
        if (!isAdmin) return;

        const newStatus = !isLocked;
        setIsLocked(newStatus);

        try {
            const { error } = await supabase
                .from('prayer_requests')
                .update({ is_locked: newStatus })
                .eq('id', prayer.id);

            if (error) throw error;

            toast.success(newStatus ? "Demande verrouillée" : "Demande déverrouillée");
        } catch (e: any) {
            console.error('Error updating prayer:', e);
            setIsLocked(!newStatus);
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const handleSubmitTestimony = async () => {
        if (!testimonyContent.trim()) {
            toast.error("Veuillez écrire votre témoignage");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('testimonials')
                .insert({
                    user_id: currentUserId,
                    content: testimonyContent.trim(),
                    prayer_request_id: prayer.id,
                    is_approved: false // Needs admin approval
                });

            if (error) throw error;

            toast.success("Témoignage envoyé! Il sera publié après approbation.");
            setShowTestimonyDialog(false);
            setTestimonyContent('');
            onCreateTestimony?.(prayer.id, testimonyContent);
        } catch (e: any) {
            console.error('Error creating testimony:', e);
            toast.error("Erreur lors de l'envoi du témoignage");
        }
        setIsSubmitting(false);
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareData = {
            title: 'Demande de prière',
            text: `Rejoignez-moi pour prier pour cette intention : "${prayer.content.slice(0, 100)}..."`,
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                toast.success('Lien copié dans le presse-papier');
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    const handleJoinGroup = () => {
        onJoinPrayerGroup?.(prayer.id);
    };

    const getInitials = (name: string | null) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <>
            <Card className={cn(
                "bg-white/5 border-white/5 rounded-3xl overflow-hidden transition-all",
                isAnswered && "border-green-500/30 bg-green-500/5",
                isLocked && "opacity-60"
            )}>
                <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                {!prayer.is_anonymous && prayer.profiles?.avatar_url ? (
                                    <AvatarImage src={prayer.profiles.avatar_url} />
                                ) : null}
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                                    {prayer.is_anonymous ? '?' : getInitials(prayer.profiles?.full_name ?? null)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium text-white">
                                    {prayer.is_anonymous ? 'Anonyme' : prayer.profiles?.full_name || 'Utilisateur'}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {formatDistanceToNow(new Date(prayer.created_at), { addSuffix: true, locale: fr })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge
                                style={{ backgroundColor: `${category.color}20`, color: category.color }}
                                className="border-none text-xs"
                            >
                                {category.icon} {category.nameFr}
                            </Badge>

                            {canManage && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={handleToggleAnswered}>
                                            {isAnswered ? (
                                                <>
                                                    <Clock className="h-4 w-4 mr-2" />
                                                    Marquer non exaucée
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                                    Prière exaucée
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                        {isAdmin && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={handleToggleLocked}>
                                                    {isLocked ? (
                                                        <>
                                                            <Unlock className="h-4 w-4 mr-2" />
                                                            Déverrouiller
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lock className="h-4 w-4 mr-2" />
                                                            Verrouiller
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    {/* Status Badges */}
                    {(isAnswered || isLocked) && (
                        <div className="flex gap-2 mb-3">
                            {isAnswered && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Prière Exaucée
                                </Badge>
                            )}
                            {isLocked && (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Verrouillée
                                </Badge>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <p className="text-slate-200 leading-relaxed mb-4">
                        {prayer.content}
                    </p>

                    {/* Owner Controls - Status Buttons */}
                    {isOwner && !isLocked && (
                        <div className="flex gap-2 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                            <Button
                                variant={isAnswered ? "default" : "outline"}
                                size="sm"
                                onClick={handleToggleAnswered}
                                className={cn(
                                    "flex-1",
                                    isAnswered
                                        ? "bg-green-600 hover:bg-green-500 text-white"
                                        : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                                )}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {isAnswered ? "Exaucée ✓" : "Prière exaucée"}
                            </Button>
                            {!isAnswered && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-slate-500/30 text-slate-400"
                                    disabled
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    En attente
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div className="flex items-center gap-4">
                            {/* Pray Button */}
                            <motion.button
                                onClick={handlePray}
                                disabled={hasPrayed || isLocked}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    "flex items-center gap-2 transition-all",
                                    hasPrayed ? "text-pink-500" : "text-slate-400 hover:text-pink-500"
                                )}
                            >
                                <motion.div
                                    animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Heart className={cn("h-5 w-5", hasPrayed && "fill-current")} />
                                </motion.div>
                                <span className="text-sm font-medium">{prayerCount}</span>
                            </motion.button>

                            {/* Join Prayer Group - Always available */}
                            <JoinPrayerGroupButton
                                prayerId={prayer.id}
                                prayerContent={prayer.content}
                                prayerOwnerId={prayer.user_id}
                                currentUserId={currentUserId}
                                size="sm"
                            />

                            {/* Share */}
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors"
                            >
                                <Share2 className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Create Testimony Button (if answered and owner) */}
                        {isOwner && isAnswered && (
                            <Button
                                size="sm"
                                onClick={() => setShowTestimonyDialog(true)}
                                className="bg-amber-600 hover:bg-amber-500 text-white"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Témoigner
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Testimony Dialog */}
            <Dialog open={showTestimonyDialog} onOpenChange={setShowTestimonyDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            Partager votre témoignage
                        </DialogTitle>
                        <DialogDescription>
                            Votre prière a été exaucée ! Partagez ce que Dieu a fait dans votre vie.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <p className="text-xs text-indigo-400 mb-1">Demande de prière originale :</p>
                            <p className="text-sm text-slate-300 line-clamp-3">{prayer.content}</p>
                        </div>

                        <Textarea
                            placeholder="Racontez comment Dieu a répondu à votre prière..."
                            value={testimonyContent}
                            onChange={(e) => setTestimonyContent(e.target.value)}
                            rows={5}
                            className="bg-white/5 border-white/10"
                        />

                        <p className="text-xs text-slate-500">
                            Votre témoignage sera soumis à approbation avant publication.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTestimonyDialog(false)}>
                            Plus tard
                        </Button>
                        <Button
                            onClick={handleSubmitTestimony}
                            disabled={isSubmitting || !testimonyContent.trim()}
                            className="bg-amber-600 hover:bg-amber-500"
                        >
                            {isSubmitting ? "Envoi..." : "Publier le témoignage"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
