'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Upload, X, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddTestimonialDialogProps {
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function AddTestimonialDialog({ onSuccess, trigger }: AddTestimonialDialogProps) {
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Veuillez sélectionner une image');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('L\'image ne doit pas dépasser 10MB');
            return;
        }

        setPhotoFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const removePhoto = () => {
        setPhotoFile(null);
        setPhotoPreview(null);
    };

    const uploadPhoto = async (userId: string): Promise<string | null> => {
        if (!photoFile) return null;

        try {
            const ext = photoFile.name.split('.').pop();
            const filename = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

            const { data, error } = await supabase.storage
                .from('testimonial-photos')
                .upload(filename, photoFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('testimonial-photos')
                .getPublicUrl(filename);

            return publicUrl;
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Erreur lors du téléchargement de la photo');
            return null;
        }
    };

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error('Veuillez entrer votre témoignage');
            return;
        }

        setSaving(true);
        setUploading(!!photoFile);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('Vous devez être connecté');
                return;
            }

            // Upload photo if selected
            let photoUrl: string | null = null;
            if (photoFile) {
                photoUrl = await uploadPhoto(user.id);
                if (!photoUrl) {
                    throw new Error('Échec du téléchargement de la photo');
                }
            }

            // Insert testimonial
            const { error } = await supabase
                .from('testimonials')
                .insert({
                    user_id: user.id,
                    content: content.trim(),
                    photo_url: photoUrl,
                    likes: 0,
                    is_approved: false // Requires admin approval
                });

            if (error) throw error;

            toast.success('Témoignage envoyé ! Il sera visible après modération.');
            setOpen(false);
            resetForm();
            onSuccess?.();
        } catch (error: any) {
            console.error('Error submitting testimonial:', error);
            toast.error(error.message || 'Erreur lors de l\'envoi du témoignage');
        } finally {
            setSaving(false);
            setUploading(false);
        }
    };

    const resetForm = () => {
        setContent('');
        setPhotoFile(null);
        setPhotoPreview(null);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl">
                        <Plus className="h-4 w-4 mr-2" />
                        Nouveau témoignage
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="bg-[#0F1219] border-white/10 text-white max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Nouveau témoignage</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Testimonial Content */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">
                            Votre témoignage
                        </label>
                        <Textarea
                            placeholder="Partagez comment Dieu a agi dans votre vie..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[150px] bg-white/5 border-white/10 rounded-xl resize-none"
                            maxLength={1000}
                        />
                        <p className="text-xs text-slate-500 text-right">
                            {content.length}/1000 caractères
                        </p>
                    </div>

                    {/* Photo Upload */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">
                            Photo (optionnel)
                        </label>

                        {photoPreview ? (
                            <div className="relative rounded-xl overflow-hidden border-2 border-white/10">
                                <img
                                    src={photoPreview}
                                    alt="Preview"
                                    className="w-full h-48 object-cover"
                                />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-8 w-8 rounded-full"
                                    onClick={removePhoto}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoSelect}
                                    className="hidden"
                                    id="photo-upload"
                                />
                                <label htmlFor="photo-upload" className="cursor-pointer">
                                    <ImageIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400 mb-1">
                                        Cliquez pour ajouter une photo
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        JPG, PNG ou GIF (max 10MB)
                                    </p>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Info Message */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <p className="text-xs text-blue-400">
                            ℹ️ Votre témoignage sera vérifié par un modérateur avant d'être publié.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <Button
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                        onClick={handleSubmit}
                        disabled={saving || uploading || !content.trim()}
                    >
                        {saving || uploading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {uploading ? 'Téléchargement...' : 'Envoi...'}
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Publier
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
