'use client';

import { Heart, Share2, Sparkles, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Testimonial } from "@/lib/types";
import { PhotoGallery } from "@/components/ui/photo-upload";

// Testimony Card Component
export function TestimonyCard({
    testimony,
    onLike,
    userId
}: {
    testimony: Testimonial;
    onLike: () => void;
    userId?: string;
}) {
    const isGuest = !userId;
    const hasLiked = userId && testimony.likedBy ? testimony.likedBy.includes(userId) : false;

    // Guest blur logic
    const contentWords = (testimony.content || '').split(/\s+/);
    const guestPreview = contentWords.slice(0, 5).join(' ');
    const hasMoreWords = contentWords.length > 5;

    const handleShareTestimony = async () => {
        const shareData = {
            title: 'Témoignage',
            text: `Découvrez ce témoignage : "${testimony.content.substring(0, 100)}..."`,
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

    return (
        <Card className="bg-gradient-to-br from-amber-600/10 to-orange-600/5 border-amber-500/10 rounded-3xl overflow-hidden">
            <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10 border border-amber-500/20">
                        <AvatarImage src={testimony.userAvatar} />
                        <AvatarFallback className="bg-amber-600/30 text-amber-300">
                            {testimony.userName?.[0] || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="font-bold text-sm text-white">{testimony.userName}</p>
                        <p className="text-[10px] text-slate-500">
                            {formatDistanceToNow(new Date(testimony.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400 border-none gap-1">
                        <Sparkles className="h-3 w-3" />
                        Témoignage
                    </Badge>
                </div>

                {/* Content — blurred for guests */}
                {isGuest ? (
                    <div className="relative mb-4">
                        <p className="text-slate-200 leading-relaxed">
                            {guestPreview}
                            {hasMoreWords && (
                                <span
                                    className="select-none"
                                    style={{ filter: 'blur(5px)', WebkitFilter: 'blur(5px)' }}
                                >
                                    {' ' + contentWords.slice(5, 20).join(' ')}
                                </span>
                            )}
                        </p>
                        {hasMoreWords && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                <p className="text-xs text-amber-300">
                                    Connectez-vous pour lire ce témoignage
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-slate-200 leading-relaxed mb-4">{testimony.content}</p>
                )}

                {/* Photos */}
                {testimony.photos && testimony.photos.length > 0 && (
                    <PhotoGallery photos={testimony.photos} size="md" />
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "rounded-xl gap-2 h-10 px-4 transition-all",
                            hasLiked ? "bg-red-600/20 text-red-400" : "text-slate-400 hover:text-red-400"
                        )}
                        onClick={onLike}
                    >
                        <Heart className={cn("h-4 w-4", hasLiked && "fill-current")} />
                        <span className="font-bold">{testimony.likes}</span>
                    </Button>

                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-500 hover:text-amber-400 transition-colors" onClick={handleShareTestimony}>
                            <Share2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
