"use client"

import { Bell } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function AdminHeader() {
    return (
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
            <div>
                <h1 className="text-lg font-semibold">Bienvenue, Admin</h1>
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                </Button>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Administrateur</span>
                    <Avatar>
                        <AvatarImage src="/placeholder-user.svg" />
                        <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                </div>
            </div>
        </header>
    )
}
