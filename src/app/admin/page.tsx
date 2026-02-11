"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { StatsCard } from "@/components/admin/stats-card"
import { Users, BookOpen, MessageSquare, Activity, TrendingUp, UserPlus, Heart } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        users: 0,
        prayers: 0,
        testimonials: 0,
        recentUsers: [] as any[]
    })

    useEffect(() => {
        async function fetchStats() {
            const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
            const { count: prayersCount } = await supabase.from('prayer_requests').select('*', { count: 'exact', head: true })
            const { count: testimonialsCount } = await supabase.from('testimonials').select('*', { count: 'exact', head: true })

            const { data: recentUsers } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5)

            setStats({
                users: usersCount || 0,
                prayers: prayersCount || 0,
                testimonials: testimonialsCount || 0,
                recentUsers: recentUsers || []
            })
        }

        fetchStats()
    }, [])

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Tableau de Bord</h2>
                    <p className="text-muted-foreground mt-1">Vue d'ensemble de l'activité du Marathon de Prière.</p>
                </div>
                <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-1 rounded-full border">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Système opérationnel
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Communauté"
                    value={stats.users}
                    icon={Users}
                    description="+12% ce mois"
                    className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow"
                />
                <StatsCard
                    title="Prières Actives"
                    value={stats.prayers}
                    icon={Activity}
                    description="Requêtes sur le mur"
                    className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow"
                />
                <StatsCard
                    title="Témoignages"
                    value={stats.testimonials}
                    icon={MessageSquare}
                    description="Partagés avec foi"
                    className="border-l-4 border-l-pink-500 shadow-sm hover:shadow-md transition-shadow"
                />
                <StatsCard
                    title="Progression"
                    value="J-12"
                    icon={BookOpen}
                    description="Jour actuel du marathon"
                    className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow"
                />
            </div>



            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

                {/* Activity Chart Placeholder - Using CSS for simplicity */}
                <Card className="col-span-4 shadow-sm">
                    <CardHeader>
                        <CardTitle>Engagement Quotidien</CardTitle>
                        <CardDescription>Activité des utilisateurs sur les 7 derniers jours</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] w-full flex items-end justify-between gap-2 px-4 pt-4 border-b border-l border-muted/50 rounded-bl-lg">
                            {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                                <div key={i} className="group relative flex-1 bg-primary/10 hover:bg-primary/20 rounded-t-sm transition-all duration-300" style={{ height: `${h}%` }}>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg">
                                        {h}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between px-4 mt-2 text-xs text-muted-foreground">
                            <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Signups Feed */}
                <Card className="col-span-3 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-blue-500" />
                            Inscriptions Récentes
                        </CardTitle>
                        <CardDescription>
                            Derniers membres ayant rejoint le marathon.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {stats.recentUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Aucune inscription récente.</p>
                            ) : (
                                stats.recentUsers.map((user) => (
                                    <div key={user.id} className="flex items-center">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={user.avatar_url} alt="Avatar" />
                                            <AvatarFallback>{user.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                        <div className="ml-auto font-medium text-xs text-muted-foreground">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <a href="/admin/moderation">
                    <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer group hover:scale-[1.02]">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-indigo-500/10 p-3 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                                <MessageSquare className="h-6 w-6 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Modération</h3>
                                <p className="text-sm text-muted-foreground">Prières & témoignages</p>
                            </div>
                        </CardContent>
                    </Card>
                </a>
                <a href="/admin/resources">
                    <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer group hover:scale-[1.02]">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-emerald-500/10 p-3 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                                <BookOpen className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Ressources</h3>
                                <p className="text-sm text-muted-foreground">Médias journaliers</p>
                            </div>
                        </CardContent>
                    </Card>
                </a>
                <a href="/admin/realtime">
                    <Card className="bg-gradient-to-br from-pink-500/5 to-rose-500/5 border-pink-500/20 hover:border-pink-500/40 transition-all cursor-pointer group hover:scale-[1.02]">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-pink-500/10 p-3 rounded-full group-hover:bg-pink-500/20 transition-colors">
                                <Activity className="h-6 w-6 text-pink-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Temps Réel</h3>
                                <p className="text-sm text-muted-foreground">Suivi des consultations</p>
                            </div>
                        </CardContent>
                    </Card>
                </a>
                <a href="/admin/prayers">
                    <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer group hover:scale-[1.02]">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-amber-500/10 p-3 rounded-full group-hover:bg-amber-500/20 transition-colors">
                                <Heart className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Prières Exaucées</h3>
                                <p className="text-sm text-muted-foreground">Marquer les réponses</p>
                            </div>
                        </CardContent>
                    </Card>
                </a>
            </div>
        </div>
    )
}
