"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { DailyProgram } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface EditDayDialogProps {
    day: DailyProgram
    trigger: React.ReactNode
    onSuccess: () => void
}

export function EditDayDialog({ day, trigger, onSuccess }: EditDayDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: day.title,
        theme: day.theme,
        meditation: day.meditation,
        practicalAction: day.practicalAction,
        reference: day.bibleReading.reference,
        passage: day.bibleReading.passage
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase
                .from('days')
                .update({
                    title: formData.title,
                    theme: formData.theme,
                    meditation: formData.meditation,
                    practical_action: formData.practicalAction,
                    bible_reading: {
                        reference: formData.reference,
                        passage: formData.passage
                    }
                })
                .eq('day_number', day.day)

            if (error) throw error

            toast.success("Jour mis à jour avec succès")
            setOpen(false)
            onSuccess()
        } catch (error: any) {
            console.error(error)
            toast.error("Erreur: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Éditer Jour {day.day}</DialogTitle>
                    <DialogDescription>
                        Modifiez le contenu inspirant pour ce jour.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Titre</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="theme">Thème</Label>
                            <Input
                                id="theme"
                                value={formData.theme}
                                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="meditation">Méditation</Label>
                        <Textarea
                            id="meditation"
                            value={formData.meditation}
                            onChange={(e) => setFormData({ ...formData, meditation: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="practical">Action Pratique</Label>
                        <Textarea
                            id="practical"
                            value={formData.practicalAction}
                            onChange={(e) => setFormData({ ...formData, practicalAction: e.target.value })}
                            rows={2}
                        />
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <h4 className="mb-4 font-medium">Lecture Biblique</h4>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="ref">Référence</Label>
                                <Input
                                    id="ref"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="passage">Passage</Label>
                                <Textarea
                                    id="passage"
                                    value={formData.passage}
                                    onChange={(e) => setFormData({ ...formData, passage: e.target.value })}
                                    rows={4}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer les modifications
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
