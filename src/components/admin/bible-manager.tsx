"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    Upload, Book, Check, X, Loader2, Search,
    Trash2, Eye, RefreshCw, ArrowLeft, FileText,
    AlertTriangle
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// Types
interface BibleBook {
    id: string;
    book_id: string;
    name: string;
    chapters: number;
    testament: 'AT' | 'NT';
    book_order: number;
}

interface BibleChapter {
    book_id: string;
    chapter_number: number;
    content: string; // JSON string
    created_at: string;
}

export function BibleManager() {
    const [books, setBooks] = useState<BibleBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);

    const loadBooks = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('bible_books')
            .select('*')
            .order('book_order');

        if (error) {
            toast.error("Erreur lors du chargement des livres");
            console.error(error);
        } else {
            setBooks(data || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadBooks();
    }, [loadBooks]);

    const filteredBooks = books.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.book_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const atBooks = filteredBooks.filter(b => b.testament === 'AT');
    const ntBooks = filteredBooks.filter(b => b.testament === 'NT');

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (selectedBook) {
        return (
            <BookChapterManager
                book={selectedBook}
                onBack={() => setSelectedBook(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Rechercher un livre..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-slate-800/50 border-slate-700"
                    />
                </div>
            </div>

            <Tabs defaultValue="at" className="w-full">
                <TabsList className="bg-slate-800/50 w-full justify-start">
                    <TabsTrigger value="at" className="flex-1 md:flex-none">Ancien Testament ({atBooks.length})</TabsTrigger>
                    <TabsTrigger value="nt" className="flex-1 md:flex-none">Nouveau Testament ({ntBooks.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="at" className="mt-4">
                    <BooksList books={atBooks} onSelect={setSelectedBook} />
                </TabsContent>

                <TabsContent value="nt" className="mt-4">
                    <BooksList books={ntBooks} onSelect={setSelectedBook} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function BooksList({ books, onSelect }: { books: BibleBook[], onSelect: (book: BibleBook) => void }) {
    return (
        <ScrollArea className="h-[600px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                {books.map((book) => (
                    <Card
                        key={book.book_id}
                        className="cursor-pointer hover:bg-slate-800/50 transition-colors border-slate-700 hover:border-indigo-500/50"
                        onClick={() => onSelect(book)}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Book className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{book.name}</h3>
                                    <p className="text-xs text-slate-400">{book.chapters} chapitres</p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-slate-400">
                                Gérer <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </ScrollArea>
    );
}

// --- CHAPTER MANAGER ---

function BookChapterManager({ book, onBack }: { book: BibleBook, onBack: () => void }) {
    const [chapters, setChapters] = useState<number[]>([]);
    const [customChapters, setCustomChapters] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [uploadingChapter, setUploadingChapter] = useState<number | null>(null);

    // Load custom chapters from DB
    const loadCustomChapters = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('bible_chapters')
            .select('chapter_number')
            .eq('book_id', book.book_id);

        if (error) {
            console.error(error);
            toast.error("Erreur lors du chargement des chapitres personnalisés");
        } else {
            setCustomChapters(new Set(data.map(c => c.chapter_number)));
        }
        setLoading(false);
    }, [book.book_id]);

    useEffect(() => {
        // Generate array [1, 2, ..., N]
        setChapters(Array.from({ length: book.chapters }, (_, i) => i + 1));
        loadCustomChapters();
    }, [book.chapters, loadCustomChapters]);

    const handleChapterUpload = async (chapterNum: number, file: File) => {
        if (!file.name.toLowerCase().endsWith('.txt')) {
            toast.error("Veuillez choisir un fichier .txt");
            return;
        }

        setUploadingChapter(chapterNum);
        try {
            const text = await file.text();

            // Robust parsing
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            const verses = [];

            for (const line of lines) {
                // Match: Number + separator + Text
                // Separators: space, tab, dot, dash, parenthesis
                // Examples: "1 Au commencement", "1. Au commencement", "1 - Au commencement"
                const match = line.match(/^(\d+)[\s\.\-\)\t]*(.+)$/);
                if (match) {
                    verses.push({
                        verse: parseInt(match[1]),
                        text: match[2].trim()
                    });
                }
            }

            if (verses.length === 0) {
                const sample = lines[0] ? lines[0].substring(0, 50) : "Fichier vide";
                throw new Error(`Aucun verset détecté. Format attendu: '1 Texte'. Exemple lu: '${sample}...'`);
            }

            const jsonContent = JSON.stringify(verses);

            // Upsert into bible_chapters
            const { error } = await supabase
                .from('bible_chapters')
                .upsert({
                    book_id: book.book_id,
                    chapter_number: chapterNum,
                    content: jsonContent
                }, { onConflict: 'book_id,chapter_number' });

            if (error) throw error;

            toast.success(`Chapitre ${chapterNum} mis à jour avec ${verses.length} versets`);
            loadCustomChapters();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erreur lors de l'upload");
        } finally {
            setUploadingChapter(null);
        }
    };

    const handleDeleteCustom = async (chapterNum: number) => {
        if (!confirm(`Revenir à la version par défaut pour le chapitre ${chapterNum} ?`)) return;

        try {
            const { error } = await supabase
                .from('bible_chapters')
                .delete()
                .match({ book_id: book.book_id, chapter_number: chapterNum });

            if (error) throw error;

            toast.success(`Chapitre ${chapterNum} réinitialisé`);
            loadCustomChapters();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Retour
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">{book.name}</h2>
                    <p className="text-muted-foreground">{book.chapters} chapitres</p>
                </div>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3 text-amber-400 mb-6 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">
                            Les fichiers locaux sont utilisés par défaut. Si vous uploadez un chapitre ici,
                            il <strong>remplacera</strong> la version locale pour tous les utilisateurs.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {chapters.map(chapterNum => {
                                const isCustom = customChapters.has(chapterNum);
                                return (
                                    <div
                                        key={chapterNum}
                                        className={`
                                            p-4 rounded-lg border flex flex-col gap-3 transition-colors
                                            ${isCustom
                                                ? 'bg-indigo-950/30 border-indigo-500/50'
                                                : 'bg-slate-800/30 border-slate-700'}
                                        `}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-lg">Chapitre {chapterNum}</span>
                                            {isCustom ? (
                                                <Badge className="bg-indigo-500 hover:bg-indigo-600">Modifié</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-500 border-slate-600">Défaut</Badge>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-2 flex gap-2">
                                            <Label htmlFor={`upload-${book.book_id}-${chapterNum}`} className="flex-1 cursor-pointer">
                                                <div className={`
                                                    h-9 px-3 w-full flex items-center justify-center rounded-md text-sm font-medium transition-colors
                                                    ${uploadingChapter === chapterNum
                                                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700'}
                                                `}>
                                                    {uploadingChapter === chapterNum ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Upload className="h-3 w-3 mr-2" />
                                                            {isCustom ? 'Remplacer' : 'Uploader'}
                                                        </>
                                                    )}
                                                </div>
                                                <Input
                                                    id={`upload-${book.book_id}-${chapterNum}`}
                                                    type="file"
                                                    accept=".txt"
                                                    className="hidden"
                                                    disabled={uploadingChapter !== null}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleChapterUpload(chapterNum, file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </Label>

                                            {isCustom && (
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="h-9 w-9"
                                                    onClick={() => handleDeleteCustom(chapterNum)}
                                                    title="Revenir à la version locale"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default BibleManager;
