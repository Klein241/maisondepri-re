"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { Loader2 } from "lucide-react"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [isLoading, setIsLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const router = useRouter()

    useEffect(() => {
        async function checkAdmin() {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    router.replace("/")
                    return
                }

                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single()

                if (error || profile?.role !== "admin") {
                    console.error("Access denied:", error || "Not an admin")
                    router.replace("/")
                    return
                }

                setIsAdmin(true)
            } catch (e) {
                console.error("Admin check failed", e)
                router.replace("/")
            } finally {
                setIsLoading(false)
            }
        }

        checkAdmin()
    }, [router])

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!isAdmin) {
        return null // Will redirect
    }

    return (
        <div className="flex min-h-screen bg-muted/20">
            {/* Sidebar - hidden on mobile, shown via Sheet */}
            <AdminSidebar />

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden w-full">
                <AdminHeader />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-16 md:pt-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
