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
    Eye, EyeOff, Download, Image, FileText, Search, X
} from 'lucide-react';
import { toast } from 'sonner';
import { notifyNewBook } from '@/lib/notifications';

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
    created_at: string;
}

export function LibraryManager() {
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    useEffect(() => {
        fetchBooks();
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
            // Delete file from storage
            if (book.file_url) {
                const filePath = book.file_url.split('/library/')[1];
                if (filePath) await supabase.storage.from('library').remove([filePath]);
            }
            // Delete cover from storage
            if (book.cover_url) {
                const coverPath = book.cover_url.split('/library/')[1];
                if (coverPath) await supabase.storage.from('library').remove([coverPath]);
            }
            // Delete book record
            const { error } = await supabase.from('library_books').delete().eq('id', book.id);
            if (error) throw error;
            toast.success("Livre supprimé");
            fetchBooks();
        } catch (e: any) {
            toast.error(e.message);
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

                {/* Table */}
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
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
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            {searchQuery ? 'Aucun résultat' : 'Aucun livre dans la bibliothèque'}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredBooks.map(book => (
                                    <TableRow key={book.id}>
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
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingBook(book); setIsDialogOpen(true); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleTogglePublish(book)}>
                                                    {book.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(book)}>
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

    const handleBookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

            // Upload book file
            if (bookFile) {
                setUploadProgress('Upload du fichier...');
                const ext = bookFile.name.split('.').pop()?.toLowerCase();
                const path = `books/${Date.now()}_${bookFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

                const { error: uploadError } = await supabase.storage
                    .from('library')
                    .upload(path, bookFile, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('library').getPublicUrl(path);
                fileUrl = urlData.publicUrl;
                fileName = bookFile.name;
                fileSize = bookFile.size;
                fileType = ext || 'pdf';

                // Delete old file if updating
                if (initialData?.file_url) {
                    const oldPath = initialData.file_url.split('/library/')[1];
                    if (oldPath) await supabase.storage.from('library').remove([oldPath]);
                }
            }

            // Upload cover image
            if (coverFile) {
                setUploadProgress('Upload de la couverture...');
                const coverPath = `covers/${Date.now()}_${coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

                const { error: coverError } = await supabase.storage
                    .from('library')
                    .upload(coverPath, coverFile, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (coverError) throw coverError;

                const { data: coverUrlData } = supabase.storage.from('library').getPublicUrl(coverPath);
                coverUrl = coverUrlData.publicUrl;

                // Delete old cover if updating
                if (initialData?.cover_url) {
                    const oldCoverPath = initialData.cover_url.split('/library/')[1];
                    if (oldCoverPath) await supabase.storage.from('library').remove([oldCoverPath]);
                }
            }

            setUploadProgress('Sauvegarde...');

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
