"use client"

import { useState, useRef } from "react"
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
} from "lucide-react"
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
            // Since we use fake emails, we generate a new temporary password
            // In a real scenario, this would send an email via supabase.auth.resetPasswordForEmail()
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })
            if (error) {
                // Fallback: since emails are fake, just show a message
                toast.info('Contactez un administrateur pour réinitialiser votre mot de passe. Votre identifiant est : ' + (user.whatsapp || user.email))
            } else {
                setForgotPwSent(true)
                toast.success('Instructions envoyées !')
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
            </div>
        </div>
    )
}