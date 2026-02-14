'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserPlus, UserCheck, UserX, Search, Users, X,
    Loader2, MessageCircle, ChevronRight, Heart, Clock,
    Check, ArrowLeft, Sparkles, MapPin, Church, Globe,
    MoreHorizontal, UserMinus, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { notifyFriendRequestAccepted } from '@/lib/notifications';

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    city?: string;
    church?: string;
    is_online?: boolean;
    last_seen?: string;
    mutualFriends?: number;
    mutualFriendNames?: string[];
}

interface FriendRequest {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
    sender?: UserProfile;
    receiver?: UserProfile;
}

interface Friendship {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: string;
}

interface FriendSystemProps {
    userId: string;
    userName: string;
    onClose: () => void;
    onStartChat?: (userId: string, userName: string) => void;
}

export function FriendSystem({ userId, userName, onClose, onStartChat }: FriendSystemProps) {
    const [activeTab, setActiveTab] = useState<'find' | 'requests' | 'friends'>('find');
    const [searchQuery, setSearchQuery] = useState('');
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const [sentRequests, setSentRequests] = useState<string[]>([]);
    const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
    const [friendIds, setFriendIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
    const [allFriendships, setAllFriendships] = useState<Friendship[]>([]);

    useEffect(() => {
        loadData();

        // Subscribe to new user profiles in realtime
        const profileSub = supabase
            .channel(`new_profiles_${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'profiles',
            }, (payload) => {
                const newUser = payload.new as UserProfile;
                if (newUser.id !== userId) {
                    setAllUsers(prev => {
                        if (prev.some(u => u.id === newUser.id)) return prev;
                        return [...prev, {
                            id: newUser.id,
                            full_name: newUser.full_name,
                            avatar_url: newUser.avatar_url,
                            city: newUser.city,
                            church: newUser.church,
                            is_online: true,
                        }].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
                    });
                }
            })
            .subscribe();

        return () => {
            profileSub.unsubscribe();
        };
    }, [userId]);

    const loadData = async () => {
        setIsLoading(true);
        await Promise.all([
            loadAllUsers(),
            loadFriends(),
            loadSentRequests(),
            loadReceivedRequests(),
            loadAllFriendships()
        ]);
        setIsLoading(false);
    };

    const loadAllUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, city, church, is_online, last_seen')
                .neq('id', userId)
                .order('full_name');

            if (!error && data) {
                setAllUsers(data);
            }
        } catch (e) {
            console.error('Error loading users:', e);
        }
    };

    const loadAllFriendships = async () => {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('id, sender_id, receiver_id, status')
                .eq('status', 'accepted');

            if (!error && data) {
                setAllFriendships(data);
            }
        } catch (e) {
            console.error('Error loading all friendships:', e);
        }
    };

    const loadFriends = async () => {
        try {
            const { data: friendships, error } = await supabase
                .from('friendships')
                .select('*')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .eq('status', 'accepted');

            if (error) {
                console.log('Friendships table may not exist:', error.message);
                setFriends([]);
                setFriendIds([]);
                return;
            }

            if (friendships && friendships.length > 0) {
                const ids = friendships.map((f: Friendship) =>
                    f.sender_id === userId ? f.receiver_id : f.sender_id
                );
                setFriendIds(ids);

                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, city, church, is_online, last_seen')
                    .in('id', ids);

                setFriends(profiles || []);
            } else {
                setFriends([]);
                setFriendIds([]);
            }
        } catch (e) {
            console.error('Error loading friends:', e);
            setFriends([]);
            setFriendIds([]);
        }
    };

    const loadSentRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('receiver_id')
                .eq('sender_id', userId)
                .eq('status', 'pending');

            if (!error && data) {
                setSentRequests(data.map(r => r.receiver_id));
            }
        } catch (e) {
            console.error('Error loading sent requests:', e);
        }
    };

    const loadReceivedRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('*')
                .eq('receiver_id', userId)
                .eq('status', 'pending');

            if (error) {
                setReceivedRequests([]);
                return;
            }

            if (data && data.length > 0) {
                const senderIds = data.map(r => r.sender_id);
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, city, church')
                    .in('id', senderIds);

                const requestsWithProfiles = data.map(r => ({
                    ...r,
                    sender: profiles?.find(p => p.id === r.sender_id) || null
                }));

                setReceivedRequests(requestsWithProfiles);
            } else {
                setReceivedRequests([]);
            }
        } catch (e) {
            console.error('Error loading received requests:', e);
            setReceivedRequests([]);
        }
    };

    // Calculate mutual friends for a given user
    const getMutualFriends = (targetUserId: string): { count: number; names: string[] } => {
        // Get friends of target user from all friendships
        const targetFriendIds = allFriendships
            .filter(f => f.sender_id === targetUserId || f.receiver_id === targetUserId)
            .map(f => f.sender_id === targetUserId ? f.receiver_id : f.sender_id);

        // Find intersection with current user's friends
        const mutual = friendIds.filter(id => targetFriendIds.includes(id));
        const names = mutual
            .map(id => allUsers.find(u => u.id === id)?.full_name || friends.find(f => f.id === id)?.full_name || '')
            .filter(Boolean)
            .slice(0, 3);

        return { count: mutual.length, names };
    };

    // Smart suggestions: friends of friends who aren't already friends
    const suggestedUsers = useMemo(() => {
        const friendsOfFriends = new Map<string, number>();

        // For each friend, find their friends
        friendIds.forEach(friendId => {
            const theirFriends = allFriendships
                .filter(f => f.sender_id === friendId || f.receiver_id === friendId)
                .map(f => f.sender_id === friendId ? f.receiver_id : f.sender_id);

            theirFriends.forEach(id => {
                if (id !== userId && !friendIds.includes(id) && !sentRequests.includes(id)) {
                    friendsOfFriends.set(id, (friendsOfFriends.get(id) || 0) + 1);
                }
            });
        });

        // Sort by number of mutual friends (most mutual first)
        const sorted = Array.from(friendsOfFriends.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => id);

        // Get profiles for suggested users, then add remaining random users
        const suggestedProfiles = sorted
            .map(id => allUsers.find(u => u.id === id))
            .filter(Boolean) as UserProfile[];

        // If not enough suggestions from friends-of-friends, add random users
        if (suggestedProfiles.length < 8) {
            const remaining = allUsers
                .filter(u =>
                    !friendIds.includes(u.id) &&
                    !sentRequests.includes(u.id) &&
                    !suggestedProfiles.some(s => s.id === u.id)
                )
                .slice(0, 8 - suggestedProfiles.length);
            suggestedProfiles.push(...remaining);
        }

        // Enrich with mutual friend counts
        return suggestedProfiles.slice(0, 8).map(u => {
            const mutual = getMutualFriends(u.id);
            return { ...u, mutualFriends: mutual.count, mutualFriendNames: mutual.names };
        });
    }, [allUsers, friendIds, sentRequests, allFriendships]);

    const sendFriendRequest = async (targetUserId: string) => {
        try {
            const { error } = await supabase
                .from('friendships')
                .insert({
                    sender_id: userId,
                    receiver_id: targetUserId,
                    status: 'pending'
                });

            if (error) {
                if (error.message.includes('duplicate') || error.message.includes('unique')) {
                    toast.info("Demande déjà envoyée");
                    return;
                }
                throw error;
            }

            setSentRequests(prev => [...prev, targetUserId]);
            toast.success("Demande d'ami envoyée! 🤝");
        } catch (e: any) {
            console.error('Error sending friend request:', e);
            toast.error("Erreur: " + (e.message || "Impossible d'envoyer la demande"));
        }
    };

    const respondToRequest = async (requestId: string, senderId: string, accept: boolean) => {
        try {
            const { error } = await supabase
                .from('friendships')
                .update({ status: accept ? 'accepted' : 'rejected' })
                .eq('id', requestId);

            if (error) throw error;

            setReceivedRequests(prev => prev.filter(r => r.id !== requestId));

            if (accept) {
                setFriendIds(prev => [...prev, senderId]);
                loadFriends();

                // Notify the sender that their request was accepted
                notifyFriendRequestAccepted({
                    userId: senderId,
                    accepterId: userId,
                    accepterName: userName,
                }).catch(console.error);

                toast.success("Ami ajouté! 🎉");
            } else {
                toast.info("Demande refusée");
            }
        } catch (e: any) {
            console.error('Error responding to request:', e);
            toast.error("Erreur: " + e.message);
        }
    };

    const removeFriend = async (friendId: string) => {
        try {
            const { error } = await supabase
                .from('friendships')
                .delete()
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`);

            if (error) throw error;

            setFriendIds(prev => prev.filter(id => id !== friendId));
            setFriends(prev => prev.filter(f => f.id !== friendId));
            setSelectedProfile(null);
            toast.success("Ami retiré");
        } catch (e: any) {
            console.error('Error removing friend:', e);
            toast.error("Erreur: " + e.message);
        }
    };

    // Filter users based on search
    const filteredUsers = useMemo(() => {
        return allUsers.filter(u => {
            if (friendIds.includes(u.id)) return false;
            const name = (u.full_name || '').toLowerCase();
            const city = (u.city || '').toLowerCase();
            const church = (u.church || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            return query ? (name.includes(query) || city.includes(query) || church.includes(query)) : true;
        }).map(u => {
            const mutual = getMutualFriends(u.id);
            return { ...u, mutualFriends: mutual.count, mutualFriendNames: mutual.names };
        });
    }, [allUsers, friendIds, searchQuery, allFriendships]);

    // Online friends first
    const sortedFriends = useMemo(() => {
        return [...friends].sort((a, b) => {
            if (a.is_online && !b.is_online) return -1;
            if (!a.is_online && b.is_online) return 1;
            return (a.full_name || '').localeCompare(b.full_name || '');
        });
    }, [friends]);

    const onlineFriendsCount = friends.filter(f => f.is_online).length;

    const getStatusButton = (targetId: string) => {
        if (friendIds.includes(targetId)) {
            return (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                    <UserCheck className="h-3 w-3" /> Ami
                </Badge>
            );
        }
        if (sentRequests.includes(targetId)) {
            return (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                    <Clock className="h-3 w-3" /> En attente
                </Badge>
            );
        }
        return (
            <Button
                size="sm"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 gap-1 h-8 px-3"
                onClick={(e) => {
                    e.stopPropagation();
                    sendFriendRequest(targetId);
                }}
            >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="text-xs">Ajouter</span>
            </Button>
        );
    };

    // Mutual friends text
    const getMutualText = (count: number, names: string[]) => {
        if (count === 0) return null;
        if (count === 1 && names.length > 0) return `${names[0]} est aussi son ami(e)`;
        if (count === 2 && names.length >= 2) return `${names[0]} et ${names[1]} sont aussi ses amis`;
        if (count > 2 && names.length > 0) return `${names[0]} et ${count - 1} autre(s) ami(s) en commun`;
        return `${count} ami(s) en commun`;
    };

    // Profile Card Component
    const ProfileCard = ({ profile }: { profile: UserProfile }) => {
        const mutual = getMutualFriends(profile.id);
        const isFriend = friendIds.includes(profile.id);
        const isPending = sentRequests.includes(profile.id);

        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setSelectedProfile(null)}
                >
                    <motion.div
                        initial={{ y: 20 }}
                        animate={{ y: 0 }}
                        className="w-full max-w-sm bg-[#1a1f2e] rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cover/Banner */}
                        <div className="h-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 text-white/70 hover:text-white h-8 w-8 rounded-full bg-black/20"
                                onClick={() => setSelectedProfile(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Avatar */}
                        <div className="flex justify-center -mt-12 relative z-10">
                            <div className="relative">
                                <Avatar className="h-24 w-24 border-4 border-[#1a1f2e]">
                                    <AvatarImage src={profile.avatar_url || undefined} />
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                                        {profile.full_name?.[0] || '?'}
                                    </AvatarFallback>
                                </Avatar>
                                {profile.is_online && (
                                    <div className="absolute bottom-1 right-1 h-5 w-5 bg-green-500 rounded-full border-3 border-[#1a1f2e]" />
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="px-6 pt-3 pb-6 text-center">
                            <h3 className="text-xl font-bold text-white">{profile.full_name || 'Utilisateur'}</h3>
                            <p className="text-sm text-slate-400 mt-1">
                                {profile.is_online ? (
                                    <span className="text-green-400">● En ligne maintenant</span>
                                ) : profile.last_seen ? (
                                    `Vu ${formatDistanceToNow(new Date(profile.last_seen), { addSuffix: true, locale: fr })}`
                                ) : 'Membre de la communauté'}
                            </p>

                            {/* Location & Church */}
                            <div className="flex items-center justify-center gap-4 mt-3">
                                {profile.city && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <MapPin className="h-3 w-3" />
                                        {profile.city}
                                    </div>
                                )}
                                {profile.church && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Church className="h-3 w-3" />
                                        {profile.church}
                                    </div>
                                )}
                            </div>

                            {/* Mutual Friends */}
                            {mutual.count > 0 && (
                                <div className="mt-3 flex items-center justify-center gap-2">
                                    <div className="flex -space-x-2">
                                        {mutual.names.slice(0, 3).map((name, i) => (
                                            <div
                                                key={i}
                                                className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#1a1f2e]"
                                            >
                                                {name[0]}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-xs text-indigo-400 font-medium">
                                        {getMutualText(mutual.count, mutual.names)}
                                    </span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-5">
                                {isFriend ? (
                                    <>
                                        <Button
                                            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 gap-2"
                                            onClick={() => {
                                                if (onStartChat) {
                                                    onStartChat(profile.id, profile.full_name || 'Ami');
                                                }
                                                setSelectedProfile(null);
                                            }}
                                        >
                                            <MessageCircle className="h-4 w-4" />
                                            Envoyer un message
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="rounded-xl bg-white/5 h-10 w-10">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-[#1a1f2e] border-white/10">
                                                <DropdownMenuItem
                                                    onClick={() => removeFriend(profile.id)}
                                                    className="text-red-400 focus:text-red-400"
                                                >
                                                    <UserMinus className="h-4 w-4 mr-2" />
                                                    Retirer des amis
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                ) : isPending ? (
                                    <Button disabled className="flex-1 rounded-xl bg-amber-600/20 text-amber-400 gap-2">
                                        <Clock className="h-4 w-4" />
                                        Demande envoyée
                                    </Button>
                                ) : (
                                    <Button
                                        className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 gap-2"
                                        onClick={() => {
                                            sendFriendRequest(profile.id);
                                        }}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Ajouter en ami
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-400">Chargement...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0F1219]">
            {/* Profile Card Modal */}
            {selectedProfile && <ProfileCard profile={selectedProfile} />}

            {/* Header */}
            <header className="px-4 pt-12 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">Retrouver un Ami</h1>
                        <p className="text-xs text-slate-500">
                            {friends.length} ami(s) • {onlineFriendsCount} en ligne
                        </p>
                    </div>
                    {receivedRequests.length > 0 && (
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <Button
                                size="sm"
                                className="rounded-xl bg-red-500 hover:bg-red-400 gap-1 h-8"
                                onClick={() => setActiveTab('requests')}
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                <span className="text-xs font-bold">{receivedRequests.length}</span>
                            </Button>
                        </motion.div>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Rechercher par nom, ville, église..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-white/5 border-white/10"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost" size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                            onClick={() => setSearchQuery('')}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-4">
                    <TabsList className="w-full bg-white/5 p-1 rounded-xl">
                        <TabsTrigger value="find" className="flex-1 data-[state=active]:bg-indigo-600 rounded-lg text-xs font-bold gap-1">
                            <Globe className="h-3.5 w-3.5" />
                            Découvrir
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="flex-1 data-[state=active]:bg-indigo-600 rounded-lg text-xs font-bold gap-1 relative">
                            <UserPlus className="h-3.5 w-3.5" />
                            Demandes
                            {receivedRequests.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                                    {receivedRequests.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="friends" className="flex-1 data-[state=active]:bg-indigo-600 rounded-lg text-xs font-bold gap-1">
                            <Heart className="h-3.5 w-3.5" />
                            Amis ({friends.length})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </header>

            <ScrollArea className="flex-1">
                <div className="pb-32">
                    {/* ================== FIND TAB ================== */}
                    {activeTab === 'find' && (
                        <div className="px-4 py-4 space-y-5">
                            {/* Facebook-like Suggestions */}
                            {!searchQuery && suggestedUsers.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                        Personnes que vous connaissez peut-être
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {suggestedUsers.map(u => (
                                            <motion.div
                                                key={u.id}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="bg-white/5 rounded-2xl overflow-hidden border border-white/5 hover:border-indigo-500/30 transition-all"
                                            >
                                                {/* Mini banner */}
                                                <div className="h-12 bg-gradient-to-r from-indigo-600/30 to-purple-600/30" />
                                                <div className="px-3 pb-3 -mt-6">
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={() => setSelectedProfile(u)}
                                                    >
                                                        <Avatar className="h-12 w-12 border-2 border-[#0F1219] mb-2">
                                                            <AvatarImage src={u.avatar_url || undefined} />
                                                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                                                                {u.full_name?.[0] || '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <p className="text-sm font-bold text-white truncate">{u.full_name || 'Utilisateur'}</p>
                                                    </div>

                                                    {/* Mutual friends indicator */}
                                                    {u.mutualFriends && u.mutualFriends > 0 ? (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <div className="flex -space-x-1">
                                                                {(u.mutualFriendNames || []).slice(0, 2).map((name, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="h-4 w-4 rounded-full bg-indigo-500 flex items-center justify-center text-[7px] text-white font-bold border border-[#0F1219]"
                                                                    >
                                                                        {name[0]}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <span className="text-[10px] text-indigo-400">{u.mutualFriends} ami(s) en commun</span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-500 mt-1">
                                                            {u.city || u.church || 'Membre'}
                                                        </p>
                                                    )}

                                                    <Button
                                                        size="sm"
                                                        className="w-full mt-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 h-8 text-xs gap-1"
                                                        onClick={() => sendFriendRequest(u.id)}
                                                        disabled={sentRequests.includes(u.id)}
                                                    >
                                                        {sentRequests.includes(u.id) ? (
                                                            <><Clock className="h-3 w-3" /> Envoyé</>
                                                        ) : (
                                                            <><UserPlus className="h-3 w-3" /> Ajouter</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* All Users List */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    {searchQuery ? `Résultats (${filteredUsers.length})` : `Tous les membres (${filteredUsers.length})`}
                                </h3>
                                <div className="space-y-1">
                                    {filteredUsers.map(u => (
                                        <motion.div
                                            key={u.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() => setSelectedProfile(u)}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-11 w-11 border border-white/10">
                                                    <AvatarImage src={u.avatar_url || undefined} />
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm">
                                                        {u.full_name?.[0] || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {u.is_online && (
                                                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-white truncate">{u.full_name || 'Utilisateur'}</p>
                                                {u.mutualFriends && u.mutualFriends > 0 ? (
                                                    <p className="text-[11px] text-indigo-400">
                                                        {u.mutualFriends} ami(s) en commun
                                                    </p>
                                                ) : (
                                                    <p className="text-[11px] text-slate-500">
                                                        {u.city || u.church || (u.is_online ? '🟢 En ligne' : 'Membre')}
                                                    </p>
                                                )}
                                            </div>
                                            {getStatusButton(u.id)}
                                        </motion.div>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <div className="text-center py-8">
                                            <Users className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                                            <p className="text-slate-500 text-sm">Aucun utilisateur trouvé</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ================== REQUESTS TAB ================== */}
                    {activeTab === 'requests' && (
                        <div className="px-4 py-4 space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Demandes reçues ({receivedRequests.length})
                            </h3>
                            {receivedRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <UserPlus className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500">Aucune demande en attente</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {receivedRequests.map(req => {
                                        const mutual = req.sender ? getMutualFriends(req.sender_id) : { count: 0, names: [] };
                                        return (
                                            <motion.div
                                                key={req.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 rounded-2xl bg-white/5 border border-white/10"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={() => req.sender && setSelectedProfile(req.sender)}
                                                    >
                                                        <Avatar className="h-14 w-14 border border-white/10">
                                                            <AvatarImage src={req.sender?.avatar_url || undefined} />
                                                            <AvatarFallback className="bg-indigo-600/30 text-indigo-300 font-bold text-lg">
                                                                {req.sender?.full_name?.[0] || '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-white">{req.sender?.full_name || 'Utilisateur'}</p>
                                                        {mutual.count > 0 && (
                                                            <p className="text-[11px] text-indigo-400">
                                                                {getMutualText(mutual.count, mutual.names)}
                                                            </p>
                                                        )}
                                                        <p className="text-[11px] text-slate-500">
                                                            {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: fr })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 mt-3">
                                                    <Button
                                                        className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 gap-1 text-xs font-bold"
                                                        onClick={() => respondToRequest(req.id, req.sender_id, true)}
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        Confirmer
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        className="flex-1 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 gap-1 text-xs font-bold"
                                                        onClick={() => respondToRequest(req.id, req.sender_id, false)}
                                                    >
                                                        Supprimer
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Sent Requests Section */}
                            {sentRequests.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                        Demandes envoyées ({sentRequests.length})
                                    </h3>
                                    <div className="space-y-1">
                                        {sentRequests.map(targetId => {
                                            const profile = allUsers.find(u => u.id === targetId);
                                            if (!profile) return null;
                                            return (
                                                <div key={targetId} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                                                    <Avatar className="h-10 w-10 border border-white/10">
                                                        <AvatarImage src={profile.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-amber-600/30 text-amber-300 font-bold text-sm">
                                                            {profile.full_name?.[0] || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-white truncate">{profile.full_name}</p>
                                                        <p className="text-[11px] text-slate-500">En attente de réponse...</p>
                                                    </div>
                                                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 text-[10px]">
                                                        <Clock className="h-3 w-3" /> Envoyé
                                                    </Badge>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================== FRIENDS TAB ================== */}
                    {activeTab === 'friends' && (
                        <div className="px-4 py-4 space-y-4">
                            {/* Online Friends Section */}
                            {onlineFriendsCount > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                        En ligne ({onlineFriendsCount})
                                    </h3>
                                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                                        {sortedFriends.filter(f => f.is_online).map(friend => (
                                            <motion.div
                                                key={friend.id}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                className="shrink-0 flex flex-col items-center cursor-pointer"
                                                onClick={() => setSelectedProfile(friend)}
                                            >
                                                <div className="relative">
                                                    <Avatar className="h-14 w-14 border-2 border-green-500/50">
                                                        <AvatarImage src={friend.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold">
                                                            {friend.full_name?.[0] || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                                </div>
                                                <p className="text-[11px] font-medium text-white mt-1 max-w-[60px] truncate text-center">
                                                    {friend.full_name?.split(' ')[0] || 'Ami'}
                                                </p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* All Friends */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Tous les amis ({friends.length})
                                </h3>
                                {friends.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Heart className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                                        <p className="text-slate-500">Pas encore d'amis</p>
                                        <p className="text-sm text-slate-600 mt-2">Utilisez l'onglet "Découvrir" pour trouver des amis!</p>
                                        <Button
                                            className="mt-4 rounded-xl bg-indigo-600"
                                            onClick={() => setActiveTab('find')}
                                        >
                                            <Search className="h-4 w-4 mr-2" />
                                            Rechercher
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {sortedFriends.map(friend => (
                                            <motion.div
                                                key={friend.id}
                                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                                                className="flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer"
                                                onClick={() => setSelectedProfile(friend)}
                                            >
                                                <div className="relative">
                                                    <Avatar className="h-12 w-12 border border-white/10">
                                                        <AvatarImage src={friend.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold">
                                                            {friend.full_name?.[0] || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {friend.is_online && (
                                                        <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-[#0F1219]" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-white">{friend.full_name}</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {friend.is_online ? (
                                                            <span className="text-green-400">● En ligne</span>
                                                        ) : friend.last_seen ? (
                                                            `Vu ${formatDistanceToNow(new Date(friend.last_seen), { addSuffix: true, locale: fr })}`
                                                        ) : 'Hors ligne'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 rounded-xl text-indigo-400 hover:bg-indigo-500/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onStartChat) {
                                                                onStartChat(friend.id, friend.full_name || 'Ami');
                                                            }
                                                        }}
                                                    >
                                                        <MessageCircle className="h-4 w-4" />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-9 w-9 rounded-xl text-slate-500 hover:bg-white/5"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-[#1a1f2e] border-white/10">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    if (onStartChat) onStartChat(friend.id, friend.full_name || 'Ami');
                                                                }}
                                                            >
                                                                <MessageCircle className="h-4 w-4 mr-2" />
                                                                Envoyer un message
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-white/5" />
                                                            <DropdownMenuItem
                                                                onClick={() => removeFriend(friend.id)}
                                                                className="text-red-400 focus:text-red-400"
                                                            >
                                                                <UserMinus className="h-4 w-4 mr-2" />
                                                                Retirer des amis
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
