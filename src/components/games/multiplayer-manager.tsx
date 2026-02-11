'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MultiplayerLobby, Room, Player } from './multiplayer-lobby';
import { BibleMemoryGame } from './bible-memory-game';
import { QuizDuelGame } from './quiz-duel-game';
import { WhoAmIGame } from './who-am-i-game';
import { ChronoGame } from './chrono-game';
import { WordSearchGame } from './word-search-game';
import { toast } from 'sonner';
import { Check, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateGameConfig } from '@/lib/game-data';

interface MultiplayerManagerProps {
    onBack: () => void;
    initialView?: 'menu' | 'join' | 'lobby' | 'groups';
}

export function MultiplayerManager({ onBack, initialView }: MultiplayerManagerProps) {
    const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);

    const handleStartGame = (room: Room, initialPlayers: Player[], myId: string) => {
        setCurrentRoom(room);
        setPlayers(initialPlayers);
        setMyPlayerId(myId);
        setGameState('playing');
    };

    // Subscriptions for active game state
    useEffect(() => {
        if (gameState !== 'playing' || !currentRoom) return;

        // Subscribe to Player Updates (Score, Progress)
        const channel = supabase
            .channel(`game_players:${currentRoom.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'multiplayer_players',
                filter: `room_id=eq.${currentRoom.id}`
            }, (payload: any) => {
                setPlayers(current =>
                    current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
                );
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [gameState, currentRoom]);

    // Host Request Listening (during gameplay)
    useEffect(() => {
        if (gameState !== 'playing' || !currentRoom || !myPlayerId) return;
        const isHost = players.find(p => p.id === myPlayerId)?.is_host;
        if (!isHost) return;

        const fetchRequests = async () => {
            const { data } = await supabase
                .from('multiplayer_join_requests')
                .select('*')
                .eq('room_id', currentRoom.id)
                .eq('status', 'pending');
            if (data && data.length > 0) {
                setPendingRequests(data);
                toast.info(`${data.length} nouveau(x) joueur(s) veulent rejoindre !`, {
                    duration: 5000,
                    id: 'join-request-toast'
                });
            } else {
                setPendingRequests([]);
            }
        };

        const channel = supabase
            .channel(`ingame_requests:${currentRoom.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'multiplayer_join_requests',
                filter: `room_id=eq.${currentRoom.id}`
            }, () => {
                fetchRequests();
            })
            .subscribe();

        fetchRequests();
        return () => { supabase.removeChannel(channel); };
    }, [gameState, currentRoom, myPlayerId, players]);

    // Auto-advance Round Logic (Host Only)
    useEffect(() => {
        if (gameState !== 'playing' || !currentRoom || !myPlayerId) return;

        const hostPlayer = players.find(p => p.id === myPlayerId);
        if (!hostPlayer?.is_host) return;

        // Check if all players are finished
        const allFinished = players.length > 0 && players.every(p => p.status === 'finished');

        // Check round info
        const currentRound = currentRoom.config.currentRound || 1;
        const totalRounds = currentRoom.config.totalRounds || 1;

        if (allFinished && currentRound < totalRounds) {
            toast.success(`Manche terminée ! La manche ${currentRound + 1} va commencer dans 5s...`, {
                id: 'auto-next-round', // Id ensures we don't spam toasts
                duration: 4000
            });

            const timer = setTimeout(() => {
                handleNextRound();
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [players, gameState, currentRoom, myPlayerId]);

    const handleProgress = async (pct: number) => {
        if (!myPlayerId) return;
        // Throttle updates? For now, raw.
        await supabase
            .from('multiplayer_players')
            .update({ progress: pct })
            .eq('id', myPlayerId);
    };

    const handleComplete = async (scoreVal: number) => {
        if (!myPlayerId) return;

        // Fetch current score first to add to it (cumulative)
        const { data: current, error } = await supabase.from('multiplayer_players').select('score').eq('id', myPlayerId).single();
        const currentScore = current?.score || 0;

        await supabase
            .from('multiplayer_players')
            .update({
                status: 'finished',
                progress: 100,
                score: currentScore + scoreVal // Cumulative score
            })
            .eq('id', myPlayerId);
        toast.success("Partie terminée !");
    };

    const handleNextRound = async () => {
        if (!currentRoom || !myPlayerId) return;

        // 1. Generate new game data
        const newGameConfig = await generateGameConfig(currentRoom.game_type);

        // 2. Prepare update
        const nextRound = (currentRoom.config.currentRound || 1) + 1;
        const newConfig = {
            ...currentRoom.config,
            ...newGameConfig,
            currentRound: nextRound,
            roundId: Math.random().toString(36).substring(7)
        };

        // 3. Reset players status for everyone
        await supabase.from('multiplayer_players')
            .update({ status: 'playing', progress: 0 })
            .eq('room_id', currentRoom.id);

        // 4. Update room config
        await supabase.from('multiplayer_rooms')
            .update({ config: newConfig })
            .eq('id', currentRoom.id);

        toast.success(`Manche ${nextRound} lancée !`);
    };

    if (gameState === 'lobby') {
        return <MultiplayerLobby onStartGame={handleStartGame} onBack={onBack} />;
    }

    if (gameState === 'playing' && currentRoom) {
        const isHost = players.find(p => p.id === myPlayerId)?.is_host || false;

        const roundKey = currentRoom.config.roundId || 'initial';
        const commonProps = {
            onBack: () => {
                onBack(); // Return to lobby
            },
            mode: 'multiplayer' as const,
            players,
            currentUserId: myPlayerId || '',
            onProgress: handleProgress,
            onComplete: handleComplete,
            isHost,
            roundInfo: {
                current: currentRoom.config.currentRound || 1,
                total: currentRoom.config.totalRounds || 1
            },
            onNextRound: handleNextRound
        };

        // Switch based on game type
        let gameComponent = null;
        switch (currentRoom.game_type) {
            case 'quiz_duel':
                // @ts-ignore
                gameComponent = <QuizDuelGame key={roundKey} {...commonProps} questions={currentRoom.config.questions || []} />;
                break;
            case 'who_am_i':
                // @ts-ignore
                gameComponent = <WhoAmIGame key={roundKey} {...commonProps} characters={currentRoom.config.characters || []} />;
                break;
            case 'chrono':
                // @ts-ignore
                gameComponent = <ChronoGame key={roundKey} {...commonProps} events={currentRoom.config.events || []} />;
                break;
            case 'word_search':
                // @ts-ignore
                gameComponent = <WordSearchGame key={roundKey} {...commonProps} grid={currentRoom.config.grid || []} words={currentRoom.config.words || []} />;
                break;
            case 'bible_memory':
            default:
                // @ts-ignore
                gameComponent = <BibleMemoryGame key={roundKey} {...commonProps} initialVerse={currentRoom.config.verse} />;
                break;
        }

        return (
            <div className="relative w-full h-full">
                {gameComponent}
                {/* Host Request Overlay */}
                {pendingRequests.length > 0 && isHost && (
                    <div className="fixed bottom-20 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-80">
                        <div className="bg-indigo-600 border border-white/20 p-4 rounded-xl shadow-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase text-white flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Demande de rejoindre
                                </h4>
                                <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                        <span className="text-sm font-bold text-white truncate mr-2">{req.display_name}</span>
                                        <div className="flex gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-green-400 hover:bg-green-400/20"
                                                onClick={async () => {
                                                    await supabase.from('multiplayer_join_requests').update({ status: 'accepted' }).eq('id', req.id);
                                                    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                                                }}
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-red-400 hover:bg-red-400/20"
                                                onClick={async () => {
                                                    await supabase.from('multiplayer_join_requests').update({ status: 'rejected' }).eq('id', req.id);
                                                    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
