'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
    Loader2, Plus, MoreVertical, Users, UserPlus, Settings,
    Trash2, Edit, Search, RefreshCw, Lock, Unlock, AlertTriangle,
    CheckCircle2, XCircle, ChevronLeft, ChevronRight, MessageSquare, Crown, Video, Copy, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PrayerGroup {
    id: string;
    name: string;
    description: string | null;
    created_by: string;
    is_open: boolean;
    is_urgent: boolean;
    max_members: number;
    prayer_request_id: string | null;
    created_at: string;
    creator?: { full_name: string; avatar_url: string | null };
    member_count?: number;
}

interface GroupMember {
    id: string;
    user_id: string;
    role: 'admin' | 'moderator' | 'member';
    joined_at: string;
    profile?: { full_name: string; avatar_url: string | null };
}

interface UserProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
}

export default function AdminGroupsPage() {
    const [groups, setGroups] = useState<PrayerGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Create Group Dialog
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newGroup, setNewGroup] = useState({
        name: '',
        description: '',
        is_open: true,
        is_urgent: false,
        max_members: 50
    });

    // Manage Members Dialog
    const [selectedGroup, setSelectedGroup] = useState<PrayerGroup | null>(null);
    const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);

    // Add Member Dialog
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('prayer_groups')
                .select(`
                    *,
                    creator:created_by (full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Get member counts for each group
            const groupsWithCounts = await Promise.all((data || []).map(async (group) => {
                const { count } = await supabase
                    .from('prayer_group_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('group_id', group.id);
                return { ...group, member_count: count || 0 };
            }));

            setGroups(groupsWithCounts);
        } catch (e: any) {
            console.error('Error fetching groups:', e);
            toast.error('Erreur de chargement des groupes');
        }
        setIsLoading(false);
    };

    const fetchGroupMembers = async (groupId: string) => {
        setLoadingMembers(true);
        try {
            const { data, error } = await supabase
                .from('prayer_group_members')
                .select(`
                    *,
                    profile:user_id (full_name, avatar_url)
                `)
                .eq('group_id', groupId)
                .order('joined_at', { ascending: true });

            if (error) throw error;
            setGroupMembers(data || []);
        } catch (e: any) {
            console.error('Error fetching members:', e);
            toast.error('Erreur de chargement des membres');
        }
        setLoadingMembers(false);
    };

    const fetchAllUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .order('full_name');

            if (error) throw error;
            setAllUsers(data || []);
        } catch (e) {
            console.error('Error fetching users:', e);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroup.name.trim()) {
            toast.error('Le nom du groupe est requis');
            return;
        }

        setIsSaving(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error('Non authentifié');

            const { data, error } = await supabase
                .from('prayer_groups')
                .insert({
                    name: newGroup.name,
                    description: newGroup.description || null,
                    created_by: userData.user.id,
                    is_open: newGroup.is_open,
                    is_urgent: newGroup.is_urgent,
                    max_members: newGroup.max_members
                })
                .select()
                .single();

            if (error) throw error;

            // Add creator as admin member
            if (data) {
                await supabase.from('prayer_group_members').insert({
                    group_id: data.id,
                    user_id: userData.user.id,
                    role: 'admin'
                });
            }

            toast.success('Groupe créé avec succès!');
            setIsCreateDialogOpen(false);
            setNewGroup({ name: '', description: '', is_open: true, is_urgent: false, max_members: 50 });
            fetchGroups();
        } catch (e: any) {
            console.error('Error creating group:', e);
            toast.error('Erreur: ' + (e.message || 'Impossible de créer le groupe'));
        }
        setIsSaving(false);
    };

    const handleAddMember = async () => {
        if (!selectedGroup || !selectedUserId) return;

        setIsSaving(true);
        try {
            // Check if already a member
            const { data: existing } = await supabase
                .from('prayer_group_members')
                .select('id')
                .eq('group_id', selectedGroup.id)
                .eq('user_id', selectedUserId)
                .single();

            if (existing) {
                toast.error('Cet utilisateur est déjà membre du groupe');
                setIsSaving(false);
                return;
            }

            const { error } = await supabase
                .from('prayer_group_members')
                .insert({
                    group_id: selectedGroup.id,
                    user_id: selectedUserId,
                    role: 'member'
                });

            if (error) throw error;

            toast.success('Membre ajouté!');
            setIsAddMemberDialogOpen(false);
            setSelectedUserId('');
            fetchGroupMembers(selectedGroup.id);
            fetchGroups();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!selectedGroup) return;

        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;

            toast.success('Membre retiré');
            fetchGroupMembers(selectedGroup.id);
            fetchGroups();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: 'admin' | 'moderator' | 'member') => {
        try {
            const { error } = await supabase
                .from('prayer_group_members')
                .update({ role: newRole })
                .eq('id', memberId);

            if (error) throw error;

            toast.success('Rôle mis à jour');
            if (selectedGroup) fetchGroupMembers(selectedGroup.id);
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleToggleUrgent = async (groupId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('prayer_groups')
                .update({ is_urgent: !currentStatus })
                .eq('id', groupId);

            if (error) throw error;

            toast.success(currentStatus ? 'Urgence retirée' : 'Marqué comme urgent');
            fetchGroups();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleToggleOpen = async (groupId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('prayer_groups')
                .update({ is_open: !currentStatus })
                .eq('id', groupId);

            if (error) throw error;

            toast.success(currentStatus ? 'Groupe fermé' : 'Groupe ouvert');
            fetchGroups();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe? Cette action est irréversible.')) return;

        try {
            // Use admin API to bypass RLS - delete members first
            await fetch('/api/admin/delete-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table: 'prayer_group_members', id: groupId, key: 'group_id' }),
            });
            // Delete messages
            await fetch('/api/admin/delete-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table: 'prayer_group_messages', id: groupId, key: 'group_id' }),
            });
            // Delete group itself
            const res = await fetch('/api/admin/delete-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table: 'prayer_groups', id: groupId }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            toast.success('Groupe supprimé avec succès');
            fetchGroups();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    // Filter groups
    const filteredGroups = groups.filter(group =>
        searchQuery === '' ||
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Pagination
    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
    const paginatedGroups = filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Stats
    const stats = {
        total: groups.length,
        urgent: groups.filter(g => g.is_urgent).length,
        closed: groups.filter(g => !g.is_open).length,
        totalMembers: groups.reduce((acc, g) => acc + (g.member_count || 0), 0)
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return 'G';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        Groupes de Prière
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Gérez les groupes de prière de la communauté
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchGroups}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>

                    {/* Create Group Dialog */}
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-500">
                                <Plus className="mr-2 h-4 w-4" />
                                Créer un groupe
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-indigo-500" />
                                    Nouveau groupe de prière
                                </DialogTitle>
                                <DialogDescription>
                                    Créez un groupe pour rassembler les priants
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nom du groupe *</Label>
                                    <Input
                                        placeholder="Groupe de prière pour..."
                                        value={newGroup.name}
                                        onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Décrivez le but de ce groupe..."
                                        value={newGroup.description}
                                        onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                                        rows={3}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Nombre max de membres</Label>
                                    <Input
                                        type="number"
                                        value={newGroup.max_members}
                                        onChange={(e) => setNewGroup(prev => ({ ...prev, max_members: parseInt(e.target.value) || 50 }))}
                                        min={2}
                                        max={1000}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Unlock className="h-4 w-4 text-green-500" />
                                        <Label>Groupe ouvert</Label>
                                    </div>
                                    <Switch
                                        checked={newGroup.is_open}
                                        onCheckedChange={(checked) => setNewGroup(prev => ({ ...prev, is_open: checked }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        <Label className="text-red-400">Urgent</Label>
                                    </div>
                                    <Switch
                                        checked={newGroup.is_urgent}
                                        onCheckedChange={(checked) => setNewGroup(prev => ({ ...prev, is_urgent: checked }))}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleCreateGroup} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Créer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.total}</div>
                                <p className="text-sm text-muted-foreground">Total groupes</p>
                            </div>
                            <Users className="h-8 w-8 text-blue-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.urgent}</div>
                                <p className="text-sm text-muted-foreground">Urgents</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.closed}</div>
                                <p className="text-sm text-muted-foreground">Fermés</p>
                            </div>
                            <Lock className="h-8 w-8 text-orange-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                                <p className="text-sm text-muted-foreground">Membres total</p>
                            </div>
                            <UserPlus className="h-8 w-8 text-green-500/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un groupe..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Groups Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Groupe</TableHead>
                                <TableHead>Créateur</TableHead>
                                <TableHead>Membres</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Créé</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedGroups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                            <Users className="h-12 w-12 text-muted-foreground/50" />
                                            <p className="text-muted-foreground">
                                                {searchQuery ? 'Aucun groupe trouvé' : 'Aucun groupe'}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedGroups.map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                                                    group.is_urgent ? "bg-gradient-to-br from-red-500 to-orange-500" : "bg-gradient-to-br from-indigo-500 to-purple-500"
                                                )}>
                                                    <Users className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium flex items-center gap-2">
                                                        {group.name}
                                                        {group.is_urgent && (
                                                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                                                URGENT
                                                            </Badge>
                                                        )}
                                                    </p>
                                                    {group.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{group.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={group.creator?.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs bg-slate-600">
                                                        {getInitials(group.creator?.full_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm">{group.creator?.full_name || 'Inconnu'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {group.member_count || 0} / {group.max_members}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {group.is_open ? (
                                                <Badge variant="outline" className="text-green-500 border-green-500/30">
                                                    <Unlock className="h-3 w-3 mr-1" />
                                                    Ouvert
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                                                    <Lock className="h-3 w-3 mr-1" />
                                                    Fermé
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(new Date(group.created_at), { addSuffix: true, locale: fr })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setSelectedGroup(group);
                                                        fetchGroupMembers(group.id);
                                                        fetchAllUsers();
                                                        setIsMembersDialogOpen(true);
                                                    }}>
                                                        <UserPlus className="h-4 w-4 mr-2" />
                                                        Gérer les membres
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        // Generate deterministic Meet link from group name
                                                        const segment = (len: number) => {
                                                            const chars = 'abcdefghijklmnopqrstuvwxyz';
                                                            let hash = 0;
                                                            const seed = group.id + group.name;
                                                            for (let i = 0; i < seed.length; i++) {
                                                                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                                                                hash |= 0;
                                                            }
                                                            let result = '';
                                                            for (let i = 0; i < len; i++) {
                                                                hash = Math.abs((hash * 16807) % 2147483647);
                                                                result += chars[hash % chars.length];
                                                            }
                                                            return result;
                                                        };
                                                        const meetUrl = `https://meet.google.com/${segment(3)}-${segment(4)}-${segment(3)}`;
                                                        navigator.clipboard.writeText(meetUrl);
                                                        window.open(meetUrl, '_blank');
                                                        toast.success('Lien Meet copié et ouvert !', {
                                                            description: meetUrl
                                                        });
                                                    }}>
                                                        <Video className="h-4 w-4 mr-2 text-green-500" />
                                                        Lancer un appel vidéo
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleToggleUrgent(group.id, group.is_urgent)}>
                                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                                        {group.is_urgent ? 'Retirer urgence' : 'Marquer urgent'}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggleOpen(group.id, group.is_open)}>
                                                        {group.is_open ? (
                                                            <>
                                                                <Lock className="h-4 w-4 mr-2" />
                                                                Fermer le groupe
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Unlock className="h-4 w-4 mr-2" />
                                                                Ouvrir le groupe
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        className="text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Supprimer
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                {filteredGroups.length} groupe(s) • Page {currentPage} sur {totalPages}
                            </p>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Manage Members Dialog */}
            <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-indigo-500" />
                            Membres de "{selectedGroup?.name}"
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Button
                            onClick={() => setIsAddMemberDialogOpen(true)}
                            className="w-full bg-indigo-600 hover:bg-indigo-500"
                        >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Ajouter un membre
                        </Button>

                        {loadingMembers ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : groupMembers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Aucun membre</p>
                        ) : (
                            <div className="space-y-2">
                                {groupMembers.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.profile?.avatar_url || undefined} />
                                                <AvatarFallback className="text-xs">
                                                    {getInitials(member.profile?.full_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium flex items-center gap-2">
                                                    {member.profile?.full_name || 'Inconnu'}
                                                    {member.role === 'admin' && (
                                                        <Crown className="h-3 w-3 text-yellow-500" />
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={member.role}
                                                onValueChange={(v) => handleUpdateMemberRole(member.id, v as any)}
                                            >
                                                <SelectTrigger className="w-28 h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="moderator">Modérateur</SelectItem>
                                                    <SelectItem value="member">Membre</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveMember(member.id)}
                                                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajouter un membre</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher un utilisateur..."
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {allUsers
                                .filter(u =>
                                    userSearchQuery === '' ||
                                    u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase())
                                )
                                .slice(0, 20)
                                .map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                                            selectedUserId === user.id ? "bg-indigo-500/20 border border-indigo-500/30" : "hover:bg-muted"
                                        )}
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {getInitials(user.full_name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{user.full_name || 'Sans nom'}</span>
                                        {selectedUserId === user.id && (
                                            <CheckCircle2 className="h-4 w-4 text-indigo-500 ml-auto" />
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddMemberDialogOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleAddMember}
                            disabled={!selectedUserId || isSaving}
                            className="bg-indigo-600 hover:bg-indigo-500"
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ajouter
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
