'use client';

import { useState, useEffect } from "react";
import {
    Heart, Users, Share2, Flag, Sparkles,
    Lock, CheckCircle2, Loader2, Trash2, MoreVertical, MessageSquare
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { PrayerCategory, PrayerRequest } from "@/lib/types";
import { PhotoGallery } from "@/components/ui/photo-upload";
import { PrayerGroupManager } from "@/components/community/prayer-group-manager";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

// Prayer Card Component - Enhanced with answered/not answered functionality
export function PrayerCard({
    prayer,
    onPray,
    onDelete,
    getCategoryInfo,
    userId
}: {
    prayer: PrayerRequest;
    onPray: () => void;
    onDelete?: (id: string) => void;
    getCategoryInfo: (cat: PrayerCategory) => any;
    userId?: string;
}) {
    // Gestion robuste des propriétés avec valeurs par défaut
    const category = getCategoryInfo(prayer.category || 'other');
    const prayerId = prayer.id;
    const prayerUserId = prayer.userId || (prayer as any).user_id;

    // Initialisation des états locaux pour l'Optimistic UI
    const initialPrayedBy = prayer.prayedBy || (prayer as any).prayed_by || [];
    const initialHasPrayed = userId && initialPrayedBy ? initialPrayedBy.includes(userId) : false;
    const initialCount = prayer.prayerCount || (prayer as any).prayer_count || 0;

    const [hasPrayed, setHasPrayed] = useState(initialHasPrayed);
    const [prayerCount, setPrayerCount] = useState(initialCount);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isAnswered, setIsAnswered] = useState(prayer.isAnswered || (prayer as any).is_answered || false);
    const [isLocked, setIsLocked] = useState((prayer as any).is_locked || false);
    const [showTestimonyDialog, setShowTestimonyDialog] = useState(false);
    const [testimonyContent, setTestimonyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGroupDialog, setShowGroupDialog] = useState(false);
    const [hasLinkedGroup, setHasLinkedGroup] = useState(false);

    const isOwner = userId === prayerUserId;

    // Check if a prayer group exists for this prayer
    useEffect(() => {
        const checkGroup = async () => {
            try {
                const { data, error } = await supabase
                    .from('prayer_groups')
                    .select('id')
                    .eq('prayer_request_id', prayerId)
                    .limit(1);
                if (!error && data && data.length > 0) {
                    setHasLinkedGroup(true);
                }
            } catch (e) {
                // Silently fail
            }
        };
        checkGroup();
    }, [prayerId]);

    // Mettre à jour l'état si les props changent (sync avec le serveur)
    useEffect(() => {
        setHasPrayed(initialHasPrayed);
        setPrayerCount(initialCount);
        setIsAnswered(prayer.isAnswered || (prayer as any).is_answered || false);
    }, [initialHasPrayed, initialCount, prayer]);

    const handlePray = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasPrayed || isLocked) return;

        // Optimistic Update
        setHasPrayed(true);
        setPrayerCount((prev: number) => prev + 1);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 1000);

        onPray();
        toast.success("Votre prière a été comptabilisée 🙏");
    };

    const handleToggleAnswered = async () => {
        if (!isOwner) return;

        // If already answered and locked, don't allow toggle (only admin can reopen)
        if (isAnswered && isLocked) {
            toast.error("Cette prière est verrouillée. Seul un admin peut modifier le statut.");
            return;
        }

        const newStatus = !isAnswered;
        setIsAnswered(newStatus);

        try {
            // Update prayer request - when marked as answered, also lock it
            const { error } = await supabase
                .from('prayer_requests')
                .update({
                    is_answered: newStatus,
                    answered_at: newStatus ? new Date().toISOString() : null,
                    is_locked: newStatus // Lock when answered
                })
                .eq('id', prayerId);

            if (error) throw error;

            // If prayer is answered, also close the associated group
            if (newStatus) {
                // Find and close any associated prayer group
                const { data: groupData } = await supabase
                    .from('prayer_groups')
                    .select('id')
                    .eq('prayer_request_id', prayerId)
                    .single();

                if (groupData) {
                    await supabase
                        .from('prayer_groups')
                        .update({
                            is_open: false,
                            is_closed: true,
                            closed_reason: 'prayer_answered',
                            closed_at: new Date().toISOString()
                        })
                        .eq('id', groupData.id);
                }

                setIsLocked(true);
                toast.success("🙌 Prière marquée comme exaucée! Le groupe a été fermé.");
                setShowTestimonyDialog(true);
            } else {
                toast.info("Statut mis à jour");
            }
        } catch (e: any) {
            console.error('Error updating prayer:', e);
            setIsAnswered(!newStatus);
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
                    user_id: userId,
                    content: testimonyContent.trim(),
                    prayer_request_id: prayerId,
                    is_approved: false
                });

            if (error) throw error;

            toast.success("Témoignage envoyé! Il sera publié après approbation.");
            setShowTestimonyDialog(false);
            setTestimonyContent('');
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
            text: `Rejoignez-moi pour prier pour cette intention : "${prayer.content}"`,
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

    const handleDeletePrayer = async () => {
        if (!isOwner) return;
        const confirmed = window.confirm('Voulez-vous vraiment supprimer cette demande de prière ?');
        if (!confirmed) return;

        // Optimistic removal - immediately hide the card
        if (onDelete) onDelete(prayerId);

        try {
            // Use admin API endpoint to bypass RLS
            const response = await fetch('/api/admin/delete-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table: 'prayer_requests', id: prayerId })
            });

            if (!response.ok) {
                // Fallback: try direct delete
                const { error } = await supabase
                    .from('prayer_requests')
                    .delete()
                    .eq('id', prayerId);
                if (error) throw error;
            }
            toast.success('Demande de prière supprimée');
        } catch (e: any) {
            console.error('Error deleting prayer:', e);
            toast.error('Impossible de supprimer cette demande');
        }
    };

    const handleReport = async () => {
        try {
            await supabase
                .from('reports')
                .insert({
                    reporter_id: userId,
                    content_type: 'prayer_request',
                    content_id: prayerId,
                    reason: 'Signalé par un utilisateur'
                });
            toast.success('Signalement envoyé. Merci pour votre vigilance.');
        } catch (e) {
            // If reports table doesn't exist yet, just show confirmation
            toast.success('Signalement pris en compte. Merci.');
        }
    };

    return (
        <>
            <Card className={cn(
                "bg-white/5 border-white/5 rounded-3xl overflow-hidden transition-all",
                isAnswered && "border-emerald-500/30 bg-emerald-500/5",
                isLocked && "opacity-60"
            )}>
                <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-white/10">
                                <AvatarImage src={prayer.userAvatar || (prayer as any).profiles?.avatar_url} />
                                <AvatarFallback className="bg-indigo-600/30 text-indigo-300">
                                    {prayer.isAnonymous ? '?' : (prayer.userName?.[0] || (prayer as any).profiles?.full_name?.[0] || 'U')}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-sm text-white">
                                    {prayer.isAnonymous ? 'Anonyme' : (prayer.userName || (prayer as any).profiles?.full_name || 'Utilisateur')}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                    {prayer.createdAt ? formatDistanceToNow(new Date(prayer.createdAt), { addSuffix: true, locale: fr }) : ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Category Badge */}
                            {category && (
                                <Badge
                                    variant="outline"
                                    className="border-none text-[10px] font-bold"
                                    style={{ backgroundColor: `${category.color}30`, color: category.color }}
                                >
                                    {category.icon} {category.nameFr}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Status Badges */}
                    {(isAnswered || isLocked) && (
                        <div className="flex gap-2 mb-3">
                            {isAnswered && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Prière Exaucée
                                </Badge>
                            )}
                            {isLocked && (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Fermée
                                </Badge>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <p className="text-slate-200 leading-relaxed mb-4">{prayer.content}</p>

                    {/* Photos */}
                    {prayer.photos && prayer.photos.length > 0 && (
                        <PhotoGallery photos={prayer.photos} size="md" />
                    )}

                    {/* Owner Controls - Exaucée/Non Exaucée Buttons */}
                    {isOwner && !isLocked && (
                        <div className="flex gap-2 mb-4 p-3 rounded-2xl bg-white/5 border border-white/10">
                            <Button
                                variant={isAnswered ? "default" : "outline"}
                                size="sm"
                                onClick={handleToggleAnswered}
                                className={cn(
                                    "flex-1 rounded-xl",
                                    isAnswered
                                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                        : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                )}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {isAnswered ? "Exaucée ✓" : "Prière exaucée"}
                            </Button>
                            {!isAnswered && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 rounded-xl border-slate-500/30 text-slate-400"
                                    disabled
                                >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Pas encore exaucée
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            {/* Pray Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "rounded-xl gap-2 h-10 px-4 transition-all relative overflow-hidden",
                                    hasPrayed ? "bg-indigo-600/20 text-indigo-400" : "text-slate-400 hover:text-indigo-400"
                                )}
                                onClick={handlePray}
                                disabled={hasPrayed || isLocked}
                            >
                                {isAnimating && (
                                    <span className="absolute inset-0 bg-indigo-500/20 animate-ping rounded-xl" />
                                )}
                                <Heart className={cn("h-4 w-4 transition-transform", hasPrayed && "fill-current scale-110", isAnimating && "scale-125")} />
                                <span className="font-bold">{prayerCount}</span>
                                <span className="text-[10px] uppercase tracking-wider">
                                    {hasPrayed ? "Prié" : "J'ai prié"}
                                </span>
                            </Button>

                            {/* Group Button - only shows if a group was created for this prayer */}
                            {hasLinkedGroup && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl text-slate-400 hover:text-emerald-400"
                                    onClick={() => setShowGroupDialog(true)}
                                >
                                    <Users className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Groupe</span>
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {/* Testimony Button (if answered and owner) */}
                            {isOwner && isAnswered && (
                                <Button
                                    size="sm"
                                    onClick={() => setShowTestimonyDialog(true)}
                                    className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Témoigner
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl text-slate-500 hover:text-white hover:bg-white/10"
                                onClick={handleShare}
                            >
                                <Share2 className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-500 hover:text-white hover:bg-white/10">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#1A1D24] border-white/10 text-slate-200">
                                    <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer gap-2" onClick={handleReport}>
                                        <Flag className="h-4 w-4" /> Signaler
                                    </DropdownMenuItem>
                                    {isOwner && (
                                        <DropdownMenuItem className="focus:bg-red-500/10 focus:text-red-400 text-red-400 cursor-pointer gap-2" onClick={handleDeletePrayer}>
                                            <Trash2 className="h-4 w-4" /> Supprimer
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Testimony Dialog */}
            <Dialog open={showTestimonyDialog} onOpenChange={setShowTestimonyDialog}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            Partager votre témoignage
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Votre prière a été exaucée ! Partagez ce que Dieu a fait dans votre vie.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                            <p className="text-xs text-indigo-400 mb-1">Demande de prière originale :</p>
                            <p className="text-sm text-slate-300 line-clamp-3">{prayer.content}</p>
                        </div>

                        <Textarea
                            placeholder="Racontez comment Dieu a répondu à votre prière..."
                            value={testimonyContent}
                            onChange={(e) => setTestimonyContent(e.target.value)}
                            rows={5}
                            className="bg-white/5 border-white/10 rounded-2xl resize-none"
                        />

                        <p className="text-xs text-slate-500">
                            Votre témoignage sera soumis à approbation avant publication.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setShowTestimonyDialog(false)} className="flex-1 rounded-xl">
                            Plus tard
                        </Button>
                        <Button
                            onClick={handleSubmitTestimony}
                            disabled={isSubmitting || !testimonyContent.trim()}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 rounded-xl"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publier"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Group Dialog */}
            <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
                <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-md rounded-[2rem]">
                    <PrayerGroupManager
                        prayerId={prayerId}
                        prayerContent={prayer.content}
                        prayerOwnerId={prayerUserId}
                        currentUserId={userId}
                        onClose={() => setShowGroupDialog(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
