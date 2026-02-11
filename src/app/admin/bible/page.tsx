"use client"

import { BibleManager } from "@/components/admin/bible-manager"

export default function AdminBiblePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Gestion de la Bible</h1>
                <p className="text-muted-foreground">
                    La Bible (LSG) est pré-chargée dans l'application via des fichiers locaux (/public/bible).
                    <br />
                    L'upload ci-dessous est optionnel et sert uniquement à surcharger les fichiers par défaut via Supabase Storage.
                </p>
            </div>

            <BibleManager />
        </div>
    )
}
