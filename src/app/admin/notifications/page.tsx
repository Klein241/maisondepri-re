"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Send, Bell, Loader2, Users, User, Search, Check, X } from "lucide-react"
import { toast } from "sonner"

interface UserProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
}

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: "",
        message: "",
        type: "info"
    })

    const [targetMode, setTargetMode] = useState<'all' | 'individual' | 'multiple'>('all')
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showUserPicker, setShowUserPicker] = useState(false)

    const [history, setHistory] = useState<any[]>([])

    useEffect(() => {
        fetchHistory()
    }, [])

    useEffect(() => {
        if (targetMode !== 'all') {
            fetchUsers()
        }
    }, [targetMode])

    const fetchUsers = async () => {
        setLoadingUsers(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .order('full_name', { ascending: true })
            .limit(100)

        if (!error && data) {
            setUsers(data)
        }
        setLoadingUsers(false)
    }

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)
        if (data) setHistory(data)
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title.trim() || !formData.message.trim()) {
            toast.error("Le titre et le message sont requis")
            return
        }

        setLoading(true)

        try {
            if (targetMode === 'all') {
                // Send to all users using RPC
                const { error } = await supabase.rpc('broadcast_notification', {
                    notif_title: formData.title,
                    notif_message: formData.message,
                    notif_type: formData.type
                });
                if (error) throw error
                toast.success("Notification envoyée à tous les utilisateurs!")
            } else {
                // Send to selected users individually
                if (selectedUsers.length === 0) {
                    toast.error("Sélectionnez au moins un utilisateur")
                    setLoading(false)
                    return
                }

                const notifications = selectedUsers.map(userId => ({
                    user_id: userId,
                    title: formData.title,
                    message: formData.message,
                    type: formData.type,
                    is_read: false
                }))

                const { error } = await supabase
                    .from('notifications')
                    .insert(notifications)

                if (error) throw error
                toast.success(`Notification envoyée à ${selectedUsers.length} utilisateur(s)!`)
            }

            // Also send browser push notification via Service Worker
            try {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: formData.title,
                        body: formData.message,
                        tag: `admin-notif-${Date.now()}`,
                        url: '/',
                    });
                }
            } catch (pushErr) {
                console.warn('Push notification fallback:', pushErr);
            }

            setFormData({ title: "", message: "", type: "info" })
            setSelectedUsers([])
            setTargetMode('all')
            fetchHistory()
        } catch (error: any) {
            console.error(error);
            toast.error("Erreur: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const filteredUsers = users.filter(user =>
        searchQuery === '' ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            success: "bg-green-500/20 text-green-400 border-green-500/30",
            warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
            error: "bg-red-500/20 text-red-400 border-red-500/30",
            prayer: "bg-pink-500/20 text-pink-400 border-pink-500/30"
        }
        return <Badge variant="outline" className={styles[type] || styles.info}>{type}</Badge>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                    Communications
                </h2>
                <p className="text-muted-foreground mt-1">
                    Envoyez des notifications et annonces à vos utilisateurs.
                </p>
            </div>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="bg-indigo-500/10 p-2 rounded-lg">
                            <Bell className="h-5 w-5 text-indigo-500" />
                        </div>
                        Nouvelle Notification
                    </CardTitle>
                    <CardDescription>
                        Envoyez un message push instantané qui s'affichera en pop-up chez les utilisateurs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSend} className="space-y-6">
                        {/* Target Mode Selection */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Destinataires</Label>
                            <Tabs value={targetMode} onValueChange={(v) => setTargetMode(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="all" className="gap-2">
                                        <Users className="h-4 w-4" />
                                        Tous les utilisateurs
                                    </TabsTrigger>
                                    <TabsTrigger value="individual" className="gap-2">
                                        <User className="h-4 w-4" />
                                        Utilisateurs spécifiques
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* User Selection for Individual Mode */}
                        {targetMode === 'individual' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Sélectionner les utilisateurs</Label>
                                    {selectedUsers.length > 0 && (
                                        <Badge variant="secondary" className="gap-1">
                                            <Check className="h-3 w-3" />
                                            {selectedUsers.length} sélectionné(s)
                                        </Badge>
                                    )}
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher un utilisateur..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                <div className="border rounded-lg max-h-[250px] overflow-hidden">
                                    {loadingUsers ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-[250px]">
                                            {filteredUsers.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className={`flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer border-b last:border-0 transition-colors ${selectedUsers.includes(user.id) ? 'bg-indigo-500/10' : ''
                                                        }`}
                                                    onClick={() => toggleUserSelection(user.id)}
                                                >
                                                    <Checkbox
                                                        checked={selectedUsers.includes(user.id)}
                                                        onCheckedChange={() => toggleUserSelection(user.id)}
                                                    />
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={user.avatar_url || undefined} />
                                                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs">
                                                            {user.full_name?.[0] || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {user.full_name || 'Sans nom'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                    {selectedUsers.includes(user.id) && (
                                                        <Check className="h-4 w-4 text-indigo-500" />
                                                    )}
                                                </div>
                                            ))}
                                            {filteredUsers.length === 0 && (
                                                <div className="py-8 text-center text-muted-foreground text-sm">
                                                    Aucun utilisateur trouvé
                                                </div>
                                            )}
                                        </ScrollArea>
                                    )}
                                </div>

                                {selectedUsers.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedUsers.slice(0, 5).map(userId => {
                                            const user = users.find(u => u.id === userId)
                                            return (
                                                <Badge
                                                    key={userId}
                                                    variant="secondary"
                                                    className="gap-1 pr-1"
                                                >
                                                    {user?.full_name || 'Utilisateur'}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 p-0 hover:bg-transparent"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            toggleUserSelection(userId)
                                                        }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </Badge>
                                            )
                                        })}
                                        {selectedUsers.length > 5 && (
                                            <Badge variant="outline">+{selectedUsers.length - 5} autres</Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="type">Type de notification</Label>
                                <Select
                                    value={formData.type || 'info'}
                                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="info">📢 Information</SelectItem>
                                        <SelectItem value="success">✅ Succès</SelectItem>
                                        <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                                        <SelectItem value="error">❌ Erreur</SelectItem>
                                        <SelectItem value="prayer">🙏 Prière</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Titre *</Label>
                                <Input
                                    id="title"
                                    placeholder="Ex: Encouragement du jour"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="message">Message *</Label>
                            <Textarea
                                id="message"
                                placeholder="Votre message ici..."
                                rows={4}
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                required
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                {formData.message.length}/140 caractères recommandés
                            </p>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 h-12 text-base font-semibold"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Envoi en cours...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-5 w-5" />
                                    {targetMode === 'all'
                                        ? 'Envoyer à tous les utilisateurs'
                                        : `Envoyer à ${selectedUsers.length} utilisateur(s)`
                                    }
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Historique récent</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic text-center py-6">
                                Aucune notification envoyée.
                            </p>
                        ) : (
                            history.map((notif) => (
                                <div key={notif.id} className="flex items-start justify-between pb-4 border-b last:border-0 last:pb-0">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium">{notif.title}</h4>
                                            {getTypeBadge(notif.type)}
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2">{notif.message}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 shrink-0 ml-4">
                                        <Check className="h-3 w-3 mr-1" />
                                        Envoyé
                                    </Badge>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
