"use client"

import { useAppStore } from "@/lib/store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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
    MapPin
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"

export function ProfileView() {
    const { user, streak, totalDaysCompleted, achievements, unlockedAchievements, signOut, theme, setTheme } = useAppStore()

    if (!user) return null

    // Calculate level based on days completed (Example: Level 1 per 5 days)
    const level = Math.floor(totalDaysCompleted / 5) + 1
    const nextLevelProgress = ((totalDaysCompleted % 5) / 5) * 100

    return (
        <div className="flex flex-col h-full bg-background pt-8 px-4 pb-24 overflow-y-auto">
            {/* Header Section */}
            <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="relative mb-4">
                    <Avatar className="h-24 w-24 border-4 border-primary shadow-xl">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                            {user.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <Badge className="absolute -bottom-2 -right-2 px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 border-none text-white shadow-lg">
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

            <div className="text-center mt-8 text-xs text-muted-foreground">
                Version 1.0.0 • Marathon de Prière
            </div>
        </div>
    )
}
