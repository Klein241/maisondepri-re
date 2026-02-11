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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, UserPlus, MoreVertical, Shield, ShieldCheck, User,
    Phone, Mail, Trash2, Edit, Search, RefreshCw, Users, UserCog,
    CheckCircle2, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin' | 'moderator';
    city: string | null;
    church: string | null;
    country: string | null;
    is_active: boolean;
    created_at: string;
    last_seen: string | null;
}

type IdentifierType = 'email' | 'phone';

export default function UsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // Add User Dialog
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [identifierType, setIdentifierType] = useState<IdentifierType>('phone');
    const [newUser, setNewUser] = useState({
        identifier: '',
        full_name: '',
        role: 'user' as 'user' | 'admin' | 'moderator',
        password: '',
        city: '',
        church: '',
        country: ''
    });

    // Edit User Dialog
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (e: any) {
            console.error('Error fetching users:', e);
            toast.error('Erreur de chargement des utilisateurs');
        }
        setIsLoading(false);
    };

    const handleAddUser = async () => {
        if (!newUser.identifier.trim()) {
            toast.error(identifierType === 'phone' ? 'Le numéro de téléphone est requis' : 'L\'email est requis');
            return;
        }

        if (!newUser.password || newUser.password.length < 6) {
            toast.error('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        setIsSaving(true);
        try {
            // Build email from phone if needed
            let email: string;
            let phone: string | null = null;

            if (identifierType === 'phone') {
                let cleanPhone = newUser.identifier.trim().replace(/\D/g, '');
                email = `${cleanPhone}@prayermarathon.app`;
                phone = newUser.identifier.trim();
                if (!phone.startsWith('+')) {
                    phone = '+' + phone;
                }
            } else {
                email = newUser.identifier.trim();
            }

            // Call our API route that uses admin client
            const response = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password: newUser.password,
                    full_name: newUser.full_name || null,
                    role: newUser.role,
                    phone,
                    city: newUser.city || null,
                    church: newUser.church || null,
                    country: newUser.country || null
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erreur lors de la création');
            }

            toast.success('Utilisateur créé avec succès! Il peut maintenant se connecter.');
            setIsAddDialogOpen(false);
            resetNewUser();
            fetchUsers();

        } catch (e: any) {
            console.error('Error creating user:', e);
            toast.error('Erreur: ' + (e.message || 'Impossible de créer l\'utilisateur'));
        }
        setIsSaving(false);
    };

    const handleUpdateRole = async (userId: string, newRole: 'user' | 'admin' | 'moderator') => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            toast.success('Rôle mis à jour');
            fetchUsers();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleToggleActive = async (userId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: !currentStatus })
                .eq('id', userId);

            if (error) throw error;

            toast.success(currentStatus ? 'Utilisateur désactivé' : 'Utilisateur activé');
            fetchUsers();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editingUser.full_name,
                    phone: editingUser.phone,
                    city: editingUser.city,
                    church: editingUser.church,
                    country: editingUser.country,
                    role: editingUser.role
                })
                .eq('id', editingUser.id);

            if (error) throw error;

            toast.success('Utilisateur mis à jour');
            setEditingUser(null);
            fetchUsers();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const resetNewUser = () => {
        setNewUser({
            identifier: '',
            full_name: '',
            role: 'user',
            password: '',
            city: '',
            church: '',
            country: ''
        });
    };

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch = searchQuery === '' ||
            user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.phone?.includes(searchQuery);

        const matchesRole = roleFilter === 'all' || user.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Stats
    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        moderators: users.filter(u => u.role === 'moderator').length,
        active: users.filter(u => u.is_active).length
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Admin</Badge>;
            case 'moderator':
                return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Modérateur</Badge>;
            default:
                return <Badge variant="secondary">Utilisateur</Badge>;
        }
    };

    const getInitials = (name: string | null) => {
        if (!name) return 'U';
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
                        Utilisateurs
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Gérez les utilisateurs et leurs rôles
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchUsers}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>

                    {/* Add User Dialog */}
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-500">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Ajouter
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-indigo-500" />
                                    Nouvel utilisateur
                                </DialogTitle>
                                <DialogDescription>
                                    Créez un compte utilisateur par email ou téléphone
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                {/* Identifier Type Tabs */}
                                <Tabs value={identifierType} onValueChange={(v) => setIdentifierType(v as IdentifierType)}>
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="phone" className="gap-2">
                                            <Phone className="h-4 w-4" />
                                            Téléphone
                                        </TabsTrigger>
                                        <TabsTrigger value="email" className="gap-2">
                                            <Mail className="h-4 w-4" />
                                            Email
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                {/* Identifier Input */}
                                <div className="space-y-2">
                                    <Label>{identifierType === 'phone' ? 'Numéro de téléphone' : 'Adresse email'} *</Label>
                                    <div className="relative">
                                        {identifierType === 'phone' ? (
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        )}
                                        <Input
                                            type={identifierType === 'phone' ? 'tel' : 'email'}
                                            placeholder={identifierType === 'phone' ? '+33612345678' : 'email@exemple.com'}
                                            value={newUser.identifier}
                                            onChange={(e) => setNewUser(prev => ({ ...prev, identifier: e.target.value }))}
                                            className="pl-10"
                                        />
                                    </div>
                                    {identifierType === 'phone' && (
                                        <p className="text-xs text-muted-foreground">
                                            Format international recommandé (ex: +33612345678)
                                        </p>
                                    )}
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <Label>Mot de passe *</Label>
                                    <Input
                                        type="password"
                                        placeholder="Minimum 6 caractères"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                    />
                                </div>

                                {/* Full Name */}
                                <div className="space-y-2">
                                    <Label>Nom complet</Label>
                                    <Input
                                        placeholder="Jean Dupont"
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                                    />
                                </div>

                                {/* Role */}
                                <div className="space-y-2">
                                    <Label>Rôle</Label>
                                    <Select
                                        value={newUser.role}
                                        onValueChange={(v) => setNewUser(prev => ({ ...prev, role: v as any }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Utilisateur
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="moderator">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-4 w-4" />
                                                    Modérateur
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="admin">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck className="h-4 w-4" />
                                                    Administrateur
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Additional Info */}
                                <div className="grid gap-3 grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Ville</Label>
                                        <Input
                                            placeholder="Paris"
                                            value={newUser.city}
                                            onChange={(e) => setNewUser(prev => ({ ...prev, city: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pays</Label>
                                        <Input
                                            placeholder="France"
                                            value={newUser.country}
                                            onChange={(e) => setNewUser(prev => ({ ...prev, country: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Église/Communauté</Label>
                                    <Input
                                        placeholder="Nom de l'église"
                                        value={newUser.church}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, church: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleAddUser} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
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
                                <p className="text-sm text-muted-foreground">Total utilisateurs</p>
                            </div>
                            <Users className="h-8 w-8 text-blue-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.admins}</div>
                                <p className="text-sm text-muted-foreground">Administrateurs</p>
                            </div>
                            <ShieldCheck className="h-8 w-8 text-red-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.moderators}</div>
                                <p className="text-sm text-muted-foreground">Modérateurs</p>
                            </div>
                            <Shield className="h-8 w-8 text-purple-500/50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold">{stats.active}</div>
                                <p className="text-sm text-muted-foreground">Utilisateurs actifs</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-green-500/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher par nom, email ou téléphone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrer par rôle" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les rôles</SelectItem>
                        <SelectItem value="user">Utilisateurs</SelectItem>
                        <SelectItem value="moderator">Modérateurs</SelectItem>
                        <SelectItem value="admin">Administrateurs</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Users Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Utilisateur</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Inscription</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                            <Users className="h-12 w-12 text-muted-foreground/50" />
                                            <p className="text-muted-foreground">
                                                {searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedUsers.map((user) => (
                                    <TableRow key={user.id} className={cn(!user.is_active && "opacity-50")}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={user.avatar_url || undefined} />
                                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs">
                                                        {getInitials(user.full_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.full_name || 'Sans nom'}</p>
                                                    {user.church && (
                                                        <p className="text-xs text-muted-foreground">{user.church}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-0.5">
                                                {user.phone && (
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                                        {user.phone}
                                                    </div>
                                                )}
                                                {user.email && (
                                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        {user.email}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                                        <TableCell>
                                            {user.is_active ? (
                                                <Badge variant="outline" className="text-green-500 border-green-500/30">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Actif
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-red-500 border-red-500/30">
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                    Inactif
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(user.created_at).toLocaleDateString('fr-FR')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setEditingUser(user)}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Modifier
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'user')}>
                                                        <User className="h-4 w-4 mr-2" />
                                                        Définir comme Utilisateur
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'moderator')}>
                                                        <Shield className="h-4 w-4 mr-2" />
                                                        Définir comme Modérateur
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'admin')}>
                                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                                        Définir comme Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleToggleActive(user.id, user.is_active)}
                                                        className={user.is_active ? "text-red-500" : "text-green-500"}
                                                    >
                                                        {user.is_active ? (
                                                            <>
                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                Désactiver
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                Activer
                                                            </>
                                                        )}
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
                                {filteredUsers.length} utilisateur(s) • Page {currentPage} sur {totalPages}
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

            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5 text-indigo-500" />
                            Modifier l'utilisateur
                        </DialogTitle>
                    </DialogHeader>

                    {editingUser && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nom complet</Label>
                                <Input
                                    value={editingUser.full_name || ''}
                                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Téléphone</Label>
                                <Input
                                    value={editingUser.phone || ''}
                                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, phone: e.target.value } : null)}
                                />
                            </div>

                            <div className="grid gap-3 grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Ville</Label>
                                    <Input
                                        value={editingUser.city || ''}
                                        onChange={(e) => setEditingUser(prev => prev ? { ...prev, city: e.target.value } : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Pays</Label>
                                    <Input
                                        value={editingUser.country || ''}
                                        onChange={(e) => setEditingUser(prev => prev ? { ...prev, country: e.target.value } : null)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Église</Label>
                                <Input
                                    value={editingUser.church || ''}
                                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, church: e.target.value } : null)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Rôle</Label>
                                <Select
                                    value={editingUser.role}
                                    onValueChange={(v) => setEditingUser(prev => prev ? { ...prev, role: v as any } : null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">Utilisateur</SelectItem>
                                        <SelectItem value="moderator">Modérateur</SelectItem>
                                        <SelectItem value="admin">Administrateur</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>
                            Annuler
                        </Button>
                        <Button onClick={handleUpdateUser} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
