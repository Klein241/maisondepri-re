'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Plus, Lock, Unlock, AlertTriangle, Check,
    Loader2, X, ChevronRight, UserPlus, Crown, MessageCircle
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

interface PrayerGroup {
    id: string;
    name: string;
    description: string | null;
    is_open: boolean;
    is_urgent: boolean;
    max_members: number;
    prayer_request_id: string | null;
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

interface PrayerGroupManagerProps {
    prayerId: string;
    prayerContent: string;
    prayerOwnerId: string;
    currentUserId?: string;
    onClose?: () => void;
    onOpenChat?: (groupId: string, groupName: string) => void;
}

export function PrayerGroupManager({
    prayerId,
    prayerContent,
    prayerOwnerId,
    currentUserId,
    onClose,
    onOpenChat
}: PrayerGroupManagerProps) {
    const [view, setView] = useState<'main' | 'create' | 'join_requests'>('main');
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

    const isOwner = currentUserId === prayerOwnerId;

    useEffect(() => {
        loadGroup();
    }, [prayerId]);

    const loadGroup = async () => {
        setIsLoading(true);
        try {
            // Check if group exists for this prayer
            const { data: groupData, error: groupError } = await supabase
                .from('prayer_groups')
                .select(`
                    *,
                    creator:created_by (full_name, avatar_url)
                `)
                .eq('prayer_request_id', prayerId)
                .single();

            if (groupError && groupError.code !== 'PGRST116') throw groupError;

            if (groupData) {
                // Get member count
                const { count } = await supabase
                    .from('prayer_group_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('group_id', groupData.id);

                // Check if current user is member
                let isMember = false;
                let pendingRequest = false;

                if (currentUserId) {
                    const { data: membership } = await supabase
                        .from('prayer_group_members')
                        .select('id')
                        .eq('group_id', groupData.id)
                        .eq('user_id', currentUserId)
                        .maybeSingle();

                    isMember = !!membership;

                    // Check for pending join request
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

                setExistingGroup({
                    ...groupData,
                    member_count: count || 0,
                    is_member: isMember,
                    pending_request: pendingRequest
                });
            }
        } catch (e) {
            console.error('Error loading group:', e);
        }
        setIsLoading(false);
    };

    const loadJoinRequests = async () => {
        if (!existingGroup) return;
        try {
            const { data, error } = await supabase
                .from('prayer_group_join_requests')
                .select(`
                    *,
                    user:user_id (full_name, avatar_url)
                `)
                .eq('group_id', existingGroup.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setJoinRequests(data || []);
        } catch (e) {
            console.error('Error loading join requests:', e);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.error("Donnez un nom au groupe");
            return;
        }

        setIsSaving(true);
        try {
            // Create the group
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
            loadGroup();
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
                // Direct join for open groups
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
                // Send join request for closed groups
                const { error } = await supabase
                    .from('prayer_group_join_requests')
                    .insert({
                        group_id: existingGroup.id,
                        user_id: currentUserId,
                        status: 'pending'
                    });

                if (error) throw error;
                toast.success("Demande envoyée! En attente d'approbation.");
            }

            loadGroup();
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
            loadGroup();
        } catch (e: any) {
            console.error('Error leaving group:', e);
            toast.error("Erreur: " + e.message);
        }
        setIsSaving(false);
    };

    const handleApproveRequest = async (requestId: string, userId: string, approved: boolean) => {
        if (!existingGroup) return;

        try {
            // Update request status
            await supabase
                .from('prayer_group_join_requests')
                .update({ status: approved ? 'approved' : 'rejected' })
                .eq('id', requestId);

            if (approved) {
                // Add as member
                await supabase
                    .from('prayer_group_members')
                    .insert({
                        group_id: existingGroup.id,
                        user_id: userId,
                        role: 'member'
                    });
            }

            toast.success(approved ? "Membre approuvé" : "Demande rejetée");
            loadJoinRequests();
            loadGroup();
        } catch (e: any) {
            console.error('Error handling request:', e);
            toast.error("Erreur: " + e.message);
        }
    };

    const getInitials = (name: string | null) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    // Create Group View
    if (view === 'create') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setView('main')}>
                        <X className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-lg">Créer un groupe de prière</h3>
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-xs text-indigo-400 mb-1">Pour la demande :</p>
                    <p className="text-sm text-slate-300 line-clamp-2">{prayerContent}</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nom du groupe *</Label>
                        <Input
                            placeholder="Ex: Prières pour la guérison de..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Description (optionnel)</Label>
                        <Textarea
                            placeholder="Décrivez le groupe..."
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            rows={3}
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Nombre max de membres</Label>
                        <Input
                            type="number"
                            value={maxMembers}
                            onChange={(e) => setMaxMembers(parseInt(e.target.value) || 50)}
                            min={2}
                            max={1000}
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                            {isOpen ? (
                                <Unlock className="h-5 w-5 text-green-500" />
                            ) : (
                                <Lock className="h-5 w-5 text-orange-500" />
                            )}
                            <div>
                                <Label className="text-base">Groupe ouvert</Label>
                                <p className="text-xs text-slate-400">
                                    {isOpen
                                        ? "Tout le monde peut rejoindre"
                                        : "Approbation requise pour rejoindre"
                                    }
                                </p>
                            </div>
                        </div>
                        <Switch checked={isOpen} onCheckedChange={setIsOpen} />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <div>
                                <Label className="text-base text-red-400">Marquer comme urgent</Label>
                                <p className="text-xs text-slate-400">
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
                    className="w-full bg-indigo-600 hover:bg-indigo-500"
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

    // Join Requests View
    if (view === 'join_requests') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setView('main')}>
                        <X className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold text-lg">Demandes d'adhésion</h3>
                </div>

                <ScrollArea className="h-[300px]">
                    {joinRequests.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Aucune demande en attente</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {joinRequests.map(request => (
                                <div
                                    key={request.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={request.user?.avatar_url || undefined} />
                                            <AvatarFallback className="bg-slate-600 text-sm">
                                                {getInitials(request.user?.full_name ?? null)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">
                                            {request.user?.full_name || 'Utilisateur'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleApproveRequest(request.id, request.user_id, false)}
                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleApproveRequest(request.id, request.user_id, true)}
                                            className="bg-green-600 hover:bg-green-500"
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

    // Main View
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    Groupe de prière
                </h3>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {!existingGroup ? (
                // No group exists yet
                <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-indigo-400" />
                    </div>
                    <h4 className="font-medium mb-2">Pas encore de groupe</h4>
                    <p className="text-sm text-slate-400 mb-6">
                        {isOwner
                            ? "Créez un groupe pour rassembler des priants pour cette intention"
                            : "L'auteur n'a pas encore créé de groupe pour cette prière"
                        }
                    </p>

                    {isOwner && (
                        <Button
                            onClick={() => setView('create')}
                            className="bg-indigo-600 hover:bg-indigo-500"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Créer un groupe
                        </Button>
                    )}
                </div>
            ) : (
                // Group exists
                <div className="space-y-4">
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                                    existingGroup.is_urgent
                                        ? "bg-gradient-to-br from-red-500 to-orange-500"
                                        : "bg-gradient-to-br from-indigo-500 to-purple-500"
                                )}>
                                    <Users className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-semibold">{existingGroup.name}</h4>
                                        {existingGroup.is_urgent && (
                                            <Badge className="bg-red-500/20 text-red-400 text-xs">
                                                URGENT
                                            </Badge>
                                        )}
                                        {!existingGroup.is_open && (
                                            <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs">
                                                <Lock className="h-3 w-3 mr-1" />
                                                Privé
                                            </Badge>
                                        )}
                                    </div>
                                    {existingGroup.description && (
                                        <p className="text-sm text-slate-400 mt-1">{existingGroup.description}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-2">
                                        {existingGroup.member_count} / {existingGroup.max_members} membres
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    {existingGroup.is_member ? (
                        <div className="space-y-3">
                            <Button
                                className="w-full bg-indigo-600 hover:bg-indigo-500"
                                onClick={() => {
                                    if (onOpenChat && existingGroup) {
                                        onOpenChat(existingGroup.id, existingGroup.name);
                                        onClose?.();
                                    } else {
                                        // Fallback: Store in localStorage and navigate
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

                            {/* Show join requests for owner/admin */}
                            {isOwner && !existingGroup.is_open && (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setView('join_requests');
                                        loadJoinRequests();
                                    }}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Demandes d'adhésion
                                    {joinRequests.length > 0 && (
                                        <Badge className="ml-2 bg-indigo-500">{joinRequests.length}</Badge>
                                    )}
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                className="w-full text-red-400 hover:bg-red-500/10"
                                onClick={handleLeaveGroup}
                                disabled={isSaving}
                            >
                                Quitter le groupe
                            </Button>
                        </div>
                    ) : existingGroup.pending_request ? (
                        <div className="text-center py-4">
                            <Badge className="bg-amber-500/20 text-amber-400 px-4 py-2">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Demande en attente d'approbation
                            </Badge>
                        </div>
                    ) : (
                        <Button
                            onClick={handleJoinGroup}
                            disabled={isSaving || existingGroup.member_count >= existingGroup.max_members}
                            className="w-full bg-green-600 hover:bg-green-500"
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
            // Store in localStorage so the chat component can pick it up
            localStorage.setItem('openGroupChat', JSON.stringify({
                id: groupId,
                name: groupName
            }));
            // Dispatch a custom event to notify the chat component
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
                <DialogContent className="max-w-md">
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
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
