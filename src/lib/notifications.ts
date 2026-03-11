import { supabase } from './supabase';

/**
 * ══════════════════════════════════════════════════════════
 * NOTIFICATION CLIENT — Maison de Prière v2
 * ══════════════════════════════════════════════════════════
 *
 * All notification functions now route through the Cloudflare
 * Notification Worker for aggregation, rate-limiting, and push.
 *
 * Fallback: If WORKER_URL is not set, inserts directly into
 * Supabase (legacy behavior).
 */

// ── Types ────────────────────────────────────────────────

export type NotificationActionType =
    | 'prayer_prayed'
    | 'friend_prayed'
    | 'new_prayer_published'
    | 'prayer_comment'
    | 'prayer_no_response'
    | 'group_access_request'
    | 'group_access_approved'
    | 'group_new_message'
    | 'admin_new_group'
    | 'group_invitation'
    | 'group_mention'
    | 'dm_new_message'
    | 'friend_request_received'
    | 'friend_request_accepted'
    | 'general';

export interface NotificationActionData {
    tab?: string;
    viewState?: string;
    groupId?: string;
    groupName?: string;
    prayerId?: string;
    conversationId?: string;
    communityTab?: string;
    scrollToComments?: boolean;
    scrollToMessage?: string;
}

interface NotifyWorkerPayload {
    action_type: NotificationActionType;
    actor_id: string;
    actor_name: string;
    actor_avatar?: string;
    recipient_id?: string;
    recipient_ids?: string[];
    target_id?: string;
    target_name?: string;
    is_anonymous?: boolean;
    message_preview?: string;
    extra_data?: Record<string, any>;
}

// ── Worker URL ───────────────────────────────────────────

function getWorkerUrl(): string {
    // Priority: env var > app_settings from store (loaded at runtime)
    if (typeof window !== 'undefined') {
        // Client-side: check env var
        const envUrl = process.env.NEXT_PUBLIC_NOTIFICATION_WORKER_URL
            || process.env.NEXT_PUBLIC_WORKER_URL;
        if (envUrl) return envUrl;
    }
    return '';
}

// ── Core: Send to Worker or Supabase Fallback ────────────

async function sendToWorker(payload: NotifyWorkerPayload): Promise<boolean> {
    const workerUrl = getWorkerUrl();

    if (workerUrl) {
        try {
            const res = await fetch(`${workerUrl}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) return true;
            console.warn('[Notification] Worker returned error, falling back to Supabase');
        } catch (e) {
            console.warn('[Notification] Worker unreachable, falling back to Supabase:', e);
        }
    }

    // Fallback: direct Supabase insert (no aggregation, no push)
    return sendFallback(payload);
}

async function sendFallback(payload: NotifyWorkerPayload): Promise<boolean> {
    const recipientIds = payload.recipient_ids || (payload.recipient_id ? [payload.recipient_id] : []);
    if (recipientIds.length === 0) return false;

    const actionData = buildFallbackActionData(payload);
    const { title, message } = buildFallbackMessage(payload);

    const notifications = recipientIds
        .filter(id => id !== payload.actor_id)
        .map(userId => ({
            user_id: userId,
            title,
            message,
            type: mapActionTypeToLegacyType(payload.action_type),
            action_type: payload.action_type,
            action_data: JSON.stringify(actionData),
            is_read: false,
        }));

    if (notifications.length === 0) return true;

    // Batch insert (50 at a time)
    for (let i = 0; i < notifications.length; i += 50) {
        const batch = notifications.slice(i, i + 50);
        const { error } = await supabase.from('notifications').insert(batch);
        if (error) {
            console.error('[Notification] Supabase fallback insert error:', error);
            return false;
        }
    }
    return true;
}

function mapActionTypeToLegacyType(actionType: NotificationActionType): string {
    switch (actionType) {
        case 'prayer_prayed':
        case 'friend_prayed':
        case 'new_prayer_published':
        case 'prayer_comment':
        case 'prayer_no_response':
            return 'prayer';
        case 'dm_new_message':
        case 'group_new_message':
        case 'group_mention':
            return 'message';
        case 'group_access_approved':
            return 'success';
        case 'friend_request_received':
        case 'friend_request_accepted':
            return 'info';
        default:
            return 'info';
    }
}

function buildFallbackActionData(payload: NotifyWorkerPayload): NotificationActionData {
    const actionType = payload.action_type;
    switch (actionType) {
        case 'prayer_prayed':
        case 'friend_prayed':
        case 'new_prayer_published':
        case 'prayer_comment':
        case 'prayer_no_response':
            return { tab: 'community', communityTab: 'prieres', prayerId: payload.target_id };
        case 'group_access_request':
            return { tab: 'community', viewState: 'group-detail', groupId: payload.target_id, groupName: payload.target_name };
        case 'group_access_approved':
        case 'group_new_message':
            return { tab: 'community', viewState: 'group-detail', groupId: payload.target_id, groupName: payload.target_name, communityTab: 'chat' };
        case 'admin_new_group':
            return { tab: 'community', viewState: 'groups' };
        case 'group_invitation':
            return { tab: 'community', viewState: 'group-detail', groupId: payload.target_id, groupName: payload.target_name };
        case 'group_mention':
            return { tab: 'community', viewState: 'group-detail', groupId: payload.target_id, communityTab: 'chat' };
        case 'dm_new_message':
            return { tab: 'community', communityTab: 'chat', viewState: 'conversation', conversationId: payload.target_id };
        case 'friend_request_received':
            return { tab: 'profil', viewState: 'friend-requests' };
        case 'friend_request_accepted':
            return { tab: 'community', communityTab: 'chat', viewState: 'conversation', conversationId: payload.extra_data?.conversationId };
        default:
            return { tab: 'community' };
    }
}

function buildFallbackMessage(payload: NotifyWorkerPayload): { title: string; message: string } {
    const name = payload.is_anonymous ? 'Anonyme' : payload.actor_name;
    const short = (s?: string, len = 60) => s ? (s.length > len ? s.substring(0, len) + '…' : s) : '';

    switch (payload.action_type) {
        case 'prayer_prayed':
            return { title: '🙏 Quelqu\'un a prié pour vous', message: `${name} a prié pour votre demande : "${short(payload.target_name)}"` };
        case 'friend_prayed':
            return { title: '🙏 Votre ami a prié', message: `Votre ami ${name} a aussi prié pour ce sujet` };
        case 'new_prayer_published':
            return { title: '📢 Nouvelle demande de prière', message: `${name} a publié : "${short(payload.target_name)}"` };
        case 'prayer_comment':
            return { title: '💬 Nouveau commentaire', message: `${name} a commenté votre demande de prière` };
        case 'prayer_no_response':
            return { title: '🕊️ Votre demande attend', message: 'Votre demande n\'a pas encore reçu de prière. La communauté est là.' };
        case 'group_access_request':
            return { title: '👥 Nouvelle demande d\'accès', message: `${name} souhaite rejoindre votre groupe "${payload.target_name}"` };
        case 'group_access_approved':
            return { title: '✅ Demande approuvée', message: `Votre demande d'accès au groupe "${payload.target_name}" a été approuvée !` };
        case 'group_new_message':
            return { title: `💬 ${payload.target_name}`, message: `${name}: ${short(payload.message_preview, 80)}` };
        case 'admin_new_group':
            return { title: '🌟 Nouveau groupe officiel', message: `Nouveau groupe officiel : ${payload.target_name}` };
        case 'group_invitation':
            return { title: '👥 Invitation à un groupe', message: `${name} vous invite à rejoindre "${payload.target_name}"` };
        case 'group_mention':
            return { title: '🔔 Mention dans un groupe', message: `${name} vous a mentionné dans ${payload.target_name}` };
        case 'dm_new_message':
            return { title: `💬 ${name}`, message: short(payload.message_preview, 80) };
        case 'friend_request_received':
            return { title: '👋 Demande d\'ami', message: `${name} vous a envoyé une demande d'ami` };
        case 'friend_request_accepted':
            return { title: '👋 Ami ajouté !', message: `${name} a accepté votre demande d'ami` };
        default:
            return { title: 'Notification', message: payload.message_preview || 'Nouvelle notification' };
    }
}

// ══════════════════════════════════════════════════════════
// 🙏 PRAYER NOTIFICATIONS
// ══════════════════════════════════════════════════════════

/** [A] prayer_prayed — Someone prayed for your request */
export async function notifyPrayerPrayed({
    prayerOwnerId,
    prayerContent,
    prayerUserName,
    prayerId,
    actorId,
    actorAvatar,
}: {
    prayerOwnerId: string;
    prayerContent: string;
    prayerUserName: string;
    prayerId: string;
    actorId: string;
    actorAvatar?: string;
}) {
    await sendToWorker({
        action_type: 'prayer_prayed',
        actor_id: actorId,
        actor_name: prayerUserName,
        actor_avatar: actorAvatar,
        recipient_id: prayerOwnerId,
        target_id: prayerId,
        target_name: prayerContent.substring(0, 60),
    });
}

/** [B] friend_prayed — Your friend prayed for any request */
export async function notifyFriendPrayed({
    userId,
    userName,
    prayerContent,
    prayerId,
    actorAvatar,
}: {
    userId: string;
    userName: string;
    prayerContent: string;
    prayerId: string;
    actorAvatar?: string;
}) {
    try {
        const { data: friendships } = await supabase
            .from('friendships')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .eq('status', 'accepted');

        if (!friendships || friendships.length === 0) return;

        const friendIds = friendships.map(f =>
            f.sender_id === userId ? f.receiver_id : f.sender_id
        );

        await sendToWorker({
            action_type: 'friend_prayed',
            actor_id: userId,
            actor_name: userName,
            actor_avatar: actorAvatar,
            recipient_ids: friendIds,
            target_id: prayerId,
            target_name: prayerContent.substring(0, 50),
        });
    } catch (e) {
        console.error('[Notification] Friend prayed error:', e);
    }
}

/** [C] new_prayer_published — New prayer request broadcast */
export async function notifyNewPrayer({
    excludeUserId,
    prayerContent,
    userName,
    prayerId,
    isAnonymous,
}: {
    excludeUserId: string;
    prayerContent: string;
    userName: string;
    prayerId: string;
    isAnonymous: boolean;
}) {
    try {
        const { data: users } = await supabase
            .from('profiles')
            .select('id')
            .neq('id', excludeUserId)
            .limit(200);

        if (users && users.length > 0) {
            const recipientIds = users.map((u: any) => u.id);

            await sendToWorker({
                action_type: 'new_prayer_published',
                actor_id: excludeUserId,
                actor_name: isAnonymous ? 'Anonyme' : userName,
                is_anonymous: isAnonymous,
                recipient_ids: recipientIds,
                target_id: prayerId,
                target_name: prayerContent.substring(0, 60),
            });
        }
    } catch (e) {
        console.error('[Notification] New prayer error:', e);
    }
}

/** [D] prayer_comment — Someone commented on your prayer (NEW) */
export async function notifyPrayerComment({
    prayerId,
    prayerOwnerId,
    commenterId,
    commenterName,
    commenterAvatar,
    commentPreview,
}: {
    prayerId: string;
    prayerOwnerId: string;
    commenterId: string;
    commenterName: string;
    commenterAvatar?: string;
    commentPreview?: string;
}) {
    try {
        // Get all unique commenters (to notify them too)
        const { data: commenters } = await supabase
            .from('prayer_comments')
            .select('user_id')
            .eq('prayer_id', prayerId)
            .neq('user_id', commenterId);

        const recipientIds = new Set<string>();
        recipientIds.add(prayerOwnerId); // Always notify owner
        if (commenters) {
            commenters.forEach((c: any) => recipientIds.add(c.user_id));
        }
        recipientIds.delete(commenterId); // Don't notify self

        if (recipientIds.size === 0) return;

        await sendToWorker({
            action_type: 'prayer_comment',
            actor_id: commenterId,
            actor_name: commenterName,
            actor_avatar: commenterAvatar,
            recipient_ids: Array.from(recipientIds),
            target_id: prayerId,
            message_preview: commentPreview,
        });
    } catch (e) {
        console.error('[Notification] Prayer comment error:', e);
    }
}

// Note: [E] prayer_no_response is handled by the Cloudflare Worker Cron trigger

// ══════════════════════════════════════════════════════════
// 👥 GROUP NOTIFICATIONS
// ══════════════════════════════════════════════════════════

/** [F] group_access_request — User requests to join group */
export async function notifyGroupAccessRequest({
    groupOwnerId,
    groupId,
    groupName,
    requesterName,
    requesterId,
    requesterAvatar,
}: {
    groupOwnerId: string;
    groupId: string;
    groupName: string;
    requesterName: string;
    requesterId: string;
    requesterAvatar?: string;
}) {
    await sendToWorker({
        action_type: 'group_access_request',
        actor_id: requesterId,
        actor_name: requesterName,
        actor_avatar: requesterAvatar,
        recipient_id: groupOwnerId,
        target_id: groupId,
        target_name: groupName,
    });
}

/** [G] group_access_approved — Join request approved */
export async function notifyGroupAccessApproved({
    userId,
    groupId,
    groupName,
}: {
    userId: string;
    groupId: string;
    groupName: string;
}) {
    await sendToWorker({
        action_type: 'group_access_approved',
        actor_id: 'system',
        actor_name: 'Système',
        recipient_id: userId,
        target_id: groupId,
        target_name: groupName,
    });
}

/** [H] group_new_message — New message in group */
export async function notifyGroupNewMessage({
    groupId,
    groupName,
    senderId,
    senderName,
    senderAvatar,
    messagePreview,
}: {
    groupId: string;
    groupName: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    messagePreview: string;
}) {
    try {
        const { data: members } = await supabase
            .from('prayer_group_members')
            .select('user_id')
            .eq('group_id', groupId)
            .neq('user_id', senderId);

        if (!members || members.length === 0) return;

        const recipientIds = members.map((m: any) => m.user_id);

        await sendToWorker({
            action_type: 'group_new_message',
            actor_id: senderId,
            actor_name: senderName,
            actor_avatar: senderAvatar,
            recipient_ids: recipientIds,
            target_id: groupId,
            target_name: groupName,
            message_preview: messagePreview.substring(0, 80),
        });
    } catch (e) {
        console.error('[Notification] Group message error:', e);
    }
}

/** [I] admin_new_group — Admin created official group */
export async function notifyAdminNewGroup({
    groupId,
    groupName,
    excludeUserId,
}: {
    groupId: string;
    groupName: string;
    excludeUserId: string;
}) {
    try {
        const { data: users } = await supabase
            .from('profiles')
            .select('id')
            .neq('id', excludeUserId)
            .limit(200);

        if (users && users.length > 0) {
            await sendToWorker({
                action_type: 'admin_new_group',
                actor_id: excludeUserId,
                actor_name: 'Administrateur',
                recipient_ids: users.map((u: any) => u.id),
                target_id: groupId,
                target_name: groupName,
            });
        }
    } catch (e) {
        console.error('[Notification] Admin group error:', e);
    }
}

/** [J] group_invitation — User invited to a group */
export async function notifyGroupInvitation({
    userId,
    inviterName,
    inviterId,
    inviterAvatar,
    groupId,
    groupName,
}: {
    userId: string;
    inviterName: string;
    inviterId: string;
    inviterAvatar?: string;
    groupId: string;
    groupName: string;
}) {
    await sendToWorker({
        action_type: 'group_invitation',
        actor_id: inviterId,
        actor_name: inviterName,
        actor_avatar: inviterAvatar,
        recipient_id: userId,
        target_id: groupId,
        target_name: groupName,
    });
}

/** [K] group_mention — @mention in group chat (NEW) */
export async function notifyGroupMention({
    mentionedUserId,
    mentionerName,
    mentionerId,
    mentionerAvatar,
    groupId,
    groupName,
    messagePreview,
    messageId,
}: {
    mentionedUserId: string;
    mentionerName: string;
    mentionerId: string;
    mentionerAvatar?: string;
    groupId: string;
    groupName: string;
    messagePreview: string;
    messageId?: string;
}) {
    await sendToWorker({
        action_type: 'group_mention',
        actor_id: mentionerId,
        actor_name: mentionerName,
        actor_avatar: mentionerAvatar,
        recipient_id: mentionedUserId,
        target_id: groupId,
        target_name: groupName,
        message_preview: messagePreview,
        extra_data: { messageId },
    });
}

// ══════════════════════════════════════════════════════════
// 💬 SOCIAL & MESSAGING NOTIFICATIONS
// ══════════════════════════════════════════════════════════

/** [L] dm_new_message — New direct message */
export async function notifyDirectMessage({
    recipientId,
    senderId,
    senderName,
    senderAvatar,
    messagePreview,
    conversationId,
}: {
    recipientId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    messagePreview: string;
    conversationId: string;
}) {
    if (recipientId === senderId) return;

    await sendToWorker({
        action_type: 'dm_new_message',
        actor_id: senderId,
        actor_name: senderName,
        actor_avatar: senderAvatar,
        recipient_id: recipientId,
        target_id: conversationId,
        message_preview: messagePreview,
    });
}

/** [M] friend_request_received — Someone sent you a friend request (NEW) */
export async function notifyFriendRequestReceived({
    recipientId,
    senderId,
    senderName,
    senderAvatar,
}: {
    recipientId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
}) {
    await sendToWorker({
        action_type: 'friend_request_received',
        actor_id: senderId,
        actor_name: senderName,
        actor_avatar: senderAvatar,
        recipient_id: recipientId,
    });
}

/** [N] friend_request_accepted — Your friend request was accepted */
export async function notifyFriendRequestAccepted({
    userId,
    accepterId,
    accepterName,
    accepterAvatar,
}: {
    userId: string;
    accepterId: string;
    accepterName: string;
    accepterAvatar?: string;
}) {
    // Try to find existing conversation for deep-link
    let conversationId: string | undefined;
    try {
        const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant1_id.eq.${userId},participant2_id.eq.${accepterId}),and(participant1_id.eq.${accepterId},participant2_id.eq.${userId})`)
            .maybeSingle();
        if (conv) conversationId = conv.id;
    } catch (e) { /* ignore */ }

    await sendToWorker({
        action_type: 'friend_request_accepted',
        actor_id: accepterId,
        actor_name: accepterName,
        actor_avatar: accepterAvatar,
        recipient_id: userId,
        extra_data: { conversationId },
    });
}

// ══════════════════════════════════════════════════════════
// LEGACY: sendNotification (backward-compatible wrapper)
// ══════════════════════════════════════════════════════════

/**
 * @deprecated Use specific notification functions instead.
 * Kept for backward compatibility.
 */
export async function sendNotification({
    userId,
    title,
    message,
    type = 'info',
    actionType = 'general',
    actionData,
}: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    actionType?: NotificationActionType;
    actionData?: NotificationActionData;
}) {
    try {
        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            title,
            message,
            type,
            action_type: actionType,
            action_data: actionData ? JSON.stringify(actionData) : null,
            is_read: false,
        });
        if (error) console.error('[Notification] Insert error:', error);
    } catch (e) {
        console.error('[Notification] Send error:', e);
    }
}

/**
 * @deprecated Use notifyGroupNewMessage instead.
 */
export async function notifyGroupMembers({
    groupId,
    groupName,
    excludeUserId,
    title,
    message,
    type = 'message',
    actionType,
    actionData,
}: {
    groupId: string;
    groupName: string;
    excludeUserId: string;
    title: string;
    message: string;
    type?: string;
    actionType: NotificationActionType;
    actionData?: NotificationActionData;
}) {
    try {
        const { data: members } = await supabase
            .from('prayer_group_members')
            .select('user_id')
            .eq('group_id', groupId)
            .neq('user_id', excludeUserId);

        if (members && members.length > 0) {
            const notifications = members.map((m: any) => ({
                user_id: m.user_id,
                title,
                message,
                type,
                action_type: actionType,
                action_data: JSON.stringify(actionData || {
                    tab: 'community',
                    viewState: 'group-detail',
                    groupId,
                    groupName,
                }),
                is_read: false,
            }));
            await supabase.from('notifications').insert(notifications);
        }
    } catch (e) {
        console.error('[Notification] Group notify error:', e);
    }
}
