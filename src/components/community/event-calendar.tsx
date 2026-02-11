'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Plus, X, Loader2, Clock, MapPin,
    ExternalLink, Users, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PrayerEvent {
    title: string;
    description: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
}

interface EventCalendarButtonProps {
    groupId?: string;
    groupName?: string;
    className?: string;
}

function formatDateForGoogle(date: string, time: string): string {
    // Convert "2025-03-15" + "14:00" → "20250315T140000"
    const d = date.replace(/-/g, '');
    const t = time.replace(/:/g, '') + '00';
    return `${d}T${t}`;
}

export function EventCalendarButton({ groupId, groupName, className }: EventCalendarButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [event, setEvent] = useState<PrayerEvent>({
        title: groupName ? `Prière de groupe - ${groupName}` : 'Moment de prière',
        description: 'Événement de prière communautaire organisé via la Maison de Prière.',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '18:00',
        endDate: new Date().toISOString().split('T')[0],
        endTime: '19:00',
        location: 'En ligne (Google Meet)'
    });

    const PRESET_EVENTS = [
        {
            icon: '🙏',
            title: 'Soirée de prière',
            description: 'Temps de prière communautaire en soirée',
            duration: '1h',
            startTime: '19:00',
            endTime: '20:00'
        },
        {
            icon: '🌅',
            title: 'Prière matinale',
            description: 'Commencer la journée par la prière',
            duration: '30min',
            startTime: '06:00',
            endTime: '06:30'
        },
        {
            icon: '🔥',
            title: 'Veillée de prière',
            description: 'Nuit de prière et d\'intercession',
            duration: '3h',
            startTime: '21:00',
            endTime: '00:00'
        },
        {
            icon: '📖',
            title: 'Étude biblique',
            description: 'Étude et méditation de la Parole',
            duration: '1h',
            startTime: '18:00',
            endTime: '19:00'
        },
        {
            icon: '🤝',
            title: 'Rencontre de groupe',
            description: 'Réunion du groupe de prière',
            duration: '1h30',
            startTime: '17:00',
            endTime: '18:30'
        }
    ];

    const applyPreset = (preset: typeof PRESET_EVENTS[0]) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        // Handle midnight crossing for end time
        let endDate = dateStr;
        if (preset.endTime < preset.startTime) {
            const endD = new Date(tomorrow);
            endD.setDate(endD.getDate() + 1);
            endDate = endD.toISOString().split('T')[0];
        }

        setEvent({
            title: groupName ? `${preset.title} - ${groupName}` : preset.title,
            description: preset.description,
            startDate: dateStr,
            startTime: preset.startTime,
            endDate: endDate,
            endTime: preset.endTime,
            location: 'En ligne (Google Meet)'
        });
    };

    const createGoogleCalendarEvent = () => {
        if (!event.title.trim()) {
            toast.error('Le titre est requis');
            return;
        }

        setCreating(true);

        try {
            const startFormatted = formatDateForGoogle(event.startDate, event.startTime);
            const endFormatted = formatDateForGoogle(event.endDate, event.endTime);

            const params = new URLSearchParams({
                action: 'TEMPLATE',
                text: event.title,
                dates: `${startFormatted}/${endFormatted}`,
                details: event.description + (groupId ? `\n\nGroupe: ${groupName || groupId}` : ''),
                location: event.location,
                sf: 'true',
                output: 'xml'
            });

            // Add conference data request (Google Meet)
            const calendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

            window.open(calendarUrl, '_blank', 'noopener,noreferrer');

            toast.success('Événement ouvert dans Google Agenda !', {
                description: 'Complétez les détails et invitez les participants.'
            });

            setIsOpen(false);
        } catch (e) {
            console.error('Error creating calendar event:', e);
            toast.error('Erreur lors de la création de l\'événement');
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        "rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 shadow-lg shadow-orange-600/30 border-0 gap-2 px-3",
                        className
                    )}
                >
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-bold">Événement</span>
                </Button>
            </motion.div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-[#0F1219] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-white" />
                            </div>
                            Créer un événement de prière
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            L'événement sera ajouté à votre Google Agenda
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        {/* Quick Presets */}
                        <div>
                            <Label className="text-xs text-slate-400 uppercase font-bold mb-2 block">
                                Modèles rapides
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {PRESET_EVENTS.map((preset, i) => (
                                    <motion.button
                                        key={i}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => applyPreset(preset)}
                                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left"
                                    >
                                        <div className="text-lg mb-1">{preset.icon}</div>
                                        <p className="text-xs font-bold text-white">{preset.title}</p>
                                        <p className="text-[10px] text-slate-500">{preset.duration}</p>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Event Details Form */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs text-slate-400">Titre *</Label>
                                <Input
                                    value={event.title}
                                    onChange={(e) => setEvent(prev => ({ ...prev, title: e.target.value }))}
                                    className="bg-white/5 border-white/10 mt-1"
                                    placeholder="Nom de l'événement"
                                />
                            </div>

                            <div>
                                <Label className="text-xs text-slate-400">Description</Label>
                                <Textarea
                                    value={event.description}
                                    onChange={(e) => setEvent(prev => ({ ...prev, description: e.target.value }))}
                                    className="bg-white/5 border-white/10 mt-1 min-h-[60px]"
                                    placeholder="Description de l'événement"
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-slate-400">Date début</Label>
                                    <Input
                                        type="date"
                                        value={event.startDate}
                                        onChange={(e) => setEvent(prev => ({
                                            ...prev,
                                            startDate: e.target.value,
                                            endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate
                                        }))}
                                        className="bg-white/5 border-white/10 mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-400">Heure début</Label>
                                    <Input
                                        type="time"
                                        value={event.startTime}
                                        onChange={(e) => setEvent(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="bg-white/5 border-white/10 mt-1"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-slate-400">Date fin</Label>
                                    <Input
                                        type="date"
                                        value={event.endDate}
                                        onChange={(e) => setEvent(prev => ({ ...prev, endDate: e.target.value }))}
                                        className="bg-white/5 border-white/10 mt-1"
                                        min={event.startDate}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-400">Heure fin</Label>
                                    <Input
                                        type="time"
                                        value={event.endTime}
                                        onChange={(e) => setEvent(prev => ({ ...prev, endTime: e.target.value }))}
                                        className="bg-white/5 border-white/10 mt-1"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs text-slate-400">Lieu</Label>
                                <Input
                                    value={event.location}
                                    onChange={(e) => setEvent(prev => ({ ...prev, location: e.target.value }))}
                                    className="bg-white/5 border-white/10 mt-1"
                                    placeholder="En ligne ou adresse physique"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={createGoogleCalendarEvent}
                            disabled={creating || !event.title.trim()}
                            className="bg-gradient-to-r from-orange-600 to-amber-600 gap-2"
                        >
                            {creating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ExternalLink className="h-4 w-4" />
                            )}
                            Ouvrir dans Google Agenda
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
