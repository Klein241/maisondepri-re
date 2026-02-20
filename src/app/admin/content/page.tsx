'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DailyProgram } from '@/lib/types';
import { programData } from '@/lib/program-data';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, Edit, RefreshCw, Plus, Trash2, Calendar, Settings,
    ChevronLeft, ChevronRight, BookOpen, Save, X, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GamesManager } from '@/components/admin/games-manager';

interface DayData {
    id?: string;
    day_number: number;
    title: string;
    theme: string;
    bible_reading: { reference: string; passage: string };
    prayer_focus: string[];
    meditation: string;
    practical_action: string;
    is_active: boolean;
}

export default function ContentPage() {
    const [days, setDays] = useState<DayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [programDuration, setProgramDuration] = useState(40);
    const [editingDay, setEditingDay] = useState<DayData | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newDay, setNewDay] = useState<Partial<DayData>>({
        title: '',
        theme: '',
        bible_reading: { reference: '', passage: '' },
        prayer_focus: [''],
        meditation: '',
        practical_action: '',
        is_active: true
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchDays();
        fetchProgramDuration();
    }, []);

    const fetchProgramDuration = async () => {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'program_duration')
                .single();
            if (data?.value) {
                setProgramDuration(parseInt(data.value) || 40);
            }
        } catch (e) {
            console.log('Using default program duration');
        }
    };

    const updateProgramDuration = async (newDuration: number) => {
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: 'program_duration', value: newDuration.toString() });

            if (error) throw error;
            setProgramDuration(newDuration);
            toast.success(`Durée du programme mise à jour: ${newDuration} jours`);
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const fetchDays = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('days')
                .select('*')
                .order('day_number', { ascending: true });

            if (error) {
                if (error.code === '42P01') { // undefined_table
                    // toast.error("La table 'days' n'existe pas.");
                    setDays([]);
                    return;
                }
                throw error;
            }

            const mappedDays: DayData[] = (data || []).map((d: any) => ({
                id: d.id,
                day_number: d.day_number,
                title: d.title,
                theme: d.theme,
                bible_reading: typeof d.bible_reading === 'string'
                    ? JSON.parse(d.bible_reading)
                    : (d.bible_reading || { reference: '', passage: '' }),
                prayer_focus: Array.isArray(d.prayer_focus) ? d.prayer_focus : [],
                meditation: d.meditation || '',
                practical_action: d.practical_action || '',
                is_active: d.is_active !== false
            }));

            setDays(mappedDays);
        } catch (e: any) {
            console.error('Error fetching days:', e);
            toast.error('Erreur de chargement: ' + (e.message || 'Inconnue'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSeed = async () => {
        if (!confirm('Cela va réinitialiser le programme avec les données par défaut. Continuer?')) return;

        setIsSeeding(true);
        try {
            const rows = programData.map(d => ({
                day_number: d.day,
                title: d.title,
                theme: d.theme,
                bible_reading: d.bibleReading,
                prayer_focus: Array.isArray(d.prayerFocus) ? d.prayerFocus : [d.prayerFocus],
                meditation: d.meditation,
                practical_action: d.practicalAction,
                is_active: true
            }));

            const { error } = await supabase.from('days').upsert(rows, { onConflict: 'day_number' });
            if (error) throw error;

            toast.success('Programme initialisé avec succès!');
            fetchDays();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSeeding(false);
    };

    const handleAddDay = async () => {
        if (!newDay.title?.trim() || !newDay.theme?.trim()) {
            toast.error('Le titre et le thème sont requis');
            return;
        }

        const nextDayNumber = days.length > 0 ? Math.max(...days.map(d => d.day_number)) + 1 : 1;

        setIsSaving(true);
        try {
            const dayData = {
                day_number: nextDayNumber,
                title: newDay.title.trim(),
                theme: newDay.theme.trim(),
                bible_reading: newDay.bible_reading || { reference: '', passage: '' },
                prayer_focus: (newDay.prayer_focus || []).filter(p => p.trim()),
                meditation: newDay.meditation?.trim() || '',
                practical_action: newDay.practical_action?.trim() || '',
                is_active: newDay.is_active !== false
            };

            const { error } = await supabase.from('days').insert(dayData);
            if (error) throw error;

            toast.success(`Jour ${nextDayNumber} ajouté!`);
            setIsAddDialogOpen(false);
            resetNewDay();
            fetchDays();

            // Update program duration if needed
            if (nextDayNumber > programDuration) {
                updateProgramDuration(nextDayNumber);
            }
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleUpdateDay = async () => {
        if (!editingDay) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('days')
                .update({
                    title: editingDay.title,
                    theme: editingDay.theme,
                    bible_reading: editingDay.bible_reading,
                    prayer_focus: editingDay.prayer_focus.filter(p => p.trim()),
                    meditation: editingDay.meditation,
                    practical_action: editingDay.practical_action,
                    is_active: editingDay.is_active
                })
                .eq('day_number', editingDay.day_number);

            if (error) throw error;

            toast.success(`Jour ${editingDay.day_number} mis à jour!`);
            setEditingDay(null);
            fetchDays();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
        setIsSaving(false);
    };

    const handleDeleteDay = async (dayNumber: number) => {
        if (!confirm(`Supprimer le jour ${dayNumber}?`)) return;

        try {
            const { error } = await supabase
                .from('days')
                .delete()
                .eq('day_number', dayNumber);
            if (error) throw error;
            toast.success(`Jour ${dayNumber} supprimé`);
            fetchDays();
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const resetNewDay = () => {
        setNewDay({
            title: '',
            theme: '',
            bible_reading: { reference: '', passage: '' },
            prayer_focus: [''],
            meditation: '',
            practical_action: '',
            is_active: true
        });
    };

    // Pagination
    const totalPages = Math.ceil(days.length / itemsPerPage);
    const paginatedDays = days.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                    Gestion du Contenu
                </h2>
                <p className="text-muted-foreground mt-1">
                    Administrez le Programme 40 Jours et les Jeux Bibliques.
                </p>
            </div>

            <Tabs defaultValue="program" className="space-y-4">
                <TabsList className="bg-muted">
                    <TabsTrigger value="program" className="data-[state=active]:bg-background">Programme 40 Jours</TabsTrigger>
                    <TabsTrigger value="games" className="data-[state=active]:bg-background">Jeux & Quiz</TabsTrigger>
                </TabsList>

                <TabsContent value="program" className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-lg font-semibold">Jours du Programme ({days.length})</div>

                        <div className="flex flex-wrap gap-2">
                            {/* Program Duration Setting */}
                            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Durée:</span>
                                <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={programDuration}
                                    onChange={(e) => setProgramDuration(parseInt(e.target.value) || 40)}
                                    onBlur={() => updateProgramDuration(programDuration)}
                                    className="w-16 h-7 text-center"
                                />
                                <span className="text-sm text-muted-foreground">jours</span>
                            </div>

                            {days.length === 0 && (
                                <Button onClick={handleSeed} disabled={isSeeding} variant="outline">
                                    {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Settings className="mr-2 h-4 w-4" />
                                    Initialiser (40 jours)
                                </Button>
                            )}

                            <Button variant="outline" onClick={fetchDays}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>

                            {/* Add Day Dialog Trigger */}
                            <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter un jour
                            </Button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="border-l-4 border-l-blue-500">
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold">{days.length}</div>
                                <p className="text-sm text-muted-foreground">Jours configurés</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-green-500">
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold">{days.filter(d => d.is_active).length}</div>
                                <p className="text-sm text-muted-foreground">Jours actifs</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-purple-500">
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold">{programDuration}</div>
                                <p className="text-sm text-muted-foreground">Durée du programme</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-orange-500">
                            <CardContent className="p-4">
                                <div className="text-2xl font-bold">{programDuration - days.length}</div>
                                <p className="text-sm text-muted-foreground">Jours à ajouter</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Days Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">Jour</TableHead>
                                        <TableHead>Titre</TableHead>
                                        <TableHead>Thème</TableHead>
                                        <TableHead>Lecture</TableHead>
                                        <TableHead className="w-[80px]">Statut</TableHead>
                                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {days.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Calendar className="h-12 w-12 text-muted-foreground/50" />
                                                    <p className="text-muted-foreground">Aucun jour configuré</p>
                                                    <Button onClick={handleSeed} variant="outline">
                                                        Initialiser avec 40 jours
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedDays.map((day) => (
                                            <TableRow key={day.day_number} className={cn(!day.is_active && "opacity-50")}>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-bold">
                                                        {day.day_number}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium max-w-[200px] truncate">
                                                    {day.title}
                                                </TableCell>
                                                <TableCell className="max-w-[150px] truncate">{day.theme}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {day.bible_reading?.reference || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={day.is_active ? "default" : "secondary"}>
                                                        {day.is_active ? "Actif" : "Inactif"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setEditingDay(day)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-600"
                                                            onClick={() => handleDeleteDay(day.day_number)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        Page {currentPage} sur {totalPages}
                                    </p>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => p - 1)}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(p => p + 1)}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Add Day Dialog - Needs to be inside Program Tab or conditioned? */}
                    {/* It's local state driven, so we can keep it here or outside. 
                        Keeping it here makes semantic sense. */}
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-indigo-500" />
                                    Ajouter le jour {days.length + 1}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Titre *</Label>
                                        <Input
                                            placeholder="Ex: Le Fondement de la Foi"
                                            value={newDay.title || ''}
                                            onChange={(e) => setNewDay(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Thème *</Label>
                                        <Input
                                            placeholder="Ex: Foi et Confiance"
                                            value={newDay.theme || ''}
                                            onChange={(e) => setNewDay(prev => ({ ...prev, theme: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Référence biblique</Label>
                                        <Input
                                            placeholder="Ex: Jean 3:16-21"
                                            value={newDay.bible_reading?.reference || ''}
                                            onChange={(e) => setNewDay(prev => ({
                                                ...prev,
                                                bible_reading: { ...prev.bible_reading!, reference: e.target.value }
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Passage</Label>
                                        <Input
                                            placeholder="Résumé du passage"
                                            value={newDay.bible_reading?.passage || ''}
                                            onChange={(e) => setNewDay(prev => ({
                                                ...prev,
                                                bible_reading: { ...prev.bible_reading!, passage: e.target.value }
                                            }))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Méditation</Label>
                                    <Textarea
                                        placeholder="Contenu de la méditation..."
                                        value={newDay.meditation || ''}
                                        onChange={(e) => setNewDay(prev => ({ ...prev, meditation: e.target.value }))}
                                        rows={4}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Action pratique</Label>
                                    <Textarea
                                        placeholder="Action à réaliser ce jour..."
                                        value={newDay.practical_action || ''}
                                        onChange={(e) => setNewDay(prev => ({ ...prev, practical_action: e.target.value }))}
                                        rows={2}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Sujets de prière</Label>
                                    {(newDay.prayer_focus || ['']).map((focus, index) => (
                                        <div key={index} className="flex gap-2">
                                            <Input
                                                placeholder={`Sujet ${index + 1}`}
                                                value={focus}
                                                onChange={(e) => {
                                                    const updated = [...(newDay.prayer_focus || [''])];
                                                    updated[index] = e.target.value;
                                                    setNewDay(prev => ({ ...prev, prayer_focus: updated }));
                                                }}
                                            />
                                            {index === (newDay.prayer_focus?.length || 1) - 1 && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setNewDay(prev => ({
                                                        ...prev,
                                                        prayer_focus: [...(prev.prayer_focus || []), '']
                                                    }))}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                                    <Switch
                                        checked={newDay.is_active !== false}
                                        onCheckedChange={(checked) => setNewDay(prev => ({ ...prev, is_active: checked }))}
                                    />
                                    <Label>Activer immédiatement</Label>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleAddDay} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Ajouter
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Day Dialog */}
                    <Dialog open={!!editingDay} onOpenChange={(open) => !open && setEditingDay(null)}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Edit className="h-5 w-5 text-indigo-500" />
                                    Modifier le jour {editingDay?.day_number}
                                </DialogTitle>
                            </DialogHeader>

                            {editingDay && (
                                <div className="space-y-4 py-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Titre</Label>
                                            <Input
                                                value={editingDay.title}
                                                onChange={(e) => setEditingDay(prev => prev ? { ...prev, title: e.target.value } : null)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Thème</Label>
                                            <Input
                                                value={editingDay.theme}
                                                onChange={(e) => setEditingDay(prev => prev ? { ...prev, theme: e.target.value } : null)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Référence biblique</Label>
                                            <Input
                                                value={editingDay.bible_reading?.reference || ''}
                                                onChange={(e) => setEditingDay(prev => prev ? {
                                                    ...prev,
                                                    bible_reading: { ...prev.bible_reading, reference: e.target.value }
                                                } : null)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Passage</Label>
                                            <Input
                                                value={editingDay.bible_reading?.passage || ''}
                                                onChange={(e) => setEditingDay(prev => prev ? {
                                                    ...prev,
                                                    bible_reading: { ...prev.bible_reading, passage: e.target.value }
                                                } : null)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Méditation</Label>
                                        <Textarea
                                            value={editingDay.meditation || ''}
                                            onChange={(e) => setEditingDay(prev => prev ? { ...prev, meditation: e.target.value } : null)}
                                            rows={4}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Action pratique</Label>
                                        <Textarea
                                            value={editingDay.practical_action || ''}
                                            onChange={(e) => setEditingDay(prev => prev ? { ...prev, practical_action: e.target.value } : null)}
                                            rows={2}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                                        <Switch
                                            checked={editingDay.is_active}
                                            onCheckedChange={(checked) => setEditingDay(prev => prev ? { ...prev, is_active: checked } : null)}
                                        />
                                        <Label>Jour actif</Label>
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingDay(null)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleUpdateDay} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Enregistrer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                <TabsContent value="games">
                    <GamesManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
