'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, Upload, FileText, Image, Video, Music, Trash2,
    Edit, Save, Eye, EyeOff, GripVertical, Loader2, X, Check,
    File, Link as LinkIcon, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { DayResource, ResourceType } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const RESOURCE_TYPES: { value: ResourceType; label: string; icon: any; accept: string }[] = [
    { value: 'image', label: 'Image', icon: Image, accept: 'image/*' },
    { value: 'video', label: 'Vidéo', icon: Video, accept: 'video/*' },
    { value: 'pdf', label: 'PDF', icon: FileText, accept: '.pdf' },
    { value: 'audio', label: 'Audio', icon: Music, accept: 'audio/*' },
    { value: 'text', label: 'Texte', icon: FileText, accept: '' },
];

export default function DayResourcesPage() {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [resources, setResources] = useState<DayResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Add form state
    const [newResource, setNewResource] = useState<Partial<DayResource>>({
        resourceType: 'image',
        title: '',
        description: '',
        content: '',
        url: '',
        isActive: true
    });
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Load resources for selected day
    useEffect(() => {
        loadResources();
    }, [selectedDay]);

    const loadResources = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('day_resources')
                .select('*')
                .eq('day_number', selectedDay)
                .order('sort_order', { ascending: true });

            if (error) throw error;
            setResources(data || []);
        } catch (e) {
            console.error('Error loading resources:', e);
            toast.error('Erreur de chargement des ressources');
        }
        setLoading(false);
    };

    const handleFileUpload = async (file: File): Promise<string | null> => {
        try {
            const ext = file.name.split('.').pop();
            const filename = `day-${selectedDay}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

            const { data, error } = await supabase.storage
                .from('day-resources')
                .upload(filename, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('day-resources')
                .getPublicUrl(filename);

            return publicUrl;
        } catch (e) {
            console.error('Upload error:', e);
            toast.error('Erreur lors du téléchargement');
            return null;
        }
    };

    const handleAddResource = async () => {
        if (!newResource.title?.trim()) {
            toast.error('Le titre est requis');
            return;
        }

        setSaving(true);
        try {
            let url = newResource.url;

            // Upload file if selected
            if (uploadFile) {
                setUploading(true);
                url = await handleFileUpload(uploadFile) || undefined;
                setUploading(false);
                if (!url && newResource.resourceType !== 'text') {
                    throw new Error('Échec du téléchargement');
                }
            }

            const resourceData = {
                day_number: selectedDay,
                resource_type: newResource.resourceType,
                title: newResource.title.trim(),
                description: newResource.description?.trim() || null,
                url: url || null,
                content: newResource.resourceType === 'text' ? newResource.content : null,
                sort_order: resources.length,
                is_active: newResource.isActive ?? true
            };

            const { error } = await supabase
                .from('day_resources')
                .insert(resourceData);

            if (error) throw error;

            toast.success('Ressource ajoutée!');
            setIsAddDialogOpen(false);
            resetForm();
            loadResources();
        } catch (e: any) {
            console.error('Error adding resource:', e);
            toast.error(e.message || 'Erreur lors de l\'ajout');
        }
        setSaving(false);
    };

    const handleDeleteResource = async (id: string) => {
        if (!confirm('Supprimer cette ressource?')) return;

        try {
            const { error } = await supabase
                .from('day_resources')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Ressource supprimée');
            loadResources();
        } catch (e) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            const { error } = await supabase
                .from('day_resources')
                .update({ is_active: !isActive })
                .eq('id', id);

            if (error) throw error;
            loadResources();
        } catch (e) {
            toast.error('Erreur de mise à jour');
        }
    };

    const resetForm = () => {
        setNewResource({
            resourceType: 'image',
            title: '',
            description: '',
            content: '',
            url: '',
            isActive: true
        });
        setUploadFile(null);
    };

    const getResourceIcon = (type: ResourceType) => {
        const config = RESOURCE_TYPES.find(r => r.value === type);
        const Icon = config?.icon || File;
        return <Icon className="h-5 w-5" />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0B0E14] to-[#0F1219] text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin">
                                <Button variant="ghost" size="icon">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">Ressources Journalières</h1>
                                <p className="text-sm text-slate-500">Gérez les médias pour chaque jour</p>
                            </div>
                        </div>

                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-500 rounded-xl">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Ajouter
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-lg rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Ajouter une ressource - Jour {selectedDay}</DialogTitle>
                                </DialogHeader>

                                <div className="space-y-6 pt-4">
                                    {/* Resource Type */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Type de ressource</label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {RESOURCE_TYPES.map(type => (
                                                <Button
                                                    key={type.value}
                                                    type="button"
                                                    variant="ghost"
                                                    className={cn(
                                                        "flex-col h-16 gap-1 rounded-xl",
                                                        newResource.resourceType === type.value
                                                            ? "bg-indigo-600 text-white"
                                                            : "bg-white/5 text-slate-400"
                                                    )}
                                                    onClick={() => setNewResource(prev => ({ ...prev, resourceType: type.value }))}
                                                >
                                                    <type.icon className="h-5 w-5" />
                                                    <span className="text-[10px] font-bold">{type.label}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Titre</label>
                                        <Input
                                            placeholder="Ex: Image de méditation"
                                            value={newResource.title || ''}
                                            onChange={(e) => setNewResource(prev => ({ ...prev, title: e.target.value }))}
                                            className="bg-white/5 border-white/10 rounded-xl"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Description (optionnel)</label>
                                        <Input
                                            placeholder="Brève description..."
                                            value={newResource.description || ''}
                                            onChange={(e) => setNewResource(prev => ({ ...prev, description: e.target.value }))}
                                            className="bg-white/5 border-white/10 rounded-xl"
                                        />
                                    </div>

                                    {/* Content based on type */}
                                    {newResource.resourceType === 'text' ? (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Contenu texte</label>
                                            <Textarea
                                                placeholder="Entrez le contenu textuel..."
                                                value={newResource.content || ''}
                                                onChange={(e) => setNewResource(prev => ({ ...prev, content: e.target.value }))}
                                                className="min-h-[150px] bg-white/5 border-white/10 rounded-xl"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* File Upload */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase">Télécharger un fichier</label>
                                                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-indigo-500/50 transition-colors">
                                                    <input
                                                        type="file"
                                                        accept={RESOURCE_TYPES.find(r => r.value === newResource.resourceType)?.accept}
                                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                                        className="hidden"
                                                        id="file-upload"
                                                    />
                                                    <label htmlFor="file-upload" className="cursor-pointer">
                                                        {uploadFile ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Check className="h-5 w-5 text-emerald-400" />
                                                                <span className="text-sm text-white">{uploadFile.name}</span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setUploadFile(null);
                                                                    }}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                                                                <span className="text-sm text-slate-400">Cliquez pour sélectionner</span>
                                                            </>
                                                        )}
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Or URL */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase">Ou URL externe</label>
                                                <Input
                                                    placeholder="https://..."
                                                    value={newResource.url || ''}
                                                    onChange={(e) => setNewResource(prev => ({ ...prev, url: e.target.value }))}
                                                    className="bg-white/5 border-white/10 rounded-xl"
                                                    disabled={!!uploadFile}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Toggle */}
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                        <div>
                                            <p className="font-medium">Activer immédiatement</p>
                                            <p className="text-xs text-slate-500">La ressource sera visible par les utilisateurs</p>
                                        </div>
                                        <Switch
                                            checked={newResource.isActive}
                                            onCheckedChange={(checked) => setNewResource(prev => ({ ...prev, isActive: checked }))}
                                        />
                                    </div>

                                    {/* Submit */}
                                    <Button
                                        className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                                        onClick={handleAddResource}
                                        disabled={saving || uploading}
                                    >
                                        {saving || uploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                {uploading ? 'Téléchargement...' : 'Enregistrement...'}
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Enregistrer
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Day Selector */}
                <div className="mb-8">
                    <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Sélectionner le jour</label>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                        {Array.from({ length: 40 }, (_, i) => i + 1).map(day => (
                            <Button
                                key={day}
                                variant="ghost"
                                className={cn(
                                    "shrink-0 h-12 w-12 rounded-xl font-bold transition-all",
                                    selectedDay === day
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                                )}
                                onClick={() => setSelectedDay(day)}
                            >
                                {day}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Resources Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    </div>
                ) : resources.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                            <FileText className="h-10 w-10 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400 mb-2">Aucune ressource</h3>
                        <p className="text-slate-500 mb-6">Ajoutez des ressources pour le jour {selectedDay}</p>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-500 rounded-xl"
                            onClick={() => setIsAddDialogOpen(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Ajouter une ressource
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {resources.map((resource, index) => (
                            <Card
                                key={resource.id}
                                className={cn(
                                    "bg-white/5 border-white/5 rounded-2xl overflow-hidden transition-all",
                                    !resource.isActive && "opacity-50"
                                )}
                            >
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Drag Handle */}
                                        <div className="p-2 text-slate-600 cursor-grab">
                                            <GripVertical className="h-5 w-5" />
                                        </div>

                                        {/* Type Icon */}
                                        <div className={cn(
                                            "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                                            resource.resourceType === 'image' && "bg-blue-500/20 text-blue-400",
                                            resource.resourceType === 'video' && "bg-purple-500/20 text-purple-400",
                                            resource.resourceType === 'pdf' && "bg-red-500/20 text-red-400",
                                            resource.resourceType === 'audio' && "bg-emerald-500/20 text-emerald-400",
                                            resource.resourceType === 'text' && "bg-amber-500/20 text-amber-400",
                                        )}>
                                            {getResourceIcon(resource.resourceType)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-white truncate">{resource.title}</h3>
                                                <Badge variant="outline" className="shrink-0 text-[10px] border-white/10">
                                                    {RESOURCE_TYPES.find(r => r.value === resource.resourceType)?.label}
                                                </Badge>
                                            </div>
                                            {resource.description && (
                                                <p className="text-sm text-slate-400 line-clamp-2 mb-2">{resource.description}</p>
                                            )}
                                            {resource.url && (
                                                <a
                                                    href={resource.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                                >
                                                    <LinkIcon className="h-3 w-3" />
                                                    Voir la ressource
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-9 w-9 rounded-xl",
                                                    resource.isActive ? "text-emerald-400" : "text-slate-500"
                                                )}
                                                onClick={() => handleToggleActive(resource.id, resource.isActive)}
                                            >
                                                {resource.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 rounded-xl text-red-400 hover:text-red-300"
                                                onClick={() => handleDeleteResource(resource.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
