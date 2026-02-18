'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Users, Play, Copy, Trophy, ClipboardPaste, ArrowLeft, RefreshCw, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { generateGameConfig } from '@/lib/game-data';
import './blinking-button.css';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const GAMES = [
    { id: 'bible_memory', name: 'Memory Versets', icon: '🧩', desc: 'Reconstituez le verset' },
    { id: 'quiz_duel', name: 'Quiz Duel', icon: '🧠', desc: 'Répondez le plus vite' },
    { id: 'who_am_i', name: 'Qui suis-je ?', icon: '❓', desc: 'Devinez le personnage' },
    { id: 'chrono', name: 'ChronoBible', icon: '⏳', desc: 'Classez les événements' },
    { id: 'word_search', name: 'Mots Cachés', icon: '🔍', desc: 'Trouvez tous les mots' },
];

export interface Player {
    id: string;
    user_id: string;
    display_name: string;
    is_host: boolean;
    score: number;
    progress: number;
    status: 'ready' | 'playing' | 'finished';
}

export interface Room {
    id: string;
    code: string;
    status: 'waiting' | 'playing' | 'finished';
    config: any;
    host_id: string;
    game_type: string;
    created_at: string;
}

interface MultiplayerLobbyProps {
    onStartGame: (room: Room, players: Player[], myPlayerId: string) => void;
    onBack: () => void;
    initialView?: 'menu' | 'join' | 'lobby' | 'groups';
}

interface JoinRequest {
    id: string;
    room_id: string;
    user_id: string;
    display_name: string;
    status: 'pending' | 'accepted' | 'rejected';
}

export function MultiplayerLobby({ onStartGame, onBack, initialView }: MultiplayerLobbyProps) {
    const [view, setView] = useState<'menu' | 'join' | 'lobby' | 'groups'>(initialView || 'menu');
    const [roomCode, setRoomCode] = useState('');
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
    const [selectedGame, setSelectedGame] = useState('bible_memory');
    const [publicRooms, setPublicRooms] = useState<(Room & { players: any[] })[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [rounds, setRounds] = useState(3);

    // Initial setup: get user profile and check URL code
    useEffect(() => {
        const init = async () => {
            // Check User
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                if (profile?.full_name) setUserName(profile.full_name);
                else setUserName(user.email?.split('@')[0] || 'Joueur');
            }

            // Check URL Code
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                if (code) {
                    setRoomCode(code.toUpperCase());
                    setView('join');
                }
            }
        };
        init();
    }, []);

    // Construct Room Subscription (Room Status)
    useEffect(() => {
        if (!currentRoom) return;

        const channel = supabase
            .channel(`room:${currentRoom.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'multiplayer_rooms',
                filter: `id=eq.${currentRoom.id}`
            }, (payload: any) => {
                const updatedRoom = payload.new as Room;
                setCurrentRoom(updatedRoom);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentRoom]);

    // Players Subscription
    useEffect(() => {
        if (!currentRoom) return;

        const fetchPlayers = async () => {
            const { data } = await supabase
                .from('multiplayer_players')
                .select('*')
                .eq('room_id', currentRoom.id);
            if (data) setPlayers(data as Player[]);
        };
        fetchPlayers();

        const channel = supabase
            .channel(`players:${currentRoom.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'multiplayer_players',
                filter: `room_id=eq.${currentRoom.id}`
            }, () => {
                fetchPlayers();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentRoom]);

    // Trigger Game Start when status changes
    useEffect(() => {
        if (currentRoom?.status === 'playing' && players.length > 0 && myPlayerId) {
            onStartGame(currentRoom, players, myPlayerId);
        }
    }, [currentRoom?.status, players, myPlayerId, onStartGame, currentRoom]);

    // Requests Subscription (for host)
    useEffect(() => {
        if (!currentRoom || !myPlayerId) return;
        const isHost = players.find(p => p.id === myPlayerId)?.is_host;
        if (!isHost) return;

        const fetchRequests = async () => {
            const { data } = await supabase
                .from('multiplayer_join_requests')
                .select('*')
                .eq('room_id', currentRoom.id)
                .eq('status', 'pending');
            if (data) setJoinRequests(data as JoinRequest[]);
        };
        fetchRequests();

        const channel = supabase
            .channel(`requests:${currentRoom.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'multiplayer_join_requests',
                filter: `room_id=eq.${currentRoom.id}`
            }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentRoom, myPlayerId, players]);

    // Acceptance Check (for joining players)
    useEffect(() => {
        if (view === 'lobby') return; // Already in

        const checkMyRequests = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: req } = await supabase
                .from('multiplayer_join_requests')
                .select('*, multiplayer_rooms(*)')
                .eq('user_id', user.id)
                .eq('status', 'accepted')
                .limit(1)
                .maybeSingle();

            if (req) {
                // Join the room
                const { data: player } = await supabase
                    .from('multiplayer_players')
                    .insert({
                        room_id: req.room_id,
                        user_id: user.id,
                        display_name: userName,
                        is_host: false
                    })
                    .select()
                    .single();

                // Clear request status
                await supabase.from('multiplayer_join_requests').delete().eq('id', req.id);

                if (player) {
                    setCurrentRoom(req.multiplayer_rooms as Room);
                    setMyPlayerId(player.id);
                    setView('lobby');
                    toast.success("Demande acceptée par l'hôte !");
                }
            }
        };

        const interval = setInterval(checkMyRequests, 3000);
        return () => clearInterval(interval);
    }, [view, userName]);

    const handleCreateRoom = async () => {
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Vous devez être connecté");
                setIsLoading(false);
                return;
            }

            const gameConfig = await generateGameConfig(selectedGame);
            // Include rounds in config
            const config = {
                ...gameConfig,
                totalRounds: rounds,
                currentRound: 1,
                roundId: Math.random().toString(36).substring(7) // To trigger updates
            };

            // Generate a unique code with retry mechanism
            let room: Room | null = null;
            let attempts = 0;
            const maxAttempts = 5;

            while (!room && attempts < maxAttempts) {
                // Always generate a NEW random code for creation, ignore the join input
                const code = Math.random().toString(36).substring(2, 6).toUpperCase();

                // Check if code exists first to avoid DB error log spam (optional but cleaner)
                const { data: existing } = await supabase
                    .from('multiplayer_rooms')
                    .select('id')
                    .eq('code', code)
                    .maybeSingle();

                if (existing) {
                    attempts++;
                    continue; // Try another random code
                }

                // Attempt insert
                const { data: newRoom, error } = await supabase
                    .from('multiplayer_rooms')
                    .insert({
                        code: code,
                        host_id: user.id,
                        game_type: selectedGame,
                        config: config
                    })
                    .select()
                    .single();

                if (error) {
                    // If manually entered code failed uniquely constraint
                    if (roomCode && error.code === '23505') {
                        toast.error("Ce code est déjà utilisé.");
                        setIsLoading(false);
                        return;
                    }
                    // Random collision, retry
                    if (error.code === '23505') { // Postgres unique violation code
                        attempts++;
                        continue;
                    }
                    throw error; // Other error
                }

                room = newRoom as Room;
            }

            if (!room) {
                throw new Error("Impossible de générer un code unique après plusieurs essais. Veuillez réessayer.");
            }

            const { data: player, error: pError } = await supabase
                .from('multiplayer_players')
                .insert({
                    room_id: room.id,
                    user_id: user.id,
                    display_name: userName,
                    is_host: true,
                    score: 0 // Init score
                })
                .select()
                .single();

            if (pError) throw pError;

            setCurrentRoom(room);
            setMyPlayerId(player.id);
            setView('lobby');

        } catch (e: any) {
            console.error(e);
            toast.error("Erreur de création: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!userName || !roomCode) return toast.error("Remplissez les champs");
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Find Room
            const { data: room, error: roomError } = await supabase
                .from('multiplayer_rooms')
                .select('*')
                .eq('code', roomCode.toUpperCase())
                .eq('status', 'waiting')
                .single();

            if (roomError || !room) throw new Error("Code invalide ou partie déjà commencée");

            // 2. Add Player
            const { data: player, error: playerError } = await supabase
                .from('multiplayer_players')
                .insert({
                    room_id: room.id,
                    user_id: user?.id || null,
                    display_name: userName,
                    is_host: false
                })
                .select()
                .single();

            if (playerError) throw playerError;

            setCurrentRoom(room as Room);
            setMyPlayerId(player.id);
            setView('lobby');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = async () => {
        if (!currentRoom) return;
        await supabase
            .from('multiplayer_rooms')
            .update({ status: 'playing' })
            .eq('id', currentRoom.id);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setRoomCode(text.trim().toUpperCase().slice(0, 4));
                toast.success("Code collé !");
            }
        } catch (e) {
            toast.error("Impossible de lire le presse-papier");
        }
    };

    const fetchPublicRooms = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('multiplayer_rooms')
            .select('*, multiplayer_players(*)')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            setPublicRooms(data.map(r => ({ ...r, players: r.multiplayer_players || [] })));
        }
        setIsLoading(false);
    };

    const handleRequestToJoin = async (room: Room) => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Connectez-vous pour rejoindre");

            const { error } = await supabase
                .from('multiplayer_join_requests')
                .insert({
                    room_id: room.id,
                    user_id: user.id,
                    display_name: userName,
                    status: 'pending'
                });

            if (error) throw error;
            toast.success("Demande envoyée à l'hôte !");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
        await supabase
            .from('multiplayer_join_requests')
            .update({ status })
            .eq('id', requestId);

        if (status === 'accepted') toast.success("Joueur accepté !");
        else toast.info("Demande refusée");

        setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    };

    if (view === 'menu') {
        return (
            <div className="w-full max-w-md mx-auto space-y-6">
                <div className="text-center">
                    <h2 className="text-3xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Duel Biblique</h2>
                    <p className="text-slate-400">Affrontez vos amis en temps réel</p>
                </div>

                {/* Join via code - prominent at top */}
                <Card className="bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border-indigo-500/30 hover:border-indigo-500/50 transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl shrink-0">🔑</div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white text-sm">Rejoindre via un code</h3>
                            <p className="text-xs text-slate-400">Entrez le code à 4 lettres d'un ami</p>
                        </div>
                        <Button variant="outline" className="h-10 px-4 border-indigo-500/30 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 font-bold text-xs" onClick={() => setView('join')}>
                            Rejoindre
                        </Button>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                    {GAMES.map(g => (
                        <div
                            key={g.id}
                            onClick={() => setSelectedGame(g.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedGame === g.id ? 'bg-indigo-600/20 border-indigo-500 scale-[1.02]' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                        >
                            <div className="text-2xl mb-2">{g.icon}</div>
                            <div className="font-bold text-sm">{g.name}</div>
                            <div className="text-[10px] text-slate-400">{g.desc}</div>
                        </div>
                    ))}
                </div>

                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-lg">Créer une partie</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Votre Pseudo</label>
                            <Input
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="bg-black/20 border-white/10"
                                placeholder="Gédéon"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                                Nombre de manches
                                <span className="text-indigo-400">{rounds}</span>
                            </label>
                            <div className="flex gap-2">
                                {[1, 3, 5, 10].map(n => (
                                    <Button
                                        key={n}
                                        variant={rounds === n ? "default" : "outline"}
                                        onClick={() => setRounds(n)}
                                        className={`flex-1 h-8 text-xs ${rounds === n ? 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500' : 'bg-black/20 border-white/10 hover:bg-white/10 text-slate-400'}`}
                                    >
                                        {n}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Button className="w-full bg-indigo-600 hover:bg-indigo-500 h-11" onClick={handleCreateRoom} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            Créer Salon ({GAMES.find(g => g.id === selectedGame)?.name})
                        </Button>
                    </CardContent>
                </Card>


            </div>
        );
    }

    if (view === 'groups') {
        return (
            <div className="w-full max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" onClick={() => setView('menu')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Menu
                    </Button>
                    <h2 className="text-xl font-bold">Groupes de Jeu</h2>
                    <Button variant="outline" size="sm" onClick={fetchPublicRooms} disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                        Actualiser
                    </Button>
                </div>

                <div className="space-y-8">
                    {/* Active Rooms */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Parties en cours
                        </h3>
                        {publicRooms.filter(r => r.status !== 'finished').length === 0 ? (
                            <p className="text-center py-8 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                Aucune partie publique active.
                            </p>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {publicRooms.filter(r => r.status !== 'finished').map(r => (
                                    <Card key={r.id} className="bg-white/5 border-white/10 overflow-hidden group hover:border-indigo-500/50 transition-all">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <Badge className="mb-1">{GAMES.find(g => g.id === r.game_type)?.name}</Badge>
                                                    <div className="text-lg font-bold flex items-center gap-2">
                                                        {r.status === 'playing' ? 'En cours' : 'Attente'}
                                                        <span className="text-xs font-mono text-slate-500">#{r.code}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center text-xs text-slate-400">
                                                        <Users className="w-3 h-3 mr-1" /> {r.players.length}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                className="w-full mt-2 h-9 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/40"
                                                onClick={() => {
                                                    if (r.status === 'playing') handleRequestToJoin(r);
                                                    else {
                                                        setRoomCode(r.code);
                                                        setView('join');
                                                    }
                                                }}
                                            >
                                                {r.status === 'playing' ? 'Demander à rejoindre' : 'Rejoindre tout de suite'}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Finished Rooms */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-500" /> Archives / Terminées
                        </h3>
                        <div className="space-y-3">
                            {publicRooms.filter(r => r.status === 'finished').length === 0 ? (
                                <p className="text-center py-4 text-slate-600 text-xs italic">
                                    Historique vide.
                                </p>
                            ) : (
                                publicRooms.filter(r => r.status === 'finished').map(r => (
                                    <Card key={r.id} className="bg-white/5 border-white/5 p-4 rounded-xl border border-white/5">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-bold">{GAMES.find(g => g.id === r.game_type)?.name}</div>
                                                <div className="text-[10px] text-slate-500 uppercase font-mono">
                                                    Terminé le {format(new Date(r.created_at), "dd MMM HH:mm", { locale: fr })}
                                                </div>
                                            </div>
                                            <div className="flex -space-x-2">
                                                {r.players.slice(0, 3).map((p: any) => (
                                                    <div key={p.id} className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-[#0B0E14] flex items-center justify-center text-[10px] font-bold">
                                                        {p.display_name.charAt(0)}
                                                    </div>
                                                ))}
                                                {r.players.length > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#0B0E14] flex items-center justify-center text-[10px]">
                                                        +{r.players.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-amber-400 text-xs font-bold">
                                                    Gagnant: {r.players.sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.display_name || '-'}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    Scores: {r.players.map((p: any) => p.score).join(', ')}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'join') {
        return (
            <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10 p-6">
                <CardHeader>
                    <CardTitle className="text-xl text-center text-white">Rejoindre une partie</CardTitle>
                    <CardDescription className="text-center text-slate-400">
                        Entrez le code à 4 lettres communiqué par l'hôte.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Votre Pseudo</label>
                        <Input
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="bg-black/20 border-white/10"
                            placeholder="Votre Nom"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Code de salle</label>
                        <Input
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            className="bg-black/20 border-white/10 font-mono tracking-widest uppercase text-center text-lg h-12"
                            placeholder="ABCD"
                            maxLength={4}
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={handlePaste} className="w-full text-xs h-8 mb-2 border-white/10 bg-transparent hover:bg-white/5">
                        <ClipboardPaste className="w-3 h-3 mr-2" /> Coller le code
                    </Button>

                    <Button onClick={handleJoinRoom} disabled={isLoading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-500">
                        {isLoading ? <Loader2 className="animate-spin" /> : "Rejoindre"}
                    </Button>
                    <Button variant="ghost" onClick={() => setView('menu')} className="w-full">
                        Retour
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (view === 'lobby' && currentRoom) {
        return (
            <Card className="w-full max-w-md mx-auto bg-white/5 border-white/10 backdrop-blur-sm shadow-xl p-6">
                <CardHeader>
                    <CardTitle className="text-2xl text-center text-white flex items-center justify-center gap-2">
                        <span className="font-mono text-cyan-400 text-3xl tracking-widest">{currentRoom.code}</span>
                    </CardTitle>
                    <CardDescription className="text-center text-slate-400">
                        Partagez ce code avec vos amis pour qu'ils rejoignent
                    </CardDescription>
                    <div className="flex justify-center mt-2">
                        <Badge variant="outline" className="border-indigo-500/50 text-indigo-400">
                            Jeu: {GAMES.find(g => g.id === currentRoom.game_type)?.name || 'Inconnu'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-black/20 rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                        <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Users className="h-4 w-4" /> Joueurs ({players.length})
                        </h4>
                        {players.map((p) => (
                            <div key={p.id} className="flex items-center justify-between bg-white/5 p-2 rounded">
                                <span className="flex items-center gap-2 text-white">
                                    <User className="h-4 w-4 text-indigo-400" />
                                    {p.display_name} {p.is_host && <Badge variant="secondary" className="text-xs py-0 h-5">Hôte</Badge>}
                                </span>
                                {p.id === myPlayerId && <Badge className="bg-green-500/20 text-green-400">Moi</Badge>}
                            </div>
                        ))}
                    </div>

                    {/* Pending Requests for Host */}
                    {joinRequests.length > 0 && players.find(p => p.id === myPlayerId)?.is_host && (
                        <div className="space-y-3 border-t border-white/10 pt-4">
                            <h4 className="text-xs font-bold text-amber-500 uppercase flex items-center gap-2 animate-pulse">
                                Demandes en attente ({joinRequests.length})
                            </h4>
                            {joinRequests.map(req => (
                                <div key={req.id} className="flex items-center justify-between bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                    <span className="text-sm text-amber-200 font-bold">{req.display_name}</span>
                                    <div className="flex gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-green-500 hover:bg-green-500/20"
                                            onClick={() => handleAnswerRequest(req.id, 'accepted')}
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-red-500 hover:bg-red-500/20"
                                            onClick={() => handleAnswerRequest(req.id, 'rejected')}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        {players.find(p => p.id === myPlayerId)?.is_host ? (
                            <Button onClick={handleStartGame} className="w-full h-12 text-lg bg-green-600 hover:bg-green-500 animate-pulse">
                                <Play className="mr-2 h-5 w-5" /> Lancer la partie
                            </Button>
                        ) : (
                            <div className="text-center py-2 text-indigo-300 animate-pulse">
                                En attente de l'hôte...
                            </div>
                        )}
                        <Button variant="ghost" onClick={onBack} className="w-full text-slate-400">
                            Quitter
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return null;
}
