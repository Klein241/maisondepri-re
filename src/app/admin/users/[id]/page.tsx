"use client"

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"
import { Loader2, ArrowLeft, Trophy, Calendar, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function UserDetailsPage({ params }: { params: { id: string } }) {
    const [profile, setProfile] = useState<any>(null)
    const [progress, setProgress] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [updatingRole, setUpdatingRole] = useState(false)
    const router = useRouter()
    const userId = params.id

    const handleRoleUpdate = async (newRole: string) => {
        setUpdatingRole(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)

            if (error) throw error
            setProfile({ ...profile, role: newRole })
            toast.success(`Rôle mis à jour: ${newRole}`)
        } catch (e: any) {
            toast.error("Erreur: " + e.message)
        } finally {
            setUpdatingRole(false)
        }
    }

    useEffect(() => {
        async function fetchUser() {
            if (!userId) return;

            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            const { data: progressData } = await supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', userId)
                .order('day_number', { ascending: true })

            setProfile(profileData)
            setProgress(progressData || [])
            setLoading(false)
        }
        fetchUser()
    }, [userId])

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    if (!profile) return <div>Utilisateur non trouvé</div>

    const completedDays = progress.filter(p => p.completed).length
    const progressPercent = (completedDays / 40) * 100

    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour aux utilisateurs
            </Button>

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border-4 border-primary/20">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="text-2xl">{profile.full_name?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-3xl font-bold">{profile.full_name}</h2>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{profile.email}</span>
                            <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                                {profile.role}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="text-sm text-muted-foreground">Rôle & Actions</div>
                    <Select
                        defaultValue={profile.role}
                        onValueChange={handleRoleUpdate}
                        disabled={updatingRole}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Rôle" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">Utilisateur</SelectItem>
                            <SelectItem value="moderator">Modérateur</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                            <Trophy className="h-4 w-4" />
                            Progression Totale
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold mb-2">{completedDays} / 40 Jours</div>
                        <Progress value={progressPercent} className="h-2" />
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Dernière Activité
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {progress.length > 0
                                ? new Date(progress[progress.length - 1].completed_at || progress[progress.length - 1].created_at).toLocaleDateString()
                                : "Jamais"
                            }
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Dernier jour validé</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                            <Flame className="h-4 w-4" />
                            Série (Simulée)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">3 Jours</div>
                        <p className="text-xs text-muted-foreground mt-1">Consécutifs</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Calendrier de Progression</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                        {Array.from({ length: 40 }, (_, i) => i + 1).map((dayNum) => {
                            const dayData = progress.find(p => p.day_number === dayNum)
                            const isCompleted = !!dayData?.completed

                            return (
                                <div
                                    key={dayNum}
                                    className={`
                                aspect-square rounded-md flex items-center justify-center text-sm font-bold border transition-all
                                ${isCompleted
                                            ? "bg-green-500 text-white border-green-600 shadow-sm shadow-green-500/20"
                                            : "bg-muted text-muted-foreground border-transparent opacity-50"
                                        }
                            `}
                                    title={isCompleted ? `Jour ${dayNum} complété` : `Jour ${dayNum} non fait`}
                                >
                                    {dayNum}
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
