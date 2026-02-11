'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2, Brain, HelpCircle, Clock, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export function GamesManager() {
    const [activeTab, setActiveTab] = useState('quiz');
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    const fetchItems = async () => {
        setIsLoading(true);
        let table = '';
        if (activeTab === 'quiz') table = 'game_questions_quiz';
        else if (activeTab === 'whoami') table = 'game_characters_whoami';
        else if (activeTab === 'chrono') table = 'game_events_chrono';

        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (e: any) {
            console.error(e);
            // toast.error("Erreur chargement: " + e.message); // Silent fail if table lacks
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cet élément ?')) return;
        let table = '';
        if (activeTab === 'quiz') table = 'game_questions_quiz';
        else if (activeTab === 'whoami') table = 'game_characters_whoami';
        else if (activeTab === 'chrono') table = 'game_events_chrono';

        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            toast.success("Élément supprimé");
            fetchItems();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleSave = async (formData: any) => {
        let table = '';
        if (activeTab === 'quiz') table = 'game_questions_quiz';
        else if (activeTab === 'whoami') table = 'game_characters_whoami';
        else if (activeTab === 'chrono') table = 'game_events_chrono';

        try {
            if (editingItem) {
                const { error } = await supabase.from(table).update(formData).eq('id', editingItem.id);
                if (error) throw error;
                toast.success("Mis à jour !");
            } else {
                const { error } = await supabase.from(table).insert(formData);
                if (error) throw error;
                toast.success("Créé !");
            }
            setIsDialogOpen(false);
            setEditingItem(null);
            fetchItems();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestion des Jeux</CardTitle>
                <CardDescription>Gérez le contenu des mini-jeux bibliques.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="quiz"><Brain className="w-4 h-4 mr-2" /> Quiz Duel</TabsTrigger>
                        <TabsTrigger value="whoami"><HelpCircle className="w-4 h-4 mr-2" /> Qui est-ce</TabsTrigger>
                        <TabsTrigger value="chrono"><Clock className="w-4 h-4 mr-2" /> ChronoBible</TabsTrigger>
                    </TabsList>

                    <div className="flex justify-end my-4">
                        <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Ajouter
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Contenu</TableHead>
                                        <TableHead>Détail</TableHead>
                                        <TableHead className="w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                Aucun contenu.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {activeTab === 'quiz' ? item.question :
                                                    activeTab === 'whoami' ? item.name :
                                                        item.event}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {activeTab === 'quiz' ? `${JSON.parse(JSON.stringify(item.options)).length} options` :
                                                    activeTab === 'whoami' ? `${JSON.parse(JSON.stringify(item.clues)).length} indices` :
                                                        item.year}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(item.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{editingItem ? 'Modifier' : 'Ajouter'}</DialogTitle>
                            </DialogHeader>
                            {activeTab === 'quiz' && (
                                <QuizForm
                                    initialData={editingItem}
                                    onSave={handleSave}
                                    onCancel={() => setIsDialogOpen(false)}
                                />
                            )}
                            {activeTab === 'whoami' && (
                                <WhoAmIForm
                                    initialData={editingItem}
                                    onSave={handleSave}
                                    onCancel={() => setIsDialogOpen(false)}
                                />
                            )}
                            {activeTab === 'chrono' && (
                                <ChronoForm
                                    initialData={editingItem}
                                    onSave={handleSave}
                                    onCancel={() => setIsDialogOpen(false)}
                                />
                            )}
                        </DialogContent>
                    </Dialog>
                </Tabs>
            </CardContent>
        </Card>
    );
}

function QuizForm({ initialData, onSave, onCancel }: any) {
    const [question, setQuestion] = useState(initialData?.question || '');
    const [options, setOptions] = useState<string[]>(initialData?.options || ['', '', '', '']);
    const [correctIndex, setCorrectIndex] = useState(initialData?.correct_index?.toString() || '0');
    const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'medium');

    const handleSubmit = () => {
        if (!question || options.some(o => !o.trim())) return toast.error("Remplissez tout");
        onSave({
            question,
            options,
            correct_index: parseInt(correctIndex),
            difficulty
        });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Question</Label>
                <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Qui a construit l'arche ?" />
            </div>
            <div className="space-y-2">
                <Label>Options (4 requises)</Label>
                {options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        <Badge variant="outline" className="w-6 h-6 flex justify-center p-0">{String.fromCharCode(65 + i)}</Badge>
                        <Input
                            value={opt}
                            onChange={e => {
                                const newOpts = [...options];
                                newOpts[i] = e.target.value;
                                setOptions(newOpts);
                            }}
                            placeholder={`Option ${i + 1}`}
                        />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Réponse Correcte</Label>
                    <Select value={correctIndex} onValueChange={setCorrectIndex}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {options.map((_, i) => (
                                <SelectItem key={i} value={i.toString()}>Option {String.fromCharCode(65 + i)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Difficulté</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="easy">Facile</SelectItem>
                            <SelectItem value="medium">Moyenne</SelectItem>
                            <SelectItem value="hard">Difficile</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Annuler</Button>
                <Button onClick={handleSubmit}>Sauvegarder</Button>
            </DialogFooter>
        </div>
    );
}

function WhoAmIForm({ initialData, onSave, onCancel }: any) {
    const [name, setName] = useState(initialData?.name || '');
    const [cluesText, setCluesText] = useState(initialData?.clues ? initialData.clues.join('\n') : '');
    const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'medium');

    const handleSubmit = () => {
        if (!name || !cluesText.trim()) return toast.error("Remplissez tout");
        const clues = cluesText.split('\n').filter((l: string) => l.trim().length > 0);
        onSave({ name, clues, difficulty });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Nom du Personnage</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Moïse" />
            </div>
            <div className="space-y-2">
                <Label>Indices (Un par ligne, du plus dur au plus facile)</Label>
                <Textarea
                    value={cluesText}
                    onChange={e => setCluesText(e.target.value)}
                    placeholder="J'ai été sauvé des eaux...&#10;J'ai vu le buisson ardent...&#10;J'ai libéré mon peuple..."
                    rows={6}
                />
            </div>
            <div className="space-y-2">
                <Label>Difficulté</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="easy">Facile</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="hard">Difficile</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Annuler</Button>
                <Button onClick={handleSubmit}>Sauvegarder</Button>
            </DialogFooter>
        </div>
    );
}

function ChronoForm({ initialData, onSave, onCancel }: any) {
    const [event, setEvent] = useState(initialData?.event || '');
    const [year, setYear] = useState(initialData?.year || '');

    // Helper to extract year for sort? For now we just trust inputs/sort manually if implemented.
    // Ideally we'd have a numeric field, but dates are fuzzy in Bible. We'll stick to string display.

    const handleSubmit = () => {
        if (!event || !year) return toast.error("Remplissez tout");
        onSave({ event, year });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Événement</Label>
                <Input value={event} onChange={e => setEvent(e.target.value)} placeholder="La Chute de Jéricho" />
            </div>
            <div className="space-y-2">
                <Label>Date / Année Approx.</Label>
                <Input value={year} onChange={e => setYear(e.target.value)} placeholder="~1400 av. J-C" />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Annuler</Button>
                <Button onClick={handleSubmit}>Sauvegarder</Button>
            </DialogFooter>
        </div>
    );
}
