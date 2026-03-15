'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PrayerGroup, PrayerGroupJoinRequest } from '@/lib/types';
import { notifyGroupAccessRequest, notifyGroupAccessApproved } from '@/lib/notifications';
import { toast } from 'sonner';

interface UserInfo {
    id: string;
    name: string;
    avatar?: string | null;
}

/**
 * useGroups — Manage prayer groups: CRUD, join/leave, join requests, members.
 *
 * Encapsulates:
 * • Loading all groups with member counts
 * • Loading user's joined groups
 * • Join / leave / request join / approve / reject
 * • Group member management (load, remove)
 * • Group creation (RPC fallback to direct insert)
 */
export function useGroups(user: UserInfo | null) {
    const [groups, setGroups] = useState<PrayerGroup[]>([]);
    const [userGroups, setUserGroups] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<PrayerGroup | null>(null);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);

    // Join request system
    const [groupJoinRequests, setGroupJoinRequests] = useState<PrayerGroupJoinRequest[]>([]);
    const [pendingRequestCounts, setPendingRequestCounts] = useState<Record<string, number>>({});

    // Create group dialog state
    const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [isGroupPublic, setIsGroupPublic] = useState(true);
    const [creatingGroup, setCreatingGroup] = useState(false);

    // Members panel
    const [showMembersPanel, setShowMembersPanel] = useState(false);

    const loadGroups = useCallback(async () => {
        try {
            let { data, error } = await supabase
                .from('prayer_groups')
                .select(`
                    *,
                    profiles:created_by (full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.log('Groups query error, trying simpler query:', error.message);
                const simpleResult = await supabase
                    .from('prayer_groups')
                    .select('*')
                    .order('created_at', { ascending: false });
                data = simpleResult.data;
            }

            if (data) {
                const groupsWithCounts = await Promise.all(data.map(async (g) => {
                    const { count } = await supabase
                        .from('prayer_group_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', g.id);
                    return { ...g, memberCount: count || 0 };
                }));
                setGroups(groupsWithCounts);
            } else {
                setGroups([]);
            }
        } catch (e) {
            console.error('Error loading groups:', e);
        }
    }, []);

    const loadUserGroups = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('prayer_group_members')
                .select('group_id')
                .eq('user_id', user.id);

            if (!error && data) {
                setUserGroups(data.map(m => m.group_id));
            }
        } catch (e) {
            console.error('Error loading user groups:', e);
        }
    }, [user]);

    const loadPendingJoinRequests = useCallback(async () => {
        if (!user) return;
        try {
            const { data: myGroups } = await supabase
                .from('prayer_groups')
                .select('id')
                .eq('created_by', user.id);

            if (!myGroups || myGroups.length === 0) return;

            const groupIds = myGroups.map(g => g.id);
            const { data: requests, error } = await supabase
                .from('prayer_group_join_requests')
                .select(`
                    *,
                    profiles:user_id(full_name, avatar_url)
                `)
                .in('group_id', groupIds)
                .eq('status', 'pending');

            if (!error && requests) {
                setGroupJoinRequests(requests);
                const counts: Record<string, number> = {};
                requests.forEach(r => {
                    counts[r.group_id] = (counts[r.group_id] || 0) + 1;
                });
                setPendingRequestCounts(counts);
            }
        } catch (e) {
            console.log('Join requests table may not exist yet');
        }
    }, [user]);

    const joinGroup = useCallback(async (groupId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .insert({
                    group_id: groupId,
                    user_id: user.id
                });

            if (error && !error.message.includes('duplicate')) throw error;
            toast.success('Vous avez rejoint le groupe!');
            setUserGroups(prev => [...prev, groupId]);
            loadGroups();
        } catch (e) {
            console.error('Error joining group:', e);
            toast.error("Erreur lors de l'adhésion au groupe");
        }
    }, [user, loadGroups]);

    const leaveGroup = useCallback(async (groupId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', user.id);

            if (error) throw error;
            toast.success('Vous avez quitté le groupe');
            setUserGroups(prev => prev.filter(id => id !== groupId));
            loadGroups();
        } catch (e) {
            console.error('Error leaving group:', e);
            toast.error("Erreur lors de la désinscription du groupe");
        }
    }, [user, loadGroups]);

    const requestJoinGroup = useCallback(async (groupId: string) => {
        if (!user) return;

        const targetGroup = groups.find(g => g.id === groupId);
        if (targetGroup?.isOpen ?? (targetGroup as any)?.is_open) {
            await joinGroup(groupId);
            return;
        }

        try {
            try {
                const { data: existing } = await supabase
                    .from('prayer_group_join_requests')
                    .select('id')
                    .eq('group_id', groupId)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (existing) {
                    toast.info('Vous avez déjà envoyé une demande pour ce groupe');
                    return;
                }
            } catch (checkErr: any) {
                console.log('Check existing request failed, proceeding:', checkErr?.message);
            }

            const { error } = await supabase
                .from('prayer_group_join_requests')
                .insert({
                    group_id: groupId,
                    user_id: user.id,
                    status: 'pending'
                });

            if (error) {
                if (error.message.includes('does not exist') || error.code === '42P01' || error.code === '42P17') {
                    await joinGroup(groupId);
                    return;
                }
                throw error;
            }

            const { data: group } = await supabase
                .from('prayer_groups')
                .select('created_by, name')
                .eq('id', groupId)
                .single();

            if (group) {
                notifyGroupAccessRequest({
                    groupOwnerId: group.created_by,
                    groupId,
                    groupName: group.name,
                    requesterName: user.name,
                    requesterId: user.id,
                }).catch(console.error);
            }

            toast.success('✅ Demande envoyée! Le créateur du groupe sera notifié.');
        } catch (e) {
            console.error('Error requesting join:', e);
            toast.error("Erreur lors de l'envoi de la demande");
        }
    }, [user, groups, joinGroup]);

    const approveJoinRequest = useCallback(async (requestId: string, groupId: string, userId: string) => {
        try {
            const { error: memberError } = await supabase
                .from('prayer_group_members')
                .insert({ group_id: groupId, user_id: userId, role: 'member' });

            if (memberError && !memberError.message.includes('duplicate')) {
                console.error('Member insert error:', memberError);
            }

            await supabase
                .from('prayer_group_join_requests')
                .delete()
                .eq('id', requestId);

            const groupData = groups.find(g => g.id === groupId);
            notifyGroupAccessApproved({
                userId,
                groupId,
                groupName: groupData?.name || selectedGroup?.name || 'Chambre haute',
            }).catch(console.error);

            setGroupJoinRequests(prev => prev.filter(r => r.id !== requestId));
            setPendingRequestCounts(prev => ({
                ...prev,
                [groupId]: Math.max(0, (prev[groupId] || 0) - 1)
            }));

            toast.success('✅ Membre approuvé!');
            loadGroups();
        } catch (e) {
            console.error('Error approving request:', e);
            toast.error("Erreur lors de l'approbation");
        }
    }, [groups, selectedGroup, loadGroups]);

    const rejectJoinRequest = useCallback(async (requestId: string, groupId: string) => {
        try {
            await supabase
                .from('prayer_group_join_requests')
                .delete()
                .eq('id', requestId);

            setGroupJoinRequests(prev => prev.filter(r => r.id !== requestId));
            setPendingRequestCounts(prev => ({
                ...prev,
                [groupId]: Math.max(0, (prev[groupId] || 0) - 1)
            }));

            toast.info('Demande refusée');
        } catch (e) {
            console.error('Error rejecting request:', e);
        }
    }, []);

    const loadGroupMembers = useCallback(async (groupId: string) => {
        try {
            const { data, error } = await supabase
                .from('prayer_group_members')
                .select(`
                    *,
                    profiles:user_id(id, full_name, avatar_url)
                `)
                .eq('group_id', groupId);

            if (!error && data) {
                setGroupMembers(data);
            }
        } catch (e) {
            console.error('Error loading members:', e);
        }
    }, []);

    const removeGroupMember = useCallback(async (groupId: string, memberId: string) => {
        if (!user) return;
        try {
            await supabase
                .from('prayer_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', memberId);

            setGroupMembers(prev => prev.filter(m => m.user_id !== memberId));
            toast.success('Membre retiré du groupe');
            loadGroups();
        } catch (e) {
            console.error('Error removing member:', e);
            toast.error("Erreur lors du retrait du membre");
        }
    }, [user, loadGroups]);

    // Generate a URL-safe slug
    const generateSlug = (name: string): string => {
        return name
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 80);
    };

    const createGroup = useCallback(async () => {
        if (!user || !newGroupName.trim()) return;
        setCreatingGroup(true);
        try {
            const trimmedName = newGroupName.trim();
            const slug = generateSlug(trimmedName) + '-' + Date.now().toString(36);
            const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(trimmedName)}&backgroundColor=6366f1,8b5cf6,a855f7`;

            let groupId: string | null = null;
            const { data: rpcData, error: rpcError } = await supabase.rpc('create_prayer_group', {
                group_name: trimmedName,
                group_description: newGroupDescription.trim() || null,
                is_public_group: isGroupPublic
            });

            if (rpcError) {
                console.log('RPC failed, using direct insert:', rpcError.message);
                const { data: insertData, error: insertError } = await supabase
                    .from('prayer_groups')
                    .insert({
                        name: trimmedName,
                        description: newGroupDescription.trim() || null,
                        created_by: user.id,
                        is_open: isGroupPublic,
                        slug,
                        avatar_url: avatarUrl
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                groupId = insertData?.id;

                if (groupId) {
                    await supabase.from('prayer_group_members').insert({
                        group_id: groupId,
                        user_id: user.id,
                        role: 'admin'
                    });
                }
            } else {
                groupId = rpcData;
                if (groupId) {
                    await supabase.from('prayer_groups')
                        .update({ slug, avatar_url: avatarUrl })
                        .eq('id', groupId);
                }
            }

            toast.success('🚪 Chambre haute créée avec succès!');
            setNewGroupName('');
            setNewGroupDescription('');
            setIsGroupPublic(true);
            setShowCreateGroupDialog(false);
            if (groupId) {
                setUserGroups(prev => [...prev, groupId!]);
            }
            loadGroups();
        } catch (e) {
            console.error('Error creating group:', e);
            toast.error("Erreur lors de la création du groupe");
        }
        setCreatingGroup(false);
    }, [user, newGroupName, newGroupDescription, isGroupPublic, loadGroups]);

    return {
        // State
        groups,
        setGroups,
        userGroups,
        setUserGroups,
        selectedGroup,
        setSelectedGroup,
        groupMembers,
        setGroupMembers,
        groupJoinRequests,
        pendingRequestCounts,
        showMembersPanel,
        setShowMembersPanel,
        showCreateGroupDialog,
        setShowCreateGroupDialog,
        newGroupName,
        setNewGroupName,
        newGroupDescription,
        setNewGroupDescription,
        isGroupPublic,
        setIsGroupPublic,
        creatingGroup,

        // Actions
        loadGroups,
        loadUserGroups,
        loadPendingJoinRequests,
        joinGroup,
        leaveGroup,
        requestJoinGroup,
        approveJoinRequest,
        rejectJoinRequest,
        loadGroupMembers,
        removeGroupMember,
        createGroup,
        generateSlug,
    };
}
