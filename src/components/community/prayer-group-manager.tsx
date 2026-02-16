'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Plus, Lock, Unlock, AlertTriangle, Check,
    Loader2, X, ChevronRight, UserPlus, Crown, MessageCircle,
    Search, Send, UserCheck, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { notifyGroupAccessRequest, notifyGroupAccessApproved, notifyGroupInvitation } from '@/lib/notifications';

interface PrayerGroup {
    id: string;
    name: string;
    description: string | null;
    is_open: boolean;
    is_urgent: boolean;
    max_members: number;
    prayer_request_id: string | null;
    created_by: string;
    member_count: number;
    is_member: boolean;
    pending_request: boolean;
    creator?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface JoinRequest {
    id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    user?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface FriendProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    is_already_member?: boolean;
    is_already_invited?: boolean;
}

interface PrayerGroupManagerProps {
    prayerId: string;
    prayerContent: string;
    prayerOwnerId: string;
    currentUserId?: string;
    onClose?: () => void;
    onOpenChat?: (groupId: string, groupName: string) => void;
    isDialogOpen?: boolean; // NEW: trigger reload whenever dialog opens
}

export function PrayerGroupManager({
    prayerId,
    prayerContent,
    prayerOwnerId,
    currentUserId,
    onClose,
    onOpenChat,
    isDialogOpen = true,
}: PrayerGroupManagerProps) {
    const [view, setView] = useState<'main' | 'create' | 'join_requests' | 'invite_friends'>('main');
    const [existingGroup, setExistingGroup] = useState<PrayerGroup | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

    // Create form
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [isOpen, setIsOpen] = useState(true);
    const [isUrgent, setIsUrgent] = useState(false);
    const [maxMembers, setMaxMembers] = useState(50);

    // Invite friends
    const [friends, setFriends] = useState<FriendProfile[]>([]);
    const [friendSearch, setFriendSearch] = useState('');
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
    const [groupMembers, setGroupMembers] = useState<string[]>([]);
    const [pendingInvites, setPendingInvites] = useState<string[]>([]);

    const isOwner = currentUserId === prayerOwnerId;

    // Reload every time prayerId changes OR dialog opens
    useEffect(() => {
        if (isDialogOpen) {
            loadGroup();
        }
    }, [prayerId, isDialogOpen]);

    const loadGroup = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log('[PrayerGroupManager] Loading group for prayerId:', prayerId);

            // Primary: Check if group exists for this prayer by prayer_request_id
            let { data: groupData, error: groupError } = await supabase
                .from('prayer_groups')
                .select('*')
                .eq('prayer_request_id', prayerId)
                .maybeSingle();

            if (groupError) {
                console.error('[PrayerGroupManager] Error querying group by prayer_request_id:', groupError);
            }

            // Fallback: if no group found by prayer_request_id, try searching by prayer content in group name
            if (!groupData && prayerContent) {
                console.log('[PrayerGroupManager] No group found by prayer_request_id, trying fallback by content...');
                const searchKey = prayerContent.substring(0, 30);
                const { data: fallbackGroups } = await supabase
                    .from('prayer_groups')
                    .select('*')
                    .ilike('name', `%${searchKey}%`)
                    .limit(1);

                if (fallbackGroups && fallbackGroups.length > 0) {
                    groupData = fallbackGroups[0];
                    console.log('[PrayerGroupManager] Found group via fallback:', groupData.name);

                    // Auto-fix: update the prayer_request_id on the group if it's missing
                    if (!groupData.prayer_request_id) {
                        await supabase
                            .from('prayer_groups')
                            .update({ prayer_request_id: prayerId })
                            .eq('id', groupData.id);
                        console.log('[PrayerGroupManager] Auto-fixed prayer_request_id link');
                    }
                }
            }

            console.log('[PrayerGroupManager] Group data found:', !!groupData, groupData?.name);

            if (groupData) {
                // Get member count and member IDs
                const { data: members, count } = await supabase
                    .from('prayer_group_members')
                    .select('user_id', { count: 'exact' })
                    .eq('group_id', groupData.id);

                const memberIds = members?.map(m => m.user_id) || [];
                setGroupMembers(memberIds);

                // Check if current user is member
                let isMember = false;
                let pendingRequest = false;

                if (currentUserId) {
                    isMember = memberIds.includes(currentUserId);

                    if (!isMember) {
                        const { data: request } = await supabase
                            .from('prayer_group_join_requests')
                            .select('id, status')
                            .eq('group_id', groupData.id)
                            .eq('user_id', currentUserId)
                            .eq('status', 'pending')
                            .maybeSingle();

                        pendingRequest = !!request;
                    }
                }

                // Load creator profile separately
                let creator = undefined;
                if (groupData.created_by) {
                    const { data: creatorData } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', groupData.created_by)
                        .maybeSingle();
                    if (creatorData) creator = creatorData;
                }

                // Check for pending invitations
                const { data: invites } = await supabase
                    .from('prayer_group_join_requests')
                    .select('user_id')
                    .eq('group_id', groupData.id)
                    .eq('status', 'pending');
                setPendingInvites(invites?.map(i => i.user_id) || []);

                setExistingGroup({
                    ...groupData,
                    creator,
                    member_count: count || 0,
                    is_member: isMember,
                    pending_request: pendingRequest
                });
            } else {
                console.log('[PrayerGroupManager] No group found for prayer:', prayerId);
                setExistingGroup(null);
            }
        } catch (e) {
            console.error('[PrayerGroupManager] Error loading group:', e);
        }
        setIsLoading(false);
    }, [prayerId, prayerContent, currentUserId]);

    const loadJoinRequests = async () => {
        if (!existingGroup) return;
        try {
            // Load requests with separate profile queries to avoid embedded join issues
            const { data, error } = await supabase
                .from('prayer_group_join_requests')
                .select('*')
                .eq('group_id', existingGroup.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error loading join requests:', error);
                return;
            }

            if (data && data.length > 0) {
                // Load user profiles separately
                const userIds = data.map(r => r.user_id);
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', userIds);

                const profileMap = new Map((profiles || []).map(p => [p.id, p]));
                const enriched = data.map(r => ({
                    ...r,
                    user: profileMap.get(r.user_id) || { full_name: null, avatar_url: null }
                }));
                setJoinRequests(enriched);
            } else {
                setJoinRequests([]);
            }
        } catch (e) {
            console.error('Error loading join requests:', e);
        }
    };

    const loadFriends = async () => {
        if (!currentUserId || !existingGroup) return;
        setLoadingFriends(true);
        try {
            // Get accepted friendships
            const { data: friendships, error } = await supabase
                .from('friendships')
                .select('sender_id, receiver_id')
                .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                .eq('status', 'accepted');

            if (error || !friendships || friendships.length === 0) {
                setFriends([]);
                setLoadingFriends(false);
                return;
            }

            const friendIds = friendships.map(f =>
                f.sender_id === currentUserId ? f.receiver_id : f.sender_id
            );

            // Get profiles
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', friendIds);

            if (profiles) {
                const enriched: FriendProfile[] = profiles.map(p => ({
                    ...p,
                    is_already_member: groupMembers.includes(p.id),
                    is_already_invited: pendingInvites.includes(p.id),
                }));
                setFriends(enriched);
            }
        } catch (e) {
            console.error('Error loading friends for invite:', e);
        }
        setLoadingFriends(false);
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.error("Donnez un nom au groupe");
            return;
        }

        setIsSaving(true);
        try {
            const { data: newGroup, error: createError } = await supabase
                .from('prayer_groups')
                .insert({
                    name: groupName.trim(),
                    description: groupDescription.trim() || null,
                    created_by: currentUserId,
                    is_open: isOpen,
                    is_urgent: isUrgent,
                    max_members: maxMembers,
                    prayer_request_id: prayerId
                })
                .select()
                .single();

            if (createError) throw createError;

            // Add creator as admin member
            await supabase.from('prayer_group_members').insert({
                group_id: newGroup.id,
                user_id: currentUserId,
                role: 'admin'
            });

            toast.success("Groupe de prière créé!");
            setView('main');
            await loadGroup();
        } catch (e: any) {
            console.error('Error creating group:', e);
            toast.error("Erreur: " + (e.message || "Impossible de créer le groupe"));
        }
        setIsSaving(false);
    };

    const handleJoinGroup = async () => {
        if (!existingGroup || !currentUserId) return;

        setIsSaving(true);
        try {
            if (existingGroup.is_open) {
                const { error } = await supabase
                    .from('prayer_group_members')
                    .insert({
                        group_id: existingGroup.id,
                        user_id: currentUserId,
                        role: 'member'
                    });

                if (error) throw error;
                toast.success("Vous avez rejoint le groupe!");
            } else {
                const { error } = await supabase
                    .from('prayer_group_join_requests')
                    .insert({
                        group_id: existingGroup.id,
                        user_id: currentUserId,
                        status: 'pending'
                    });

                if (error) throw error;
                toast.success("Demande envoyée! En attente d'approbation.");

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', currentUserId)
                    .single();

                const groupOwnerId = existingGroup.created_by || prayerOwnerId;
                notifyGroupAccessRequest({
                    groupOwnerId,
                    groupId: existingGroup.id,
                    groupName: existingGroup.name,
                    requesterName: profile?.full_name || 'Un utilisateur',
                }).catch(console.error);
            }

            await loadGroup();
        } catch (e: any) {
            console.error('Error joining group:', e);
            toast.error("Erreur: " + (e.message || "Impossible de rejoindre"));
        }
        setIsSaving(false);
    };

    const handleLeaveGroup = async () => {
        if (!existingGroup || !currentUserId) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .delete()
                .eq('group_id', existingGroup.id)
                .eq('user_id', currentUserId);

            if (error) throw error;
            toast.success("Vous avez quitté le groupe");
            await loadGroup();
        } catch (e: any) {
            console.error('Error leaving group:', e);
            toast.error("Erreur: " + e.message);
        }
        setIsSaving(false);
    };

    const handleApproveRequest = async (requestId: string, userId: string, approved: boolean) => {
        if (!existingGroup) return;

        try {
            await supabase
                .from('prayer_group_join_requests')
                .update({ status: approved ? 'approved' : 'rejected' })
                .eq('id', requestId);

            if (approved) {
                await supabase
                    .from('prayer_group_members')
                    .insert({
                        group_id: existingGroup.id,
                        user_id: userId,
                        role: 'member'
                    });

                notifyGroupAccessApproved({
                    userId,
                    groupId: existingGroup.id,
                    groupName: existingGroup.name,
                }).catch(console.error);
            }

            toast.success(approved ? "Membre approuvé" : "Demande rejetée");
            loadJoinRequests();
            loadGroup();
        } catch (e: any) {
            console.error('Error handling request:', e);
            toast.error("Erreur: " + e.message);
        }
    };

    const handleInviteFriend = async (friendId: string) => {
        if (!existingGroup || !currentUserId) return;

        setInvitingFriendId(friendId);
        try {
            // Add friend directly as member (since the owner is inviting)
            const { error } = await supabase
                .from('prayer_group_members')
                .insert({
                    group_id: existingGroup.id,
                    user_id: friendId,
                    role: 'member'
                });

            if (error) {
                // If already a member, ignore
                if (error.code === '23505') {
                    toast.info("Cet ami est déjà membre du groupe");
                } else {
                    throw error;
                }
            } else {
                // Get current user name for notification
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', currentUserId)
                    .maybeSingle();

                // Send invitation notification
                notifyGroupInvitation({
                    userId: friendId,
                    inviterName: profile?.full_name || 'Un ami',
                    groupId: existingGroup.id,
                    groupName: existingGroup.name,
                }).catch(console.error);

                toast.success("Ami invité au groupe!");

                // Update the friend in the list
                setFriends(prev => prev.map(f =>
                    f.id === friendId ? { ...f, is_already_member: true } : f
                ));
                setGroupMembers(prev => [...prev, friendId]);
            }
        } catch (e: any) {
            console.error('Error inviting friend:', e);
            toast.error("Erreur: " + (e.message || "Impossible d'inviter"));
        }
        setInvitingFriendId(null);
    };

    const getInitials = (name: string | null) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const filteredFriends = friends.filter(f => {
        if (!friendSearch.trim()) return true;
        const search = friendSearch.toLowerCase();
        return (f.full_name || '').toLowerCase().includes(search);
    });

    const isGroupAdmin = currentUserId && existingGroup?.created_by === currentUserId;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <span className="ml-2 text-sm text-slate-400">Chargement...</span>
            </div>
        );
    }

    // ========== CREATE GROUP VIEW ==========
    if (view === 'create') {
        return (
            <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setView('main')} className="shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-base sm:text-lg">Créer un groupe de prière</h3>
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-xs text-indigo-400 mb-1">Pour la demande :</p>
                    <p className="text-sm text-slate-300 line-clamp-2">{prayerContent}</p>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm">Nom du groupe *</Label>
                        <Input
                            placeholder="Ex: Prières pour la guérison de..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="bg-white/5 border-white/10 text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm">Description (optionnel)</Label>
                        <Textarea
                            placeholder="Décrivez le groupe..."
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            rows={3}
                            className="bg-white/5 border-white/10 text-sm resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm">Nombre max de membres</Label>
                        <Input
                            type="number"
                            value={maxMembers}
                            onChange={(e) => setMaxMembers(parseInt(e.target.value) || 50)}
                            min={2}
                            max={1000}
                            className="bg-white/5 border-white/10 text-sm"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            {isOpen ? (
                                <Unlock className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
                            ) : (
                                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                                <Label className="text-sm">Groupe ouvert</Label>
                                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                                    {isOpen
                                        ? "Tout le monde peut rejoindre"
                                        : "Approbation requise"
                                    }
                                </p>
                            </div>
                        </div>
                        <Switch checked={isOpen} onCheckedChange={setIsOpen} />
                    </div>

                    <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 shrink-0" />
                            <div className="min-w-0">
                                <Label className="text-sm text-red-400">Urgent</Label>
                                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                                    Le groupe sera mis en avant
                                </p>
                            </div>
                        </div>
                        <Switch checked={isUrgent} onCheckedChange={setIsUrgent} />
                    </div>
                </div>

                <Button
                    onClick={handleCreateGroup}
                    disabled={isSaving || !groupName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 h-11 sm:h-12 text-sm sm:text-base"
                >
                    {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4 mr-2" />
                    )}
                    Créer le groupe
                </Button>
            </div>
        );
    }

    // ========== JOIN REQUESTS VIEW ==========
    if (view === 'join_requests') {
        return (
            <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setView('main')} className="shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-base sm:text-lg">Demandes d'adhésion</h3>
                </div>

                <ScrollArea className="h-[250px] sm:h-[300px]">
                    {joinRequests.length === 0 ? (
                        <div className="text-center py-8 sm:py-12 text-muted-foreground">
                            <UserPlus className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">Aucune demande en attente</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {joinRequests.map(request => (
                                <div
                                    key={request.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 gap-2"
                                >
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                                            <AvatarImage src={request.user?.avatar_url || undefined} />
                                            <AvatarFallback className="bg-slate-600 text-xs sm:text-sm">
                                                {getInitials(request.user?.full_name ?? null)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm truncate">
                                            {request.user?.full_name || 'Utilisateur'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleApproveRequest(request.id, request.user_id, false)}
                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleApproveRequest(request.id, request.user_id, true)}
                                            className="bg-green-600 hover:bg-green-500 h-8 w-8 p-0"
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        );
    }

    // ========== INVITE FRIENDS VIEW ==========
    if (view === 'invite_friends') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setView('main')} className="shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-base sm:text-lg">Inviter des amis</h3>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher un ami..."
                        value={friendSearch}
                        onChange={(e) => setFriendSearch(e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 text-sm h-10"
                    />
                </div>

                {/* Friends list */}
                <ScrollArea className="h-[250px] sm:h-[300px]">
                    {loadingFriends ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                            <span className="ml-2 text-sm text-slate-400">Chargement des amis...</span>
                        </div>
                    ) : filteredFriends.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">
                                {friends.length === 0
                                    ? "Vous n'avez pas encore d'amis"
                                    : "Aucun ami trouvé"
                                }
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Ajoutez des amis depuis la section "Amis" de la communauté
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredFriends.map(friend => (
                                <div
                                    key={friend.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors gap-2"
                                >
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                                            <AvatarImage src={friend.avatar_url || undefined} />
                                            <AvatarFallback className="bg-slate-600 text-xs">
                                                {getInitials(friend.full_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">
                                                {friend.full_name || 'Utilisateur'}
                                            </p>
                                            {friend.is_already_member && (
                                                <p className="text-[10px] text-emerald-400">Déjà membre</p>
                                            )}
                                        </div>
                                    </div>

                                    {friend.is_already_member ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] shrink-0">
                                            <UserCheck className="h-3 w-3 mr-1" />
                                            Membre
                                        </Badge>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={() => handleInviteFriend(friend.id)}
                                            disabled={invitingFriendId === friend.id}
                                            className="bg-indigo-600 hover:bg-indigo-500 h-8 text-xs shrink-0 gap-1"
                                        >
                                            {invitingFriendId === friend.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Send className="h-3 w-3" />
                                            )}
                                            <span className="hidden sm:inline">Inviter</span>
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        );
    }

    // ========== MAIN VIEW ==========
    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
                    Groupe de prière
                </h3>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {!existingGroup ? (
                // No group exists yet
                <div className="text-center py-6 sm:py-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-400" />
                    </div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base">Pas encore de groupe</h4>
                    <p className="text-xs sm:text-sm text-slate-400 mb-6 px-4">
                        {isOwner
                            ? "Créez un groupe pour rassembler des priants pour cette intention"
                            : "L'auteur n'a pas encore créé de groupe pour cette prière"
                        }
                    </p>

                    {isOwner && (
                        <Button
                            onClick={() => setView('create')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-sm"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Créer un groupe
                        </Button>
                    )}
                </div>
            ) : (
                // Group exists
                <div className="space-y-3 sm:space-y-4">
                    {/* Group Info Card */}
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className={cn(
                                    "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0",
                                    existingGroup.is_urgent
                                        ? "bg-gradient-to-br from-red-500 to-orange-500"
                                        : "bg-gradient-to-br from-indigo-500 to-purple-500"
                                )}>
                                    <Users className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-semibold text-sm sm:text-base truncate">{existingGroup.name}</h4>
                                        {existingGroup.is_urgent && (
                                            <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                                                URGENT
                                            </Badge>
                                        )}
                                        {!existingGroup.is_open && (
                                            <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-[10px]">
                                                <Lock className="h-2.5 w-2.5 mr-1" />
                                                Privé
                                            </Badge>
                                        )}
                                    </div>
                                    {existingGroup.description && (
                                        <p className="text-xs sm:text-sm text-slate-400 mt-1 line-clamp-2">{existingGroup.description}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2">
                                        <p className="text-[10px] sm:text-xs text-slate-500">
                                            {existingGroup.member_count} / {existingGroup.max_members} membres
                                        </p>
                                        {existingGroup.creator && (
                                            <p className="text-[10px] sm:text-xs text-slate-500">
                                                par {existingGroup.creator.full_name || 'Inconnu'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    {existingGroup.is_member ? (
                        <div className="space-y-2 sm:space-y-3">
                            {/* Open Chat */}
                            <Button
                                className="w-full bg-indigo-600 hover:bg-indigo-500 h-10 sm:h-11 text-sm"
                                onClick={() => {
                                    if (onOpenChat && existingGroup) {
                                        onOpenChat(existingGroup.id, existingGroup.name);
                                        onClose?.();
                                    } else {
                                        if (existingGroup) {
                                            localStorage.setItem('openGroupChat', JSON.stringify({
                                                id: existingGroup.id,
                                                name: existingGroup.name
                                            }));
                                            toast.success(`Navigation vers le chat du groupe: ${existingGroup.name}`);
                                        }
                                        onClose?.();
                                    }
                                }}
                            >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Ouvrir le chat
                            </Button>

                            {/* Invite Friends Button (for group owner/admin) */}
                            {isGroupAdmin && (
                                <Button
                                    variant="outline"
                                    className="w-full border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 h-10 sm:h-11 text-sm"
                                    onClick={() => {
                                        setView('invite_friends');
                                        loadFriends();
                                    }}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Inviter des amis
                                </Button>
                            )}

                            {/* Join Requests (for owner on closed groups) */}
                            {isGroupAdmin && !existingGroup.is_open && (
                                <Button
                                    variant="outline"
                                    className="w-full h-10 sm:h-11 text-sm"
                                    onClick={() => {
                                        setView('join_requests');
                                        loadJoinRequests();
                                    }}
                                >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Demandes d'adhésion
                                    {joinRequests.length > 0 && (
                                        <Badge className="ml-2 bg-indigo-500 text-xs">{joinRequests.length}</Badge>
                                    )}
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                className="w-full text-red-400 hover:bg-red-500/10 h-9 sm:h-10 text-xs sm:text-sm"
                                onClick={handleLeaveGroup}
                                disabled={isSaving}
                            >
                                Quitter le groupe
                            </Button>
                        </div>
                    ) : existingGroup.pending_request ? (
                        <div className="text-center py-4">
                            <Badge className="bg-amber-500/20 text-amber-400 px-4 py-2 text-xs sm:text-sm">
                                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                                Demande en attente d'approbation
                            </Badge>
                        </div>
                    ) : (
                        <Button
                            onClick={handleJoinGroup}
                            disabled={isSaving || existingGroup.member_count >= existingGroup.max_members}
                            className="w-full bg-green-600 hover:bg-green-500 h-10 sm:h-11 text-sm"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : existingGroup.is_open ? (
                                <UserPlus className="h-4 w-4 mr-2" />
                            ) : (
                                <Lock className="h-4 w-4 mr-2" />
                            )}
                            {existingGroup.is_open ? "Rejoindre le groupe" : "Demander à rejoindre"}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// Lightweight button to trigger the modal
export function JoinPrayerGroupButton({
    prayerId,
    prayerContent,
    prayerOwnerId,
    currentUserId,
    size = 'sm',
    onOpenChat
}: {
    prayerId: string;
    prayerContent: string;
    prayerOwnerId: string;
    currentUserId?: string;
    size?: 'sm' | 'default';
    onOpenChat?: (groupId: string, groupName: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenChat = (groupId: string, groupName: string) => {
        if (onOpenChat) {
            onOpenChat(groupId, groupName);
        } else {
            localStorage.setItem('openGroupChat', JSON.stringify({
                id: groupId,
                name: groupName
            }));
            window.dispatchEvent(new CustomEvent('openGroupChat', {
                detail: { groupId, groupName }
            }));
        }
        setIsOpen(false);
    };

    return (
        <>
            <Button
                variant="ghost"
                size={size}
                onClick={() => setIsOpen(true)}
                className="text-slate-400 hover:text-indigo-400"
            >
                <Users className="h-4 w-4 mr-1" />
                Groupe
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-md bg-[#0F1219] border-white/10 text-white rounded-2xl sm:rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Groupe de prière</DialogTitle>
                    </DialogHeader>
                    <PrayerGroupManager
                        prayerId={prayerId}
                        prayerContent={prayerContent}
                        prayerOwnerId={prayerOwnerId}
                        currentUserId={currentUserId}
                        onClose={() => setIsOpen(false)}
                        onOpenChat={handleOpenChat}
                        isDialogOpen={isOpen}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
