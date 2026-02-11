'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Upload, Image as ImageIcon, Loader2, Check, Trash2, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface PhotoUploadProps {
    bucket: 'prayer-photos' | 'testimony-photos' | 'day-resources';
    maxPhotos?: number;
    onPhotosChange: (urls: string[]) => void;
    initialPhotos?: string[];
    className?: string;
}

export function PhotoUpload({
    bucket,
    maxPhotos = 3,
    onPhotosChange,
    initialPhotos = [],
    className
}: PhotoUploadProps) {
    const [photos, setPhotos] = useState<string[]>(initialPhotos);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const remainingSlots = maxPhotos - photos.length;
        if (remainingSlots <= 0) {
            toast.error(`Maximum ${maxPhotos} photos autorisées`);
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);
        setUploading(true);

        try {
            const uploadPromises = filesToUpload.map(async (file) => {
                // Validate file
                if (!file.type.startsWith('image/')) {
                    throw new Error('Seules les images sont autorisées');
                }

                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('La taille maximum est de 5MB');
                }

                // Generate unique filename
                const ext = file.name.split('.').pop();
                const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

                // Upload to Supabase Storage
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .upload(filename, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) throw error;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filename);

                return publicUrl;
            });

            const uploadedUrls = await Promise.all(uploadPromises);
            const newPhotos = [...photos, ...uploadedUrls];
            setPhotos(newPhotos);
            onPhotosChange(newPhotos);
            toast.success(`${uploadedUrls.length} photo(s) ajoutée(s)`);

        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Erreur lors du téléchargement');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const removePhoto = async (urlToRemove: string) => {
        try {
            // Extract filename from URL
            const filename = urlToRemove.split('/').pop();

            if (filename) {
                await supabase.storage
                    .from(bucket)
                    .remove([filename]);
            }

            const newPhotos = photos.filter(url => url !== urlToRemove);
            setPhotos(newPhotos);
            onPhotosChange(newPhotos);
            toast.success('Photo supprimée');
        } catch (error) {
            console.error('Error removing photo:', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    return (
        <div className={cn("space-y-3", className)}>
            {/* Photo Grid */}
            {photos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {photos.map((url, index) => (
                        <motion.div
                            key={url}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative group"
                        >
                            <div
                                className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer"
                                onClick={() => setPreviewUrl(url)}
                            >
                                <img
                                    src={url}
                                    alt={`Photo ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Delete overlay */}
                            <motion.button
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center"
                                onClick={() => removePhoto(url)}
                            >
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </motion.button>

                            {/* Zoom icon */}
                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="w-3 h-3" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add Photo Button */}
            {photos.length < maxPhotos && (
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={uploading}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-20 w-20 rounded-2xl bg-white/5 border border-dashed border-white/20 hover:bg-white/10 hover:border-white/30 flex flex-col items-center justify-center gap-1"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                        ) : (
                            <>
                                <Camera className="w-5 h-5 text-slate-400" />
                                <span className="text-[9px] text-slate-500 font-bold uppercase">Ajouter</span>
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Limit info */}
            {photos.length > 0 && (
                <p className="text-[10px] text-slate-500">
                    {photos.length}/{maxPhotos} photos
                </p>
            )}

            {/* Full Preview Modal */}
            <AnimatePresence>
                {previewUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6"
                        onClick={() => setPreviewUrl(null)}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-6 right-6 text-white bg-white/10 rounded-full"
                            onClick={() => setPreviewUrl(null)}
                        >
                            <X className="w-6 h-6" />
                        </Button>
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            src={previewUrl}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain rounded-2xl"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Simpler inline photo display component
interface PhotoGalleryProps {
    photos: string[];
    maxDisplay?: number;
    size?: 'sm' | 'md' | 'lg';
}

export function PhotoGallery({ photos, maxDisplay = 4, size = 'md' }: PhotoGalleryProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    if (!photos || photos.length === 0) return null;

    const sizeClasses = {
        sm: 'w-12 h-12 rounded-lg',
        md: 'w-20 h-20 rounded-xl',
        lg: 'w-32 h-32 rounded-2xl'
    };

    const displayPhotos = photos.slice(0, maxDisplay);
    const remaining = photos.length - maxDisplay;

    return (
        <>
            <div className="flex gap-2 flex-wrap mt-3">
                {displayPhotos.map((url, index) => (
                    <motion.div
                        key={url}
                        className={cn(
                            "relative overflow-hidden bg-white/5 border border-white/10 cursor-pointer group",
                            sizeClasses[size]
                        )}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setPreviewUrl(url)}
                    >
                        <img
                            src={url}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                        />

                        {/* Show remaining count on last visible photo */}
                        {index === displayPhotos.length - 1 && remaining > 0 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white font-bold">+{remaining}</span>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6"
                        onClick={() => setPreviewUrl(null)}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-6 right-6 text-white bg-white/10 rounded-full z-10"
                            onClick={() => setPreviewUrl(null)}
                        >
                            <X className="w-6 h-6" />
                        </Button>

                        {/* Photo carousel */}
                        <div className="flex gap-4 items-center">
                            {photos.map((url, i) => (
                                <motion.img
                                    key={url}
                                    initial={{ scale: url === previewUrl ? 1 : 0.8, opacity: url === previewUrl ? 1 : 0.3 }}
                                    animate={{ scale: url === previewUrl ? 1 : 0.8, opacity: url === previewUrl ? 1 : 0.3 }}
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    className={cn(
                                        "max-h-[70vh] object-contain rounded-2xl cursor-pointer transition-all",
                                        url === previewUrl ? "w-auto" : "w-20 hidden md:block"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewUrl(url);
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
