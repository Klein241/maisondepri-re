// Chat Types — shared across all chat components

export interface ChatUser {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    is_online?: boolean;
    last_seen?: string;
}

export interface Conversation {
    id: string;
    participantId: string;
    participant: ChatUser;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

export interface ChatGroup {
    id: string;
    name: string;
    description: string | null;
    is_urgent: boolean;
    member_count: number;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount: number;
    is_admin_created: boolean;
    prayer_request_id?: string;
    avatar_url?: string | null;
    created_by?: string;
    created_at?: string;
    is_open?: boolean;
}

export interface GroupMember {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    is_online?: boolean;
    role?: string;
}

export interface Message {
    id: string;
    content: string;
    type: 'text' | 'voice' | 'image' | 'file';
    voice_url?: string;
    voice_duration?: number;
    image_url?: string;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    reply_to?: string;
    reply_to_content?: string;
    reply_to_sender?: string;
    reply_to_image_url?: string;
    sender_id: string;
    sender?: ChatUser;
    created_at: string;
    is_read: boolean;
    read_by?: string[];
    comment_count?: number;
    reactions?: Record<string, string>;
}

export interface TypingUser {
    userId: string;
    userName: string;
}

export interface WhatsAppChatProps {
    user: { id: string; name: string; avatar?: string } | null;
    onHideNav?: (hide: boolean) => void;
    activeGroupId?: string | null;
    activeConversationId?: string | null;
}

export interface GameSession {
    startedBy: string;
    startedByName: string;
    groupId: string;
    players: string[];
}
