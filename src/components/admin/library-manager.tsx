'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
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
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Loader2, Plus, Edit, Trash2, BookOpen, Upload, Star,
    Eye, EyeOff, Download, Image, FileText, Search, X,
    FolderUp, Clock, CheckCircle2, AlertCircle, Pause, Play,
    Pin, PinOff, CheckSquare, Square, MinusSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { notifyNewBook } from '@/lib/notifications';

// PDF.js for automatic cover extraction
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdf.js
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

// Upload helper — sends files to Cloudflare R2 via Worker
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || process.env.NEXT_PUBLIC_NOTIFICATION_WORKER_URL || '';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

async function uploadToR2(file: File, folder: 'books' | 'covers'): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const res = await fetch(`${WORKER_URL}/api/r2/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ADMIN_KEY}` },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || `Upload failed (${res.status})`);
    }

    return res.json();
}

async function deleteFromR2(url: string): Promise<void> {
    const r2Match = url.match(/\/r2\/(.+)$/);
    if (!r2Match) return;

    await fetch(`${WORKER_URL}/api/r2/delete`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ADMIN_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: r2Match[1] }),
    });
}

// =====================================================
// Auto-extract first page of PDF as cover image
// =====================================================
async function extractPdfCover(file: File): Promise<File | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        // Render at good quality for cover (scale for ~400px width)
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert to JPEG blob
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.85)
        );

        if (!blob) return null;

        // Create File object from blob
        const coverName = file.name.replace(/\.(pdf|epub)$/i, '_cover.jpg');
        return new File([blob], coverName, { type: 'image/jpeg' });
    } catch (err) {
        console.warn('Could not extract PDF cover:', err);
        return null;
    }
}

const CATEGORIES = [
    { value: 'bible-study', label: 'Étude biblique' },
    { value: 'prayer', label: 'Prière' },
    { value: 'theology', label: 'Théologie' },
    { value: 'devotional', label: 'Dévotionnel' },
    { value: 'biography', label: 'Biographie' },
    { value: 'youth', label: 'Jeunesse' },
    { value: 'worship', label: 'Louange' },
    { value: 'other', label: 'Autres' },
];

interface Book {
    id: string;
    title: string;
    author: string;
    description: string;
    category: string;
    cover_url: string | null;
    file_url: string;
    file_name: string;
    file_size: number;
    file_type: string;
    page_count: number;
    avg_rating: number;
    rating_count: number;
    download_count: number;
    is_published: boolean;
    is_pinned: boolean;
    created_at: string;
}

export function LibraryManager() {
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
    const [isBulkUploading, setIsBulkUploading] = useState(false);
    const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    useEffect(() => {
        fetchBooks();

        // Bug 3 FIX: Auto-publish scheduled books whose scheduled_at has passed
        const checkScheduledBooks = async () => {
            try {
                const now = new Date().toISOString();
                const { data: scheduledBooks, error } = await supabase
                    .from('library_books')
                    .select('id, title, author')
                    .eq('is_published', false)
                    .not('scheduled_at', 'is', null)
                    .lte('scheduled_at', now);

                if (error || !scheduledBooks || scheduledBooks.length === 0) return;

                // Auto-publish each book
                for (const book of scheduledBooks) {
                    await supabase
                        .from('library_books')
                        .update({ is_published: true })
                        .eq('id', book.id);

                    // Send notification
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    if (authUser) {
                        notifyNewBook({
                            bookId: book.id,
                            bookTitle: book.title,
                            bookAuthor: book.author,
                            publisherId: authUser.id,
                            publisherName: 'Publication auto',
                        }).catch(() => { });
                    }
                }

                if (scheduledBooks.length > 0) {
                    toast.success(`📚 ${scheduledBooks.length} livre(s) publié(s) automatiquement (programmation)`);
                    fetchBooks(); // refresh list
                }
            } catch { /* ignore */ }
        };

        checkScheduledBooks();
        const interval = setInterval(checkScheduledBooks, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const fetchBooks = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('library_books')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBooks(data || []);
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (book: Book) => {
        if (!confirm(`Supprimer "${book.title}" ? Cette action est irréversible.`)) return;
        try {
            // Delete file from R2 (or legacy Supabase Storage)
            if (book.file_url) {
                await deleteFromR2(book.file_url).catch(() => {
                    // Fallback: try Supabase Storage for old books
                    const filePath = book.file_url.split('/library/')[1];
                    if (filePath) supabase.storage.from('library').remove([filePath]);
                });
            }
            // Delete cover from R2 (or legacy Supabase Storage)
            if (book.cover_url) {
                await deleteFromR2(book.cover_url).catch(() => {
                    const coverPath = book.cover_url!.split('/library/')[1];
                    if (coverPath) supabase.storage.from('library').remove([coverPath]);
                });
            }
            // Delete book record
            const { error } = await supabase.from('library_books').delete().eq('id', book.id);
            await fetchBooks();
            toast.success('Le livre a été supprimé.');
        } catch (e: any) {
            toast.error('Erreur lors de la suppression');
        }
    };

    // ── Bulk Selection Helpers ──────────────────────────────
    const toggleSelectBook = (id: string) => {
        setSelectedBooks(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedBooks.size === filteredBooks.length) {
            setSelectedBooks(new Set());
        } else {
            setSelectedBooks(new Set(filteredBooks.map(b => b.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedBooks.size === 0) return;
        const count = selectedBooks.size;
        if (!confirm(`⚠️ Supprimer ${count} livre${count > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;

        setIsBulkDeleting(true);
        let deleted = 0;
        let errors = 0;

        for (const bookId of selectedBooks) {
            const book = books.find(b => b.id === bookId);
            if (!book) continue;

            try {
                // Delete file from R2 (or legacy Supabase Storage)
                if (book.file_url) {
                    await deleteFromR2(book.file_url).catch(() => {
                        const filePath = book.file_url.split('/library/')[1];
                        if (filePath) supabase.storage.from('library').remove([filePath]);
                    });
                }
                // Delete cover from R2 (or legacy Supabase Storage)
                if (book.cover_url) {
                    await deleteFromR2(book.cover_url).catch(() => {
                        const coverPath = book.cover_url!.split('/library/')[1];
                        if (coverPath) supabase.storage.from('library').remove([coverPath]);
                    });
                }
                // Delete book record
                const { error } = await supabase.from('library_books').delete().eq('id', book.id);
                if (error) throw error;
                deleted++;
            } catch (e: any) {
                errors++;
                console.error(`Failed to delete book ${book.title}:`, e);
            }
        }

        setSelectedBooks(new Set());
        await fetchBooks();
        setIsBulkDeleting(false);

        if (errors === 0) {
            toast.success(`🗑️ ${deleted} livre${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''} avec succès.`);
        } else {
            toast.warning(`${deleted} supprimé${deleted > 1 ? 's' : ''}, ${errors} erreur${errors > 1 ? 's' : ''}.`);
        }
    };

    // ── Bulk Publish/Hide ──────────────────────────────
    const [isBulkPublishing, setIsBulkPublishing] = useState(false);
    const handleBulkPublish = async (publish: boolean) => {
        if (selectedBooks.size === 0) return;
        const count = selectedBooks.size;
        const action = publish ? 'publier' : 'masquer';
        if (!confirm(`${publish ? '📢' : '🔒'} ${action.charAt(0).toUpperCase() + action.slice(1)} ${count} livre${count > 1 ? 's' : ''} ?`)) return;

        setIsBulkPublishing(true);
        let updated = 0;
        let errors = 0;

        for (const bookId of selectedBooks) {
            try {
                const { error } = await supabase
                    .from('library_books')
                    .update({ is_published: publish })
                    .eq('id', bookId);
                if (error) throw error;
                updated++;

                if (publish) {
                    const book = books.find(b => b.id === bookId);
                    if (book && !book.is_published) {
                        const { data: { user: authUser } } = await supabase.auth.getUser();
                        if (authUser) {
                            notifyNewBook({
                                bookId: book.id,
                                bookTitle: book.title,
                                bookAuthor: book.author,
                                publisherId: authUser.id,
                                publisherName: 'Administrateur',
                            }).catch(console.error);
                        }
                    }
                }
            } catch (e: any) {
                errors++;
            }
        }

        setSelectedBooks(new Set());
        await fetchBooks();
        setIsBulkPublishing(false);

        if (errors === 0) {
            toast.success(`${publish ? '📢' : '🔒'} ${updated} livre${updated > 1 ? 's' : ''} ${publish ? 'publié' : 'masqué'}${updated > 1 ? 's' : ''}.`);
        } else {
            toast.warning(`${updated} traité${updated > 1 ? 's' : ''}, ${errors} erreur${errors > 1 ? 's' : ''}.`);
        }
    };

    const handleTogglePin = async (book: Book) => {
        const newVal = !book.is_pinned;
        try {
            const { error } = await supabase
                .from('library_books')
                .update({ is_pinned: newVal })
                .eq('id', book.id);
            if (error) throw error;
            setBooks(prev => prev.map(b => b.id === book.id ? { ...b, is_pinned: newVal } : b));
            toast.success(newVal ? '📌 Livre épinglé avec succès !' : 'Livre retiré de la sélection !');
        } catch (e: any) {
            toast.error('Erreur: ' + e.message);
        }
    };

    const handleTogglePublish = async (book: Book) => {
        try {
            const { error } = await supabase
                .from('library_books')
                .update({ is_published: !book.is_published })
                .eq('id', book.id);
            if (error) throw error;
            toast.success(book.is_published ? "Livre masqué" : "Livre publié");

            // If book is being published (was hidden), notify users
            if (!book.is_published) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    notifyNewBook({
                        bookId: book.id,
                        bookTitle: book.title,
                        bookAuthor: book.author,
                        publisherId: user.id,
                        publisherName: profile?.full_name || 'Administrateur',
                    }).catch(console.error);
                }
            }

            fetchBooks();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const filteredBooks = books.filter(b => {
        const matchesSearch = !searchQuery ||
            b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.author.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || b.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Gestion de la Bibliothèque
                </CardTitle>
                <CardDescription>
                    Uploadez et gérez les livres de la bibliothèque. {books.length} livre{books.length !== 1 ? 's' : ''} au total.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un livre..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes catégories</SelectItem>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => { setEditingBook(null); setIsDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Ajouter un livre
                    </Button>
                    <Button
                        variant="outline"
                        className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                        onClick={() => setIsBulkDialogOpen(true)}
                    >
                        <FolderUp className="w-4 h-4 mr-2" /> Upload massif
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-400">{books.length}</p>
                        <p className="text-xs text-muted-foreground">Total livres</p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-400">{books.filter(b => b.is_published).length}</p>
                        <p className="text-xs text-muted-foreground">Publiés</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-amber-400">
                            {books.reduce((sum, b) => sum + b.rating_count, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Avis reçus</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-purple-400">
                            {books.reduce((sum, b) => sum + b.download_count, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Téléchargements</p>
                    </div>
                </div>

                {/* Bulk Selection Bar */}
                {selectedBooks.size > 0 && (
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <CheckSquare className="w-5 h-5 text-red-400 shrink-0" />
                        <span className="text-sm font-medium text-red-300">
                            {selectedBooks.size} livre{selectedBooks.size > 1 ? 's' : ''} sélectionné{selectedBooks.size > 1 ? 's' : ''}
                        </span>
                        <div className="flex-1" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-white"
                            onClick={() => setSelectedBooks(new Set())}
                        >
                            Tout désélectionner
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isBulkPublishing}
                            onClick={() => handleBulkPublish(true)}
                            className="gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        >
                            {isBulkPublishing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Eye className="w-4 h-4" />
                            )}
                            Publier ({selectedBooks.size})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isBulkPublishing}
                            onClick={() => handleBulkPublish(false)}
                            className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        >
                            {isBulkPublishing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <EyeOff className="w-4 h-4" />
                            )}
                            Masquer ({selectedBooks.size})
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isBulkDeleting}
                            onClick={handleBulkDelete}
                            className="gap-2"
                        >
                            {isBulkDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            Supprimer ({selectedBooks.size})
                        </Button>
                    </div>
                )}

                {/* Table */}
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="flex items-center justify-center h-5 w-5 text-muted-foreground hover:text-white transition-colors"
                                        >
                                            {filteredBooks.length > 0 && selectedBooks.size === filteredBooks.length ? (
                                                <CheckSquare className="w-4 h-4 text-indigo-400" />
                                            ) : selectedBooks.size > 0 ? (
                                                <MinusSquare className="w-4 h-4 text-indigo-400" />
                                            ) : (
                                                <Square className="w-4 h-4" />
                                            )}
                                        </button>
                                    </TableHead>
                                    <TableHead>Couverture</TableHead>
                                    <TableHead>Titre / Auteur</TableHead>
                                    <TableHead>Catégorie</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead>Taille</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBooks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            {searchQuery ? 'Aucun résultat' : 'Aucun livre dans la bibliothèque'}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredBooks.map(book => (
                                    <TableRow key={book.id} className={selectedBooks.has(book.id) ? 'bg-indigo-500/5' : ''}>
                                        <TableCell>
                                            <button
                                                onClick={() => toggleSelectBook(book.id)}
                                                className="flex items-center justify-center h-5 w-5 text-muted-foreground hover:text-white transition-colors"
                                            >
                                                {selectedBooks.has(book.id) ? (
                                                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </TableCell>
                                        <TableCell>
                                            {book.cover_url ? (
                                                <img src={book.cover_url} alt="" className="w-10 h-14 rounded object-cover" />
                                            ) : (
                                                <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-medium text-sm">{book.title}</p>
                                            <p className="text-xs text-muted-foreground">{book.author}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {CATEGORIES.find(c => c.value === book.category)?.label || book.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                <span className="text-sm">{Number(book.avg_rating).toFixed(1)}</span>
                                                <span className="text-xs text-muted-foreground">({book.rating_count})</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">{formatSize(book.file_size)}</TableCell>
                                        <TableCell>
                                            <Badge className={book.is_published
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                                            }>
                                                {book.is_published ? 'Publié' : 'Masqué'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleTogglePin(book)}>
                                                    {book.is_pinned ? <PinOff className="w-4 h-4 text-purple-400" /> : <Pin className="w-4 h-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingBook(book); setIsDialogOpen(true); }}>
                                                    <Edit className="w-4 h-4 text-blue-400" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleTogglePublish(book)}>
                                                    {book.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-green-400" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(book)}>
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

                {/* Upload/Edit Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingBook ? 'Modifier le livre' : 'Ajouter un livre'}</DialogTitle>
                        </DialogHeader>
                        <BookForm
                            initialData={editingBook}
                            onSave={() => { setIsDialogOpen(false); setEditingBook(null); fetchBooks(); }}
                            onCancel={() => { setIsDialogOpen(false); setEditingBook(null); }}
                        />
                    </DialogContent>
                </Dialog>

                {/* Bulk Upload Dialog */}
                <Dialog open={isBulkDialogOpen} onOpenChange={(open) => { if (!isBulkUploading) setIsBulkDialogOpen(open); }}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FolderUp className="w-5 h-5 text-violet-400" />
                                Upload massif de livres
                            </DialogTitle>
                        </DialogHeader>
                        <BulkUploadForm
                            onComplete={() => { setIsBulkDialogOpen(false); fetchBooks(); }}
                            onCancel={() => { if (!isBulkUploading) setIsBulkDialogOpen(false); }}
                            onUploadingChange={setIsBulkUploading}
                        />
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

// Book upload/edit form
function BookForm({ initialData, onSave, onCancel }: { initialData: Book | null; onSave: () => void; onCancel: () => void }) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [author, setAuthor] = useState(initialData?.author || 'Auteur inconnu');
    const [description, setDescription] = useState(initialData?.description || '');
    const [category, setCategory] = useState(initialData?.category || 'other');
    const [pageCount, setPageCount] = useState(initialData?.page_count?.toString() || '0');
    const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    // File states
    const [bookFile, setBookFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string>(initialData?.cover_url || '');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const handleBookFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'epub'].includes(ext || '')) {
            toast.error('Seuls les fichiers PDF et EPUB sont acceptés');
            return;
        }

        setBookFile(file);
        // Auto-fill title from filename
        if (!title) {
            const name = file.name.replace(/\.(pdf|epub)$/i, '');
            if (name.includes(' - ')) {
                const parts = name.split(' - ');
                setAuthor(parts[0].trim());
                setTitle(parts.slice(1).join(' - ').trim());
            } else {
                setTitle(name.replace(/_/g, ' '));
            }
        }

        // Auto-extract cover from PDF if no cover set yet
        if (ext === 'pdf' && !coverFile && !coverPreview) {
            try {
                const autoCover = await extractPdfCover(file);
                if (autoCover) {
                    setCoverFile(autoCover);
                    const reader = new FileReader();
                    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
                    reader.readAsDataURL(autoCover);
                    toast.success('📸 Couverture extraite automatiquement !');
                }
            } catch { /* ignore */ }
        }
    };

    const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Veuillez sélectionner une image");
            return;
        }

        setCoverFile(file);
        // Preview
        const reader = new FileReader();
        reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return toast.error("Le titre est obligatoire");
        if (!initialData && !bookFile) return toast.error("Veuillez sélectionner un fichier PDF ou EPUB");

        setIsUploading(true);
        try {
            let fileUrl = initialData?.file_url || '';
            let fileName = initialData?.file_name || '';
            let fileSize = initialData?.file_size || 0;
            let fileType = initialData?.file_type || 'pdf';
            let coverUrl = initialData?.cover_url || '';

            // Upload book file to R2
            if (bookFile) {
                setUploadProgress('Upload du fichier vers R2...');
                const ext = bookFile.name.split('.').pop()?.toLowerCase();

                const result = await uploadToR2(bookFile, 'books');
                fileUrl = result.url;
                fileName = bookFile.name;
                fileSize = bookFile.size;
                fileType = ext || 'pdf';

                // Delete old file if updating
                if (initialData?.file_url) {
                    await deleteFromR2(initialData.file_url).catch(() => {
                        const oldPath = initialData.file_url.split('/library/')[1];
                        if (oldPath) supabase.storage.from('library').remove([oldPath]);
                    });
                }
            }

            // Upload cover image to R2
            if (coverFile) {
                setUploadProgress('Upload de la couverture vers R2...');

                const coverResult = await uploadToR2(coverFile, 'covers');
                coverUrl = coverResult.url;

                // Delete old cover if updating
                if (initialData?.cover_url) {
                    await deleteFromR2(initialData.cover_url).catch(() => {
                        const oldCoverPath = initialData.cover_url!.split('/library/')[1];
                        if (oldCoverPath) supabase.storage.from('library').remove([oldCoverPath]);
                    });
                }
            }

            setUploadProgress('Sauvegarde...');

            // Generate slug from title
            const slug = title.trim()
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .slice(0, 80);

            const bookData = {
                title: title.trim(),
                author: author.trim() || 'Auteur inconnu',
                description: description.trim(),
                category,
                cover_url: coverUrl || null,
                file_url: fileUrl,
                file_name: fileName,
                file_size: fileSize,
                file_type: fileType,
                page_count: parseInt(pageCount) || 0,
                is_published: isPublished,
                slug,
                updated_at: new Date().toISOString(),
            };

            if (initialData) {
                const { error } = await supabase
                    .from('library_books')
                    .update(bookData)
                    .eq('id', initialData.id);
                if (error) throw error;
                toast.success("Livre mis à jour !");
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                const { data: inserted, error } = await supabase
                    .from('library_books')
                    .insert({ ...bookData, uploaded_by: user?.id })
                    .select()
                    .single();
                if (error) throw error;
                toast.success("Livre ajouté à la bibliothèque !");

                // Send notification to all users if published
                if (isPublished && inserted && user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    notifyNewBook({
                        bookId: inserted.id,
                        bookTitle: title.trim(),
                        bookAuthor: author.trim() || 'Auteur inconnu',
                        publisherId: user.id,
                        publisherName: profile?.full_name || 'Administrateur',
                    }).catch(console.error);
                }
            }

            onSave();
        } catch (e: any) {
            toast.error("Erreur: " + e.message);
        } finally {
            setIsUploading(false);
            setUploadProgress('');
        }
    };

    return (
        <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
                <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Fichier du livre (PDF ou EPUB) {!initialData && '*'}
                </Label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.epub"
                    onChange={handleBookFileChange}
                    className="hidden"
                />
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        {bookFile ? bookFile.name : initialData?.file_name || 'Choisir un fichier'}
                    </Button>
                    {bookFile && (
                        <Badge variant="secondary">{(bookFile.size / (1024 * 1024)).toFixed(1)} MB</Badge>
                    )}
                </div>
            </div>

            {/* Cover Upload */}
            <div className="space-y-2">
                <Label className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Image de couverture
                </Label>
                <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="hidden"
                />
                <div className="flex gap-3 items-start">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => coverInputRef.current?.click()}
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        {coverFile ? 'Changer' : 'Choisir'}
                    </Button>
                    {coverPreview && (
                        <div className="relative">
                            <img src={coverPreview} alt="Preview" className="w-16 h-22 rounded object-cover border" />
                            <button
                                onClick={() => { setCoverFile(null); setCoverPreview(''); }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    Astuce : Faites une capture d'écran de la page de couverture du PDF et uploadez-la ici.
                </p>
            </div>

            {/* Title & Author */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Titre *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Le titre du livre" />
                </div>
                <div className="space-y-2">
                    <Label>Auteur</Label>
                    <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Nom de l'auteur" />
                </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brève description du livre..."
                    rows={3}
                />
            </div>

            {/* Category, Pages, Published */}
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Nombre de pages</Label>
                    <Input
                        type="number"
                        value={pageCount}
                        onChange={e => setPageCount(e.target.value)}
                        placeholder="0"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Publier</Label>
                    <div className="flex items-center gap-2 pt-2">
                        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                        <span className="text-sm">{isPublished ? 'Visible' : 'Masqué'}</span>
                    </div>
                </div>
            </div>

            {/* Upload progress */}
            {isUploading && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-sm text-blue-400">{uploadProgress}</span>
                </div>
            )}

            <DialogFooter>
                <Button variant="outline" onClick={onCancel} disabled={isUploading}>Annuler</Button>
                <Button onClick={handleSubmit} disabled={isUploading}>
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {initialData ? 'Mettre à jour' : 'Publier le livre'}
                </Button>
            </DialogFooter>
        </div>
    );
}

// =====================================================
// BULK UPLOAD FORM — Upload 100-1000+ books at once
// =====================================================
interface BulkFileEntry {
    file: File;
    title: string;
    author: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    progress: string;
    error?: string;
    coverPreview?: string;
}

function BulkUploadForm({
    onComplete,
    onCancel,
    onUploadingChange,
}: {
    onComplete: () => void;
    onCancel: () => void;
    onUploadingChange: (uploading: boolean) => void;
}) {
    const [files, setFiles] = useState<BulkFileEntry[]>([]);
    const [bulkCategory, setBulkCategory] = useState('other');
    const [isUploading, setIsUploading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const pauseRef = useRef(false);
    const cancelRef = useRef(false);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const doneCount = files.filter(f => f.status === 'done').length;
    const errorCount = files.filter(f => f.status === 'error').length;
    const pendingCount = files.filter(f => f.status === 'pending').length;
    const totalCount = files.length;
    const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const totalSize = files.reduce((s, f) => s + f.file.size, 0);

    // Parse title and author from filename
    const parseFilename = (name: string): { title: string; author: string } => {
        const clean = name.replace(/\.(pdf|epub)$/i, '');
        if (clean.includes(' - ')) {
            const parts = clean.split(' - ');
            return { author: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
        }
        return { title: clean.replace(/_/g, ' '), author: 'Auteur inconnu' };
    };

    // Generate cover thumbnail preview
    const generateCoverPreview = async (file: File): Promise<string | undefined> => {
        if (!file.name.toLowerCase().endsWith('.pdf')) return undefined;
        try {
            const ab = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
            const page = await pdf.getPage(1);
            const vp = page.getViewport({ scale: 0.4 });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width;
            canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
            return canvas.toDataURL('image/jpeg', 0.5);
        } catch { return undefined; }
    };

    // Card style per status
    const getCardStyle = (status: BulkFileEntry['status']) => {
        switch (status) {
            case 'done': return 'bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 border-emerald-500/30 shadow-emerald-500/10';
            case 'error': return 'bg-gradient-to-br from-red-500/20 to-red-900/10 border-red-500/30 shadow-red-500/10';
            case 'uploading': return 'bg-gradient-to-br from-blue-500/20 to-violet-900/10 border-blue-500/30 shadow-blue-500/10 animate-pulse';
            default: return 'bg-gradient-to-br from-slate-700/30 to-slate-800/30 border-white/10 hover:border-violet-500/30';
        }
    };

    // Drag and drop
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    // Handle file selection (supports both folder and multi-file)
    const handleFilesSelected = async (selectedFiles: FileList | null) => {
        if (!selectedFiles || selectedFiles.length === 0) return;

        const validFiles: BulkFileEntry[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['pdf', 'epub'].includes(ext || '')) {
                const { title, author } = parseFilename(file.name);
                validFiles.push({
                    file,
                    title,
                    author,
                    status: 'pending',
                    progress: '',
                });
            }
        }

        if (validFiles.length === 0) {
            toast.error('Aucun fichier PDF ou EPUB trouvé');
            return;
        }

        const startIdx = files.length;
        setFiles(prev => [...prev, ...validFiles]);
        toast.success(`${validFiles.length} fichier(s) ajouté(s)`);

        // Generate cover previews in background (first 50)
        const limit = Math.min(validFiles.length, 50);
        for (let i = 0; i < limit; i++) {
            generateCoverPreview(validFiles[i].file).then(preview => {
                if (preview) {
                    setFiles(prev => prev.map((f, j) =>
                        j === startIdx + i ? { ...f, coverPreview: preview } : f
                    ));
                }
            });
        }
    };

    // Remove a file from the queue
    const removeFile = (index: number) => {
        if (files[index].status === 'uploading') return;
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Clear all pending files
    const clearPending = () => {
        setFiles(prev => prev.filter(f => f.status !== 'pending'));
    };

    // Start bulk upload
    const startUpload = async () => {
        if (files.length === 0) return toast.error('Aucun fichier à uploader');

        setIsUploading(true);
        onUploadingChange(true);
        cancelRef.current = false;
        pauseRef.current = false;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('Non connecté');
            setIsUploading(false);
            onUploadingChange(false);
            return;
        }

        // Determine if scheduled
        let scheduledAt: string | null = null;
        let publishNow = true;
        if (scheduleEnabled && scheduleDate && scheduleTime) {
            scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
            publishNow = false;
        }

        for (let i = 0; i < files.length; i++) {
            // Skip already processed
            if (files[i].status === 'done' || files[i].status === 'error') continue;
            if (cancelRef.current) break;

            // Wait while paused
            while (pauseRef.current) {
                await new Promise(r => setTimeout(r, 500));
                if (cancelRef.current) break;
            }
            if (cancelRef.current) break;

            setCurrentIndex(i);

            // Update status to uploading
            setFiles(prev => prev.map((f, idx) =>
                idx === i ? { ...f, status: 'uploading', progress: 'Upload vers R2...' } : f
            ));

            try {
                // 1. Upload file to R2
                const result = await uploadToR2(files[i].file, 'books');
                const ext = files[i].file.name.split('.').pop()?.toLowerCase();

                // 2. Auto-extract cover from PDF first page
                let coverUrl: string | null = null;
                if (ext === 'pdf') {
                    setFiles(prev => prev.map((f, idx) =>
                        idx === i ? { ...f, progress: '📸 Extraction couverture...' } : f
                    ));
                    try {
                        const coverFile = await extractPdfCover(files[i].file);
                        if (coverFile) {
                            const coverResult = await uploadToR2(coverFile, 'covers');
                            coverUrl = coverResult.url;
                        }
                    } catch (coverErr) {
                        console.warn('Cover extraction failed, continuing without cover:', coverErr);
                    }
                }

                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, progress: 'Enregistrement en base...' } : f
                ));

                // 3. Generate slug
                const slug = files[i].title
                    .toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .slice(0, 80) + '-' + Date.now().toString(36);

                // 4. Insert into Supabase
                const bookData: Record<string, any> = {
                    title: files[i].title,
                    author: files[i].author,
                    description: '',
                    category: bulkCategory,
                    cover_url: coverUrl,
                    file_url: result.url,
                    file_name: files[i].file.name,
                    file_size: files[i].file.size,
                    file_type: ext || 'pdf',
                    page_count: 0,
                    is_published: publishNow,
                    slug,
                    uploaded_by: user.id,
                    updated_at: new Date().toISOString(),
                };
                if (scheduledAt) {
                    bookData.scheduled_at = scheduledAt;
                }

                const { error } = await supabase.from('library_books').insert(bookData);
                if (error) throw error;

                // Done!
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'done', progress: '✅ Publié' } : f
                ));
            } catch (err: any) {
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'error', progress: '', error: err.message || 'Erreur' } : f
                ));
            }

            // Small delay between uploads to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }

        setIsUploading(false);
        onUploadingChange(false);
        toast.success(`Upload terminé ! ${doneCount + 1}/${totalCount} livres publiés`);
    };

    const togglePause = () => {
        pauseRef.current = !pauseRef.current;
        setIsPaused(!isPaused);
    };

    const cancelUpload = () => {
        cancelRef.current = true;
        pauseRef.current = false;
        setIsPaused(false);
        setTimeout(() => {
            setIsUploading(false);
            onUploadingChange(false);
        }, 600);
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-5 max-h-[80vh] overflow-y-auto">
            {/* ─── Header Stats ─── */}
            {files.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-violet-500/20 to-violet-900/30 rounded-xl p-3 text-center border border-violet-500/20">
                        <p className="text-2xl font-bold text-violet-300">{totalCount}</p>
                        <p className="text-[10px] text-violet-400/70 uppercase tracking-wider">Total</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-900/30 rounded-xl p-3 text-center border border-emerald-500/20">
                        <p className="text-2xl font-bold text-emerald-300">{doneCount}</p>
                        <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Publiés</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500/20 to-amber-900/30 rounded-xl p-3 text-center border border-amber-500/20">
                        <p className="text-2xl font-bold text-amber-300">{pendingCount}</p>
                        <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">En attente</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500/20 to-red-900/30 rounded-xl p-3 text-center border border-red-500/20">
                        <p className="text-2xl font-bold text-red-300">{errorCount}</p>
                        <p className="text-[10px] text-red-400/70 uppercase tracking-wider">Erreurs</p>
                    </div>
                </div>
            )}

            {/* ─── Progress Bar ─── */}
            {isUploading && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>Progression globale</span>
                        <span className="font-mono text-violet-300">{progressPercent}% · {formatSize(totalSize)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-violet-600 via-blue-500 to-emerald-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ─── Drop Zone ─── */}
            {!isUploading && (
                <div className="space-y-3">
                    <input
                        ref={folderInputRef}
                        type="file"
                        accept=".pdf,.epub"
                        multiple
                        // @ts-ignore
                        webkitdirectory=""
                        onChange={e => handleFilesSelected(e.target.files)}
                        className="hidden"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.epub"
                        multiple
                        onChange={e => handleFilesSelected(e.target.files)}
                        className="hidden"
                    />

                    <div
                        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group overflow-hidden ${isDragOver
                            ? 'border-violet-400 bg-violet-500/20 scale-[1.01]'
                            : 'border-violet-500/20 hover:border-violet-500/40 bg-gradient-to-br from-violet-500/5 to-blue-500/5'
                            }`}
                        onClick={() => folderInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/0 via-violet-500/20 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center">
                                <FolderUp className="w-8 h-8 text-violet-300" />
                            </div>
                            <p className="text-lg font-bold text-white">
                                {isDragOver ? '📂 Déposez vos fichiers ici' : '📂 Sélectionner un dossier complet'}
                            </p>
                            <p className="text-sm text-slate-400 mt-2">
                                Glissez-déposez ou cliquez pour sélectionner vos livres PDF/EPUB
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Supporte 100, 500, 1000+ fichiers · Extraction automatique des couvertures
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 hover:border-violet-500/30"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Fichiers individuels
                        </Button>
                        {files.length > 0 && (
                            <Button variant="destructive" size="sm" onClick={clearPending} className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/20">
                                <X className="w-4 h-4 mr-1" /> Tout vider
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Settings Panel ─── */}
            {files.length > 0 && !isUploading && (
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-5 space-y-4 border border-white/10 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-violet-300" />
                        </div>
                        <p className="text-sm font-bold text-white">Paramètres de publication</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">Catégorie pour tous les livres</Label>
                            <Select value={bulkCategory} onValueChange={setBulkCategory}>
                                <SelectTrigger className="bg-slate-700/50 border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Publication programmée
                            </Label>
                            <div className="flex items-center gap-3 pt-1">
                                <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                                <span className="text-xs text-slate-300">
                                    {scheduleEnabled ? '⏰ Programmé' : '⚡ Instantané'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {scheduleEnabled && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Date</Label>
                                <Input
                                    type="date"
                                    value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="bg-slate-700/50 border-white/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-400">Heure</Label>
                                <Input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={e => setScheduleTime(e.target.value)}
                                    className="bg-slate-700/50 border-white/10"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Book Cards Grid ─── */}
            {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[45vh] overflow-y-auto pr-1 pb-2">
                    {files.map((entry, idx) => (
                        <div
                            key={idx}
                            className={`relative rounded-xl border p-3 transition-all duration-300 shadow-lg ${getCardStyle(entry.status)}`}
                        >
                            {/* Remove button */}
                            {entry.status === 'pending' && !isUploading && (
                                <button
                                    onClick={() => removeFile(idx)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center text-xs hover:bg-red-500 transition-colors z-10 shadow"
                                >
                                    ×
                                </button>
                            )}

                            {/* Cover Thumbnail */}
                            <div className="w-full aspect-[3/4] rounded-lg overflow-hidden mb-2 bg-slate-800/50 flex items-center justify-center">
                                {entry.coverPreview ? (
                                    <img
                                        src={entry.coverPreview}
                                        alt={entry.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-slate-500">
                                        {entry.file.name.endsWith('.epub') ? (
                                            <BookOpen className="w-8 h-8" />
                                        ) : (
                                            <FileText className="w-8 h-8" />
                                        )}
                                        <span className="text-[9px] uppercase">
                                            {entry.file.name.split('.').pop()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Book Info */}
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-white truncate leading-tight" title={entry.title}>
                                    {entry.title}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate" title={entry.author}>
                                    {entry.author}
                                </p>
                            </div>

                            {/* Status Footer */}
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[9px] text-slate-500 font-mono">
                                    {formatSize(entry.file.size)}
                                </span>
                                <div className="flex items-center gap-1">
                                    {entry.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                                    {entry.status === 'error' && (
                                        <span className="text-[9px] text-red-400 truncate max-w-[60px]" title={entry.error}>❌</span>
                                    )}
                                    {entry.status === 'uploading' && (
                                        <div className="flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                                            <span className="text-[9px] text-blue-300">{entry.progress}</span>
                                        </div>
                                    )}
                                    {entry.status === 'pending' && (
                                        <span className="text-[9px] text-slate-500">En attente</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Actions ─── */}
            <DialogFooter className="flex gap-2 pt-2 border-t border-white/5">
                {isUploading ? (
                    <>
                        <Button variant="outline" onClick={togglePause} className="bg-white/5 border-white/10">
                            {isPaused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                            {isPaused ? 'Reprendre' : 'Pause'}
                        </Button>
                        <Button variant="destructive" onClick={cancelUpload} className="bg-red-500/20 border-red-500/20 text-red-300">
                            <X className="w-4 h-4 mr-1" /> Annuler
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="outline" onClick={onCancel} className="bg-white/5 border-white/10">Fermer</Button>
                        {files.length > 0 && files.some(f => f.status === 'pending') && (
                            <Button
                                className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/20"
                                onClick={startUpload}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Lancer l&apos;upload ({pendingCount} fichiers)
                            </Button>
                        )}
                        {files.length > 0 && !files.some(f => f.status === 'pending') && (
                            <Button onClick={onComplete} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Terminé
                            </Button>
                        )}
                    </>
                )}
            </DialogFooter>
        </div>
    );
}

