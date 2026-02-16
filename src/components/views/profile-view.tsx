"use client"

import { useState, useRef, useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
    Trophy,
    Flame,
    Calendar,
    Settings,
    Moon,
    Bell,
    LogOut,
    Share2,
    ChevronRight,
    User as UserIcon,
    MapPin,
    Camera,
    Loader2,
    Phone,
    Lock,
    Eye,
    EyeOff,
    KeyRound,
    Save,
    CheckCircle,
    Mail,
    Users,
    ArrowRightLeft,
    Crown,
    Plus,
    X,
    CheckCircle2,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { AuthView } from "./auth-view"
import { supabase } from "@/lib/supabase"

export function ProfileView() {
    const { user, streak, totalDaysCompleted, achievements, unlockedAchievements, signOut, theme, setTheme, setUser } = useAppStore()
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Password change state
    const [showPasswordSection, setShowPasswordSection] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [isChangingPw, setIsChangingPw] = useState(false)
    const [forgotPwSent, setForgotPwSent] = useState(false)
    const [isSendingReset, setIsSendingReset] = useState(false)

    // Phone edit state
    const [editingPhone, setEditingPhone] = useState(false)
    const [phoneValue, setPhoneValue] = useState(user?.whatsapp || '')
    const [isSavingPhone, setIsSavingPhone] = useState(false)

    // Recovery email state
    const [editingRecoveryEmail, setEditingRecoveryEmail] = useState(false)
    const [recoveryEmailValue, setRecoveryEmailValue] = useState('')
    const [isSavingRecoveryEmail, setIsSavingRecoveryEmail] = useState(false)

    // Community management state
    const [showCommunity, setShowCommunity] = useState(false)
    const [myGroups, setMyGroups] = useState<any[]>([])
    const [isLoadingGroups, setIsLoadingGroups] = useState(false)
    const [showMigrateDialog, setShowMigrateDialog] = useState(false)
    const [migrateSourceGroup, setMigrateSourceGroup] = useState<string | null>(null)
    const [migrateTargetGroup, setMigrateTargetGroup] = useState<string | null>(null)
    const [isMigrating, setIsMigrating] = useState(false)

    // Load recovery email on mount
    useEffect(() => {
        const loadRecoveryEmail = async () => {
            if (!user) return
            const { data } = await supabase.from('profiles').select('recovery_email').eq('id', user.id).single()
            if (data?.recovery_email) setRecoveryEmailValue(data.recovery_email)
        }
        loadRecoveryEmail()
    }, [user?.id])

    // Load user groups for community management
    const loadMyGroups = async () => {
        if (!user) return
        setIsLoadingGroups(true)
        try {
            // Get groups created by user
            const { data: created } = await supabase
                .from('prayer_groups')
                .select('*, member_count:prayer_group_members(count)')
                .eq('created_by', user.id)
                .order('created_at', { ascending: false })

            // Get groups user is member of
            const { data: memberships } = await supabase
                .from('prayer_group_members')
                .select('group_id')
                .eq('user_id', user.id)

            const memberGroupIds = (memberships || []).map((m: any) => m.group_id)
            let joinedGroups: any[] = []
            if (memberGroupIds.length > 0) {
                const { data: joined } = await supabase
                    .from('prayer_groups')
                    .select('*, member_count:prayer_group_members(count)')
                    .in('id', memberGroupIds)
                    .neq('created_by', user.id)
                    .order('created_at', { ascending: false })
                joinedGroups = joined || []
            }

            const all = [
                ...(created || []).map((g: any) => ({ ...g, role: 'admin', member_count: g.member_count?.[0]?.count || 0 })),
                ...joinedGroups.map((g: any) => ({ ...g, role: 'member', member_count: g.member_count?.[0]?.count || 0 }))
            ]
            setMyGroups(all)
        } catch (err) {
            console.error('Error loading groups:', err)
        }
        setIsLoadingGroups(false)
    }

    // Migrate members from one group to another
    const handleMigrateMembers = async () => {
        if (!migrateSourceGroup || !migrateTargetGroup || migrateSourceGroup === migrateTargetGroup) {
            toast.error('Veuillez sélectionner deux groupes différents')
            return
        }
        setIsMigrating(true)
        try {
            // Get all members from source group
            const { data: sourceMembers, error: fetchErr } = await supabase
                .from('prayer_group_members')
                .select('user_id, role')
                .eq('group_id', migrateSourceGroup)

            if (fetchErr) throw fetchErr

            // Get existing members in target
            const { data: targetMembers } = await supabase
                .from('prayer_group_members')
                .select('user_id')
                .eq('group_id', migrateTargetGroup)

            const existingIds = new Set((targetMembers || []).map((m: any) => m.user_id))
            const toMigrate = (sourceMembers || []).filter((m: any) => !existingIds.has(m.user_id))

            if (toMigrate.length === 0) {
                toast.info('Tous les membres sont déjà dans le groupe cible')
                setIsMigrating(false)
                return
            }

            // Insert new members into target group
            const { error: insertErr } = await supabase
                .from('prayer_group_members')
                .insert(toMigrate.map((m: any) => ({
                    group_id: migrateTargetGroup,
                    user_id: m.user_id,
                    role: 'member'
                })))

            if (insertErr) throw insertErr

            toast.success(`${toMigrate.length} membres migrés avec succès !`)
            setShowMigrateDialog(false)
            setMigrateSourceGroup(null)
            setMigrateTargetGroup(null)
            loadMyGroups()
        } catch (err: any) {
            toast.error('Erreur lors de la migration: ' + (err.message || ''))
        }
        setIsMigrating(false)
    }

    // Mark prayer as answered — triggers 24h closure
    const handlePrayerAnswered = async (groupId: string, groupName: string) => {
        try {
            // Get admin's other groups to suggest
            const adminGroups = myGroups.filter(g => g.role === 'admin' && g.id !== groupId)

            // Send announcement message
            const suggestionList = adminGroups.length > 0
                ? adminGroups.map((g: any) => `• ${g.name}`).join('\n')
                : 'Aucun autre groupe disponible pour le moment.'

            const announcement = `🙏 **PRIÈRE EXAUCÉE !** 🎉\n\nCe sujet de prière pour lequel nous prions a été exaucé ! Merci pour votre participation à tous !\n\nDe ce fait, ce groupe sera fermé dans 24h.\n\nVeuillez rejoindre ces groupes :\n${suggestionList}\n\n— L'administrateur`

            await supabase.from('prayer_group_messages').insert({
                group_id: groupId,
                user_id: user!.id,
                content: announcement,
                type: 'text'
            })

            // Update group to schedule closure (set a closing_at timestamp)
            const closingAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            await supabase.from('prayer_groups').update({
                description: `🙏 PRIÈRE EXAUCÉE — Fermeture le ${new Date(closingAt).toLocaleDateString('fr-FR')} à ${new Date(closingAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                is_urgent: false,
            }).eq('id', groupId)

            toast.success('Prière marquée comme exaucée ! Le groupe sera fermé dans 24h.')
            loadMyGroups()
        } catch (err) {
            toast.error('Erreur lors de la mise à jour')
        }
    }

    if (!user) {
        return (
            <div className="relative min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24">
                <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                    <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-pink-600/5 blur-[150px] rounded-full" />
                    <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/5 blur-[150px] rounded-full" />
                </div>
                <div className="relative z-10 max-w-4xl mx-auto w-full pt-8 px-4">
                    <AuthView />
                </div>
            </div>
        )
    }

    // Handle avatar upload
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Veuillez sélectionner une image')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('L\'image est trop grande (max 5MB)')
            return
        }

        setIsUploading(true)
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
            const filePath = `avatars/${user.id}/avatar_${Date.now()}.${fileExt}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(filePath, file, {
                    contentType: file.type,
                    cacheControl: '3600',
                    upsert: true,
                })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                throw uploadError
            }

            const { data: { publicUrl } } = supabase.storage
                .from('chat-media')
                .getPublicUrl(filePath)

            const { error: profileError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id)

            if (profileError) {
                console.error('Profile update error:', profileError)
            }

            await supabase.auth.updateUser({
                data: { avatar_url: publicUrl }
            })

            setUser({
                ...user,
                avatar: publicUrl,
            })

            toast.success('Photo de profil mise à jour !')
        } catch (err: any) {
            console.error('Avatar upload error:', err)
            toast.error('Erreur lors de l\'upload de la photo')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Handle password change
    const handlePasswordChange = async () => {
        if (!newPassword || !confirmPassword) {
            toast.error('Veuillez remplir tous les champs')
            return
        }
        if (newPassword.length < 6) {
            toast.error('Le mot de passe doit contenir au moins 6 caractères')
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error('Les mots de passe ne correspondent pas')
            return
        }

        setIsChangingPw(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })
            if (error) throw error
            toast.success('Mot de passe modifié avec succès !')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setShowPasswordSection(false)
        } catch (err: any) {
            console.error('Password change error:', err)
            toast.error(err.message || 'Erreur lors du changement de mot de passe')
        } finally {
            setIsChangingPw(false)
        }
    }

    // Handle forgot password (send reset email)
    const handleForgotPassword = async () => {
        setIsSendingReset(true)
        try {
            // Check if user has a recovery email
            const { data: profile } = await supabase.from('profiles').select('recovery_email').eq('id', user.id).single()
            const email = profile?.recovery_email

            if (!email) {
                toast.error('Aucun email de récupération configuré. Ajoutez-en un dans votre profil pour pouvoir réinitialiser votre mot de passe.')
                setIsSendingReset(false)
                return
            }

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })
            if (error) {
                toast.info('Contactez un administrateur pour réinitialiser votre mot de passe. Votre identifiant est : ' + (user.whatsapp || user.email))
            } else {
                setForgotPwSent(true)
                toast.success(`Instructions de réinitialisation envoyées à ${email} !`)
            }
        } catch (err: any) {
            toast.info('Contactez un administrateur pour réinitialiser votre mot de passe.')
        } finally {
            setIsSendingReset(false)
        }
    }

    // Handle phone save
    const handleSavePhone = async () => {
        if (!phoneValue.trim()) return
        setIsSavingPhone(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ whatsapp: phoneValue.trim() })
                .eq('id', user.id)

            if (error) throw error

            await supabase.auth.updateUser({
                data: { whatsapp: phoneValue.trim() }
            })

            setUser({ ...user, whatsapp: phoneValue.trim() })
            setEditingPhone(false)
            toast.success('Numéro mis à jour !')
        } catch (err: any) {
            console.error('Phone save error:', err)
            toast.error('Erreur lors de la mise à jour du numéro')
        } finally {
            setIsSavingPhone(false)
        }
    }

    // Handle recovery email save
    const handleSaveRecoveryEmail = async () => {
        if (!recoveryEmailValue.trim() || !recoveryEmailValue.includes('@')) {
            toast.error('Veuillez entrer un email valide')
            return
        }
        setIsSavingRecoveryEmail(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ recovery_email: recoveryEmailValue.trim() })
                .eq('id', user.id)

            if (error) throw error

            setEditingRecoveryEmail(false)
            toast.success('Email de récupération mis à jour !')
        } catch (err: any) {
            console.error('Recovery email save error:', err)
            toast.error('Erreur lors de la mise à jour de l\'email')
        } finally {
            setIsSavingRecoveryEmail(false)
        }
    }

    // Calculate level based on days completed
    const level = Math.floor(totalDaysCompleted / 5) + 1
    const nextLevelProgress = ((totalDaysCompleted % 5) / 5) * 100

    return (
        <div className="relative min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white pb-24 overflow-y-auto">
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-pink-600/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/5 blur-[150px] rounded-full" />
            </div>
            <div className="relative z-10 max-w-4xl mx-auto w-full pt-8 px-4">
                {/* Header Section */}
                <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="relative mb-4 group">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                        />
                        <Avatar className="h-24 w-24 border-4 border-primary shadow-xl">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                                {user.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        >
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                            ) : (
                                <Camera className="h-8 w-8 text-white" />
                            )}
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="absolute -bottom-1 -right-1 bg-primary hover:bg-primary/80 text-white rounded-full p-1.5 shadow-lg border-2 border-[#0B0E14] transition-colors cursor-pointer"
                        >
                            {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Camera className="h-4 w-4" />
                            )}
                        </button>
                        <Badge className="absolute -bottom-2 -left-2 px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 border-none text-white shadow-lg">
                            Niveau {level}
                        </Badge>
                    </div>

                    <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                        {user.name}
                    </h2>
                    {(user.city || user.country) && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{[user.city, user.country].filter(Boolean).join(', ')}</span>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 bg-muted/50 px-3 py-1 rounded-full">
                        Membre depuis {new Date(user.joinedAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <Card className="bg-card/50 backdrop-blur-sm border-orange-500/20 shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <Flame className="h-6 w-6 text-orange-500 mb-2" />
                            <span className="text-2xl font-bold">{streak}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Jours de suite</span>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 backdrop-blur-sm border-blue-500/20 shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <Calendar className="h-6 w-6 text-blue-500 mb-2" />
                            <span className="text-2xl font-bold">{totalDaysCompleted}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Jours finis</span>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/20 shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <Trophy className="h-6 w-6 text-yellow-500 mb-2" />
                            <span className="text-2xl font-bold">{unlockedAchievements.length}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Badges</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Level Progress */}
                <div className="mb-8">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progression Niveau {level}</span>
                        <span className="font-semibold">{Math.round(nextLevelProgress)}%</span>
                    </div>
                    <Progress value={nextLevelProgress} className="h-2" />
                </div>

                {/* Community Management Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-8"
                >
                    <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/20 backdrop-blur-sm overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-500/20 p-2.5 rounded-xl">
                                        <Users className="h-5 w-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-white">Ma Communauté</h3>
                                        <p className="text-[10px] text-slate-400">{myGroups.length} groupe{myGroups.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3"
                                    onClick={() => { setShowCommunity(!showCommunity); if (!showCommunity) loadMyGroups(); }}
                                >
                                    {showCommunity ? 'Fermer' : 'Gérer'}
                                    <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${showCommunity ? 'rotate-90' : ''}`} />
                                </Button>
                            </div>

                            {showCommunity && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-3 mt-3"
                                >
                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 text-xs h-8"
                                            onClick={() => { setShowMigrateDialog(true); }}
                                        >
                                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                                            Migrer les membres
                                        </Button>
                                    </div>

                                    {isLoadingGroups ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                                        </div>
                                    ) : myGroups.length === 0 ? (
                                        <p className="text-center text-xs text-slate-500 py-4">Aucun groupe trouvé</p>
                                    ) : (
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                            {myGroups.map((group: any) => (
                                                <div
                                                    key={group.id}
                                                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${group.is_urgent
                                                            ? 'bg-gradient-to-br from-red-500 to-orange-500'
                                                            : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                                            }`}>
                                                            {group.avatar_url ? (
                                                                <img src={group.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                            ) : (
                                                                <Users className="h-4 w-4 text-white" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-sm font-medium text-white truncate">{group.name}</p>
                                                                {group.role === 'admin' && (
                                                                    <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400">
                                                                {group.member_count} membre{group.member_count !== 1 ? 's' : ''}
                                                                {group.role === 'admin' ? ' • Admin' : ' • Membre'}
                                                            </p>
                                                        </div>
                                                        {/* Prayer answered button for prayer request groups */}
                                                        {group.role === 'admin' && group.prayer_request_id && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-[10px] text-green-400 hover:bg-green-500/10 hover:text-green-300 px-2"
                                                                onClick={() => handlePrayerAnswered(group.id, group.name)}
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                Exaucée
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Achievements Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-primary" />
                            Succès ({unlockedAchievements.length}/{achievements.length})
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {achievements.map((achievement) => {
                            const isUnlocked = unlockedAchievements.includes(achievement.id)
                            return (
                                <motion.div
                                    key={achievement.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <Card className={`h-full border-none shadow-sm transition-colors ${isUnlocked
                                        ? 'bg-gradient-to-br from-card to-primary/5'
                                        : 'bg-muted/50 opacity-60 grayscale'
                                        }`}>
                                        <CardContent className="p-4 flex flex-col items-center text-center h-full">
                                            <div className={`
                                        p-3 rounded-full mb-3 shadow-inner
                                        ${isUnlocked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}
                                    `}>
                                                <span className="text-2xl">{achievement.icon}</span>
                                            </div>
                                            <h4 className="font-semibold text-sm mb-1">{achievement.name}</h4>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{achievement.description}</p>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* Admin Link (Conditional) */}
                {user.role === 'admin' && (
                    <Button variant="outline" className="w-full mb-6 border-dashed border-primary/50 text-primary hover:bg-primary/5" onClick={() => window.location.href = '/admin'}>
                        <Settings className="mr-2 h-4 w-4" />
                        Accéder au Backoffice Admin
                    </Button>
                )}

                {/* Connection Details Section */}
                <div className="space-y-4 mb-8">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-indigo-400" />
                        Détails de connexion
                    </h3>

                    <Card className="bg-card/50 backdrop-blur-sm">
                        <CardContent className="p-0 divide-y divide-white/5">
                            {/* Phone Number */}
                            <div className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-500/10 p-2 rounded-lg text-green-500">
                                            <Phone className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Numéro WhatsApp</p>
                                            {editingPhone ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Input
                                                        type="tel"
                                                        value={phoneValue}
                                                        onChange={(e) => setPhoneValue(e.target.value)}
                                                        className="h-8 text-sm w-40 bg-white/5 border-white/10"
                                                        placeholder="+221 77..."
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8 px-2"
                                                        onClick={handleSavePhone}
                                                        disabled={isSavingPhone}
                                                    >
                                                        {isSavingPhone ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">
                                                    {user.whatsapp || 'Non renseigné'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {!editingPhone && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-indigo-400 hover:text-indigo-300"
                                            onClick={() => { setEditingPhone(true); setPhoneValue(user.whatsapp || ''); }}
                                        >
                                            Modifier
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Recovery Email Section */}
                            <div className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                                            <Mail className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Email de récupération</p>
                                            {editingRecoveryEmail ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Input
                                                        type="email"
                                                        value={recoveryEmailValue}
                                                        onChange={(e) => setRecoveryEmailValue(e.target.value)}
                                                        className="h-8 text-sm w-48 bg-white/5 border-white/10"
                                                        placeholder="votre@email.com"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8 px-2"
                                                        onClick={handleSaveRecoveryEmail}
                                                        disabled={isSavingRecoveryEmail}
                                                    >
                                                        {isSavingRecoveryEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">
                                                    {recoveryEmailValue || 'Non renseigné — Ajoutez un email pour réinitialiser votre mot de passe'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {!editingRecoveryEmail && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                            onClick={() => setEditingRecoveryEmail(true)}
                                        >
                                            {recoveryEmailValue ? 'Modifier' : 'Ajouter'}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Password Section */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Mot de passe</p>
                                            <p className="text-xs text-muted-foreground">••••••••</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-indigo-400 hover:text-indigo-300"
                                        onClick={() => setShowPasswordSection(!showPasswordSection)}
                                    >
                                        {showPasswordSection ? 'Annuler' : 'Modifier'}
                                    </Button>
                                </div>

                                {showPasswordSection && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="space-y-3 mt-3 pl-12"
                                    >
                                        <div className="relative">
                                            <Input
                                                type={showNewPw ? 'text' : 'password'}
                                                placeholder="Nouveau mot de passe"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="bg-white/5 border-white/10 pr-10 text-sm"
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPw(!showNewPw)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <Input
                                            type="password"
                                            placeholder="Confirmer le mot de passe"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="bg-white/5 border-white/10 text-sm"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button
                                                onClick={handlePasswordChange}
                                                disabled={isChangingPw}
                                                size="sm"
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                            >
                                                {isChangingPw ? (
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                ) : (
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                )}
                                                Enregistrer
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Forgot Password */}
                            <div className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-500/10 p-2 rounded-lg text-red-500">
                                            <KeyRound className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Mot de passe oublié ?</p>
                                            <p className="text-xs text-muted-foreground">Réinitialiser via l'administrateur</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-red-400 hover:text-red-300"
                                        onClick={handleForgotPassword}
                                        disabled={isSendingReset || forgotPwSent}
                                    >
                                        {isSendingReset ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : forgotPwSent ? (
                                            'Envoyé ✓'
                                        ) : (
                                            'Réinitialiser'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Settings Section */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Paramètres
                    </h3>

                    <Card>
                        <CardContent className="p-0 divide-y">
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500/10 p-2 rounded-lg text-purple-500">
                                        <Moon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Apparence</p>
                                        <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Mode sombre' : 'Mode clair'}</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={theme === 'dark'}
                                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                                        <Bell className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Notifications</p>
                                        <p className="text-xs text-muted-foreground">Rappels quotidiens</p>
                                    </div>
                                </div>
                                <Switch defaultChecked />
                            </div>

                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                    const shareData = {
                                        title: 'Marathon de Prière',
                                        text: 'Rejoins-moi sur l\'application Marathon de Prière ! Prions ensemble.',
                                        url: window.location.origin
                                    };
                                    if (navigator.share && navigator.canShare(shareData)) {
                                        navigator.share(shareData).catch(console.error);
                                    } else {
                                        navigator.clipboard.writeText(window.location.origin);
                                        toast.success('Lien copié dans le presse-papier !');
                                    }
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-500/10 p-2 rounded-lg text-green-500">
                                        <Share2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Inviter un ami</p>
                                        <p className="text-xs text-muted-foreground">Partagez l'application</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>

                            <div className="p-4">
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => signOut()}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Se déconnecter
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center mt-8 text-xs text-slate-600">
                    Version 1.0.0 • Marathon de Prière
                </div>

                {/* Migrate Members Dialog */}
                <Dialog open={showMigrateDialog} onOpenChange={setShowMigrateDialog}>
                    <DialogContent className="max-w-md bg-slate-900 border-white/10">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-white">
                                <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                                Migrer les membres
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-xs text-slate-400">Transférer tous les membres d'un groupe vers un autre groupe.</p>

                            {/* Source Group */}
                            <div>
                                <label className="text-xs text-slate-400 mb-2 block">Groupe source (d'où migrer)</label>
                                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                    {myGroups.filter(g => g.role === 'admin').map((g: any) => (
                                        <button
                                            key={g.id}
                                            onClick={() => setMigrateSourceGroup(g.id)}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all ${migrateSourceGroup === g.id
                                                ? 'bg-indigo-600/20 border border-indigo-500/40'
                                                : 'hover:bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <Users className="h-4 w-4 text-indigo-400 shrink-0" />
                                            <span className="text-sm text-white truncate">{g.name}</span>
                                            <span className="text-[10px] text-slate-500 ml-auto shrink-0">{g.member_count} mbr</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                                <div className="bg-indigo-500/20 p-2 rounded-full">
                                    <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
                                </div>
                            </div>

                            {/* Target Group */}
                            <div>
                                <label className="text-xs text-slate-400 mb-2 block">Groupe cible (où migrer)</label>
                                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                    {myGroups.filter(g => g.role === 'admin' && g.id !== migrateSourceGroup).map((g: any) => (
                                        <button
                                            key={g.id}
                                            onClick={() => setMigrateTargetGroup(g.id)}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all ${migrateTargetGroup === g.id
                                                ? 'bg-green-600/20 border border-green-500/40'
                                                : 'hover:bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <Users className="h-4 w-4 text-green-400 shrink-0" />
                                            <span className="text-sm text-white truncate">{g.name}</span>
                                            <span className="text-[10px] text-slate-500 ml-auto shrink-0">{g.member_count} mbr</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Migrate Button */}
                            <Button
                                onClick={handleMigrateMembers}
                                disabled={!migrateSourceGroup || !migrateTargetGroup || isMigrating}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                            >
                                {isMigrating ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Migration en cours...</>
                                ) : (
                                    <><ArrowRightLeft className="h-4 w-4 mr-2" /> Migrer tous les membres</>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}