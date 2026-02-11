"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    LayoutDashboard,
    Users,
    BookOpen,
    Settings,
    ShieldCheck,
    MessageSquare,
    Bell,
    LogOut,
    Sparkles,
    Menu,
    X,
    Radio,
    Share2,
    Book,
    Heart,
    UsersRound,
    FolderOpen,
    Eye
} from "lucide-react"

const sidebarItems = [
    {
        title: "Tableau de Bord",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        title: "Utilisateurs",
        href: "/admin/users",
        icon: Users,
    },
    {
        title: "Programme",
        href: "/admin/content",
        icon: BookOpen,
    },
    {
        title: "Bible",
        href: "/admin/bible",
        icon: Book,
    },
    {
        title: "Groupes de Prière",
        href: "/admin/groups",
        icon: UsersRound,
    },
    {
        title: "Prières",
        href: "/admin/prayers",
        icon: Heart,
    },
    {
        title: "Modération",
        href: "/admin/moderation",
        icon: MessageSquare,
    },
    {
        title: "Communications",
        href: "/admin/notifications",
        icon: Bell,
    },
    {
        title: "Live & Réseaux",
        href: "/admin/social",
        icon: Share2,
    },
    {
        title: "Ressources",
        href: "/admin/resources",
        icon: FolderOpen,
    },
    {
        title: "Vues en temps réel",
        href: "/admin/realtime",
        icon: Eye,
    },
    {
        title: "Paramètres",
        href: "/admin/settings",
        icon: Settings,
    },
]

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname()

    return (
        <>
            <div className="p-4 md:p-6">
                <div className="flex items-center gap-2 font-bold text-xl text-primary">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <ShieldCheck className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                    </div>
                    <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Admin</span>
                </div>
            </div>

            <div className="px-3 md:px-4 py-2">
                <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Gestion
                </h4>
                <nav className="space-y-1">
                    {sidebarItems.slice(0, 6).map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive && "text-primary-foreground")} />
                                {item.title}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            <div className="px-3 md:px-4 py-2">
                <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Communauté
                </h4>
                <nav className="space-y-1">
                    {sidebarItems.slice(6, 10).map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive && "text-primary-foreground")} />
                                {item.title}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            <div className="px-3 md:px-4 py-2">
                <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Système
                </h4>
                <nav className="space-y-1">
                    {sidebarItems.slice(10).map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname?.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive && "text-primary-foreground")} />
                                {item.title}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            <div className="mt-auto p-3 md:p-4 border-t bg-card/30">
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg p-3 md:p-4 mb-3 md:mb-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        <span className="text-xs font-semibold text-purple-200">Pro Tips</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Utilisez la modération pour garder un espace sûr et sain.
                    </p>
                </div>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                    <LogOut className="h-4 w-4" />
                    Déconnexion
                </button>
            </div>
        </>
    )
}

export function AdminSidebar() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Mobile Menu Button */}
            <div className="fixed top-4 left-4 z-50 md:hidden">
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="bg-card/80 backdrop-blur-sm border-white/10 shadow-lg"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-0 bg-card/95 backdrop-blur-md border-r border-white/10">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Menu Admin</SheetTitle>
                        </SheetHeader>
                        <div className="flex h-full flex-col">
                            <SidebarContent onLinkClick={() => setIsOpen(false)} />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-sm">
                <SidebarContent />
            </div>
        </>
    )
}
