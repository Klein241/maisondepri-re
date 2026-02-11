"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, Trash2, CheckCircle, AlertOctagon } from "lucide-react" // Importing icons we will use
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function ModerationPage() {
    const [prayers, setPrayers] = useState<any[]>([])
    const [testimonials, setTestimonials] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = async () => {
        setIsLoading(true)

        // Fetch Prayers
        const { data: prayersData } = await supabase
            .from('prayer_requests')
            .select('*, profiles(full_name, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(50)

        // Fetch Testimonials
        const { data: testimonialsData } = await supabase
            .from('testimonials')
            .select('*, profiles(full_name, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(50)

        setPrayers(prayersData || [])
        setTestimonials(testimonialsData || [])
        setIsLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleDelete = async (table: 'prayer_requests' | 'testimonials', id: string) => {
        try {
            // Use Admin API to bypass RLS
            const response = await fetch('/api/admin/delete-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ table, id }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Erreur lors de la suppression")
            }

            toast.success("Élément supprimé avec succès")
            fetchData()
        } catch (e: any) {
            console.error(e)
            toast.error(e.message || "Erreur lors de la suppression")
        }
    }

    const handleApproveTestimonial = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('testimonials')
                .update({ is_approved: !currentStatus })
                .eq('id', id)

            if (error) throw error
            toast.success(currentStatus ? "Témoignage désapprouvé" : "Témoignage approuvé")
            fetchData()
        } catch (e) {
            toast.error("Erreur lors de l'approbation")
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Centre de Modération</h2>
                <p className="text-muted-foreground">Gérez le contenu publié par la communauté pour assurer la sécurité.</p>
            </div>

            <Tabs defaultValue="prayers" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="prayers">Requêtes de Prière ({prayers.length})</TabsTrigger>
                    <TabsTrigger value="testimonials">Témoignages ({testimonials.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="prayers" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {prayers.map((prayer) => (
                            <Card key={prayer.id} className="relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={prayer.profiles?.avatar_url} />
                                        <AvatarFallback>{prayer.profiles?.full_name?.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <CardTitle className="text-sm font-medium">
                                            {prayer.is_anonymous ? "Anonyme" : prayer.profiles?.full_name}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            {new Date(prayer.created_at).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-foreground/80 line-clamp-3 mb-4">
                                        "{prayer.content}"
                                    </p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <Badge variant="secondary" className="text-xs">
                                            {prayer.prayer_count} Prières
                                        </Badge>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => handleDelete('prayer_requests', prayer.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {prayers.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                Aucune requête de prière à modérer.
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="testimonials" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {testimonials.map((testi) => (
                            <Card key={testi.id} className="relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={testi.profiles?.avatar_url} />
                                        <AvatarFallback>{testi.profiles?.full_name?.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-medium">
                                                {testi.profiles?.full_name}
                                            </CardTitle>
                                            {testi.is_approved ? (
                                                <Badge variant="outline" className="text-[10px] border-green-500/20 bg-green-500/10 text-green-500">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Approuvé
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] border-orange-500/20 bg-orange-500/10 text-orange-500">
                                                    <AlertOctagon className="h-3 w-3 mr-1" />
                                                    En attente
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs">
                                            {new Date(testi.created_at).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* Photo if exists */}
                                    {testi.photo_url && (
                                        <div className="mb-3 rounded-lg overflow-hidden">
                                            <img
                                                src={testi.photo_url}
                                                alt="Testimonial"
                                                className="w-full h-32 object-cover"
                                            />
                                        </div>
                                    )}
                                    <p className="text-sm text-foreground/80 italic mb-4 line-clamp-3">
                                        "{testi.content}"
                                    </p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <Badge variant="secondary" className="text-xs">
                                            {testi.likes} J'aime
                                        </Badge>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => handleDelete('testimonials', testi.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`h-8 w-8 p-0 ${testi.is_approved
                                                    ? 'text-orange-500 hover:text-orange-600 border-orange-500/20 hover:bg-orange-500/10'
                                                    : 'text-green-500 hover:text-green-600 border-green-500/20 hover:bg-green-500/10'
                                                    }`}
                                                onClick={() => handleApproveTestimonial(testi.id, testi.is_approved)}
                                            >
                                                {testi.is_approved ? (
                                                    <AlertOctagon className="h-4 w-4" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {testimonials.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                Aucun témoignage à modérer.
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
