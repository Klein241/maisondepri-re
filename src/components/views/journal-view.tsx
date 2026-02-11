'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PenLine,
    Plus,
    Calendar,
    Smile,
    Heart,
    Sun,
    Cloud,
    Star,
    Sparkles,
    Search,
    ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const moods = [
    { id: 'joyful', icon: Sparkles, label: 'Joyeux', color: 'bg-yellow-500' },
    { id: 'peaceful', icon: Sun, label: 'Paisible', color: 'bg-blue-400' },
    { id: 'grateful', icon: Heart, label: 'Reconnaissant', color: 'bg-pink-500' },
    { id: 'hopeful', icon: Star, label: 'Espérant', color: 'bg-purple-500' },
    { id: 'reflective', icon: Cloud, label: 'Réfléchi', color: 'bg-gray-400' },
    { id: 'struggling', icon: Cloud, label: 'En difficulté', color: 'bg-slate-500' },
];

export function JournalView() {
    const { journalEntries, addJournalEntry } = useAppStore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newEntry, setNewEntry] = useState('');
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<typeof journalEntries[0] | null>(null);

    const handleSubmit = () => {
        if (newEntry.trim()) {
            addJournalEntry(newEntry.trim(), selectedMood || undefined);
            setNewEntry('');
            setSelectedMood(null);
            setIsDialogOpen(false);
        }
    };

    const filteredEntries = journalEntries.filter(entry =>
        entry.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group entries by date
    const groupedEntries = filteredEntries.reduce((acc, entry) => {
        const date = format(new Date(entry.date), 'yyyy-MM-dd');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, typeof journalEntries>);

    return (
        <div className="min-h-screen pb-24 pt-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 mb-6"
            >
                <h1 className="text-2xl font-bold">Journal Spirituel</h1>
                <p className="text-muted-foreground">Vos réflexions et prières personnelles</p>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="px-4 mb-6"
            >
                <Card className="bg-gradient-to-r from-primary/10 to-gold/10 border-none">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-around">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-primary">{journalEntries.length}</p>
                                <p className="text-xs text-muted-foreground">Entrées</p>
                            </div>
                            <div className="w-px h-10 bg-border" />
                            <div className="text-center">
                                <p className="text-3xl font-bold text-gold">
                                    {Object.keys(groupedEntries).length}
                                </p>
                                <p className="text-xs text-muted-foreground">Jours</p>
                            </div>
                            <div className="w-px h-10 bg-border" />
                            <div className="text-center">
                                <p className="text-3xl font-bold text-green-500">
                                    {journalEntries.filter(e => e.mood === 'joyful' || e.mood === 'grateful').length}
                                </p>
                                <p className="text-xs text-muted-foreground">Moments joyeux</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Search and Add */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="px-4 mb-6 flex gap-2"
            >
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher dans le journal..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gradient-spiritual text-white shrink-0">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Nouvelle entrée</DialogTitle>
                            <DialogDescription>
                                Écrivez vos pensées, prières et réflexions
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* Mood Selection */}
                            <div>
                                <p className="text-sm font-medium mb-2">Comment vous sentez-vous ?</p>
                                <div className="flex flex-wrap gap-2">
                                    {moods.map((mood) => {
                                        const Icon = mood.icon;
                                        return (
                                            <Button
                                                key={mood.id}
                                                variant={selectedMood === mood.id ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setSelectedMood(mood.id)}
                                                className={cn(
                                                    'transition-all',
                                                    selectedMood === mood.id && mood.color
                                                )}
                                            >
                                                <Icon className="w-4 h-4 mr-1" />
                                                {mood.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Entry Content */}
                            <Textarea
                                placeholder="Qu'avez-vous sur le cœur aujourd'hui ?"
                                value={newEntry}
                                onChange={(e) => setNewEntry(e.target.value)}
                                rows={6}
                                className="resize-none"
                            />

                            <Button
                                className="w-full gradient-spiritual text-white"
                                onClick={handleSubmit}
                                disabled={!newEntry.trim()}
                            >
                                <PenLine className="w-4 h-4 mr-2" />
                                Enregistrer
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>

            {/* Entries List */}
            <div className="px-4 space-y-6">
                <AnimatePresence>
                    {Object.keys(groupedEntries).length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-12 text-center"
                        >
                            <PenLine className="w-12 h-12 text-muted-foreground/50" />
                            <h3 className="font-semibold mt-4">Aucune entrée</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Commencez à écrire vos réflexions spirituelles
                            </p>
                        </motion.div>
                    ) : (
                        Object.entries(groupedEntries).map(([date, entries], groupIndex) => (
                            <motion.div
                                key={date}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.05 }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {format(new Date(date), 'EEEE d MMMM yyyy', { locale: fr })}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {entries.map((entry, index) => {
                                        const mood = moods.find(m => m.id === entry.mood);
                                        const MoodIcon = mood?.icon;

                                        return (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                            >
                                                <Card
                                                    className="cursor-pointer hover:shadow-md transition-shadow"
                                                    onClick={() => setSelectedEntry(entry)}
                                                >
                                                    <CardContent className="py-4">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                {mood && MoodIcon && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className={cn('mb-2', mood.color, 'text-white')}
                                                                    >
                                                                        <MoodIcon className="w-3 h-3 mr-1" />
                                                                        {mood.label}
                                                                    </Badge>
                                                                )}
                                                                <p className="text-sm line-clamp-3">{entry.content}</p>
                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                    {format(new Date(entry.date), 'HH:mm', { locale: fr })}
                                                                </p>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Entry Detail Dialog */}
            <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedEntry && format(new Date(selectedEntry.date), 'EEEE d MMMM yyyy', { locale: fr })}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedEntry && (
                        <div className="space-y-4">
                            {selectedEntry.mood && (
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        moods.find(m => m.id === selectedEntry.mood)?.color,
                                        'text-white'
                                    )}
                                >
                                    {moods.find(m => m.id === selectedEntry.mood)?.label}
                                </Badge>
                            )}
                            <p className="text-foreground whitespace-pre-wrap">{selectedEntry.content}</p>
                            <p className="text-xs text-muted-foreground">
                                Écrit à {format(new Date(selectedEntry.date), 'HH:mm', { locale: fr })}
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
