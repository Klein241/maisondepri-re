'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { GameSession } from './chat-types';

interface GroupGameDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activeGameSession: GameSession | null;
    setActiveGameSession: React.Dispatch<React.SetStateAction<GameSession | null>>;
    setHasQuitGame: (v: boolean) => void;
    userId: string;
    userName: string;
    currentGroup: { id: string; name: string } | null;
}

export function GroupGameDialog({
    open,
    onOpenChange,
    activeGameSession,
    setActiveGameSession,
    setHasQuitGame,
    userId,
    userName,
    currentGroup,
}: GroupGameDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 border-white/10 p-0">
                <DialogHeader className="p-4 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-white">
                        🎮 Jeu de Groupe Biblique
                    </DialogTitle>
                </DialogHeader>
                <div className="p-4 pt-0 space-y-4">
                    {activeGameSession ? (
                        <>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                                <p className="text-xs text-yellow-400 font-semibold">🎮 Session en cours</p>
                                <p className="text-sm text-white mt-1">Lancé par <strong>{activeGameSession.startedByName}</strong></p>
                                <p className="text-[10px] text-slate-400 mt-1">{activeGameSession.players.length} joueur(s) actif(s)</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-6 text-center">
                                <p className="text-4xl mb-4">📖</p>
                                <p className="text-lg font-bold text-white mb-2">Quiz Biblique</p>
                                <p className="text-sm text-slate-400 mb-4">Qui a construit l&apos;arche ?</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Noé', 'Abraham', 'Moïse', 'David'].map((answer, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (answer === 'Noé') {
                                                    toast.success('✅ Bonne réponse !');
                                                } else {
                                                    toast.error('❌ Mauvaise réponse. C\'était Noé !');
                                                }
                                            }}
                                            className="p-3 rounded-xl bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/40 text-sm text-white transition-all"
                                        >
                                            {answer}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                    onClick={() => {
                                        onOpenChange(false);
                                        toast.info('Vous êtes sorti du jeu. Vous pouvez y retourner via le bouton 🎮');
                                    }}
                                >
                                    ← Sortir (retour au groupe)
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    onClick={() => {
                                        onOpenChange(false);
                                        setHasQuitGame(true);
                                        setActiveGameSession(prev => {
                                            if (!prev) return null;
                                            const remaining = prev.players.filter(p => p !== userId);
                                            if (remaining.length === 0) return null;
                                            return { ...prev, players: remaining };
                                        });
                                        toast.info('Vous avez quitté définitivement le jeu.');
                                    }}
                                >
                                    ✕ Quitter définitivement
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-5xl mb-4">🎮</p>
                            <p className="text-lg font-bold text-white mb-2">Aucun jeu en cours</p>
                            <p className="text-sm text-slate-400 mb-6">Lancez un jeu biblique pour tous les membres du groupe !</p>
                            <Button
                                className="bg-linear-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white"
                                onClick={() => {
                                    if (currentGroup) {
                                        setActiveGameSession({
                                            startedBy: userId,
                                            startedByName: userName || 'Vous',
                                            groupId: currentGroup.id,
                                            players: [userId],
                                        });
                                        supabase.from('prayer_group_messages').insert({
                                            group_id: currentGroup.id,
                                            user_id: userId,
                                            content: `🎮 **JEU DE GROUPE LANCÉ !** 🎮\n\n${userName || 'Un membre'} a lancé un jeu biblique !\n\nCliquez sur le bouton 🎮 clignotant pour rejoindre !`,
                                            type: 'text'
                                        });
                                        toast.success('Jeu lancé !');
                                    }
                                }}
                            >
                                🎮 Lancer un jeu
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
