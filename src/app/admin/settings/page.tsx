"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, Key } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState<{ key: string; value: string; description: string }[]>([])
    const [editValues, setEditValues] = useState<Record<string, string>>({})

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .order('key')

        if (data) {
            setSettings(data)
            const initialValues = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {})
            setEditValues(initialValues)
        }
    }

    const handleSave = async (key: string, newValue: string) => {
        setLoading(true)
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ value: newValue, updated_at: new Date().toISOString() })
                .eq('key', key)

            if (error) throw error
            toast.success(`${key} mis à jour avec succès`)
            fetchSettings()
        } catch (e: any) {
            toast.error("Erreur: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Paramètres Généraux</h2>
                <p className="text-muted-foreground">Gérez les configurations globales de l'application.</p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5 text-primary" />
                            Clés API & Services
                        </CardTitle>
                        <CardDescription>
                            Configurez les services externes sans toucher au code.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {settings.length === 0 && (
                            <div className="text-sm text-muted-foreground italic">Aucun paramètre trouvé. Veuillez exécuter le script SQL de mise à jour.</div>
                        )}
                        {settings.map((setting) => (
                            <div key={setting.key} className="grid w-full items-center gap-1.5 p-4 bg-muted/30 rounded-xl border border-white/5">
                                <Label htmlFor={setting.key} className="flex flex-col gap-1 mb-2">
                                    <span className="font-bold text-indigo-400 uppercase text-[10px] tracking-widest">{setting.key}</span>
                                    <span className="text-sm font-medium">{setting.description}</span>
                                </Label>
                                <div className="flex gap-2">
                                    {setting.value === 'true' || setting.value === 'false' ? (
                                        <div className="flex gap-2 flex-1">
                                            <Button
                                                variant={editValues[setting.key] === 'true' ? 'default' : 'outline'}
                                                className="flex-1 rounded-xl"
                                                onClick={() => {
                                                    const newVal = 'true';
                                                    setEditValues({ ...editValues, [setting.key]: newVal });
                                                    handleSave(setting.key, newVal);
                                                }}
                                            >
                                                Activé
                                            </Button>
                                            <Button
                                                variant={editValues[setting.key] === 'false' ? 'default' : 'outline'}
                                                className="flex-1 rounded-xl"
                                                onClick={() => {
                                                    const newVal = 'false';
                                                    setEditValues({ ...editValues, [setting.key]: newVal });
                                                    handleSave(setting.key, newVal);
                                                }}
                                            >
                                                Désactivé
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <Input
                                                id={setting.key}
                                                value={editValues[setting.key] || ""}
                                                onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                                                className="rounded-xl bg-background border-white/10"
                                            />
                                            <Button
                                                onClick={() => handleSave(setting.key, editValues[setting.key])}
                                                disabled={loading}
                                                className="rounded-xl"
                                            >
                                                <Save className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Fallback for Bible Key if not in DB yet but we want to show the UI field */}
                        {!settings.find(s => s.key === 'bible_api_key') && (
                            <div className="grid w-full items-center gap-1.5 opacity-50 pointer-events-none">
                                <Label>bible_api_key (Non configuré en base)</Label>
                                <Input placeholder="Exécutez update_schema_settings.sql" disabled />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
