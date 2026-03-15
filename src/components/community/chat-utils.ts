// Chat Utilities — pure functions extracted from whatsapp-chat.tsx

export const MEMBER_COLORS = [
    '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
    '#EF4444', '#06B6D4', '#F97316', '#84CC16', '#A855F7',
    '#14B8A6', '#E11D48', '#0EA5E9', '#D946EF', '#22C55E',
];

export function getInitials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function formatTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Hier';
    } else if (diffDays < 7) {
        return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
}

export function getMemberColor(senderId: string): string {
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
        hash = ((hash << 5) - hash) + senderId.charCodeAt(i);
        hash |= 0;
    }
    return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}
