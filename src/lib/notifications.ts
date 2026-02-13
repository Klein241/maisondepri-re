import { supabase } from './supabase';

/**
 * Notification action types for deep-link navigation
 */
export type NotificationActionType =
    | 'group_access_request'    // New join request in your group
    | 'group_access_approved'   // Your join request was approved
    | 'prayer_prayed'           // Someone prayed for your prayer
    | 'friend_prayed'           // Your friend prayed for a topic
    | 'new_prayer_published'    // New prayer request published
    | 'group_new_message'       // New message in your group
    | 'admin_new_group'         // Admin created a new official group
    | 'general';

export interface NotificationActionData {
    /** Navigate to this tab */
    tab?: string;
    /** Set this viewState in CommunityView */
    viewState?: string;
    /** Group ID to open */
    groupId?: string;
    /** Group name for display */
    groupName?: string;
    /** Prayer request ID */
    prayerId?: string;
    /** Conversation ID for DMs */
    conversationId?: string;
    /** Community sub-tab (prieres, temoignages, chat) */
    communityTab?: string;
}

/**
 * Send a notification to a specific user.
 * This inserts a row into the `notifications` table which triggers
 * the real-time subscription in NotificationListener.
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
        if (error) {
            console.error('[Notification] Insert error:', error);
        }
    } catch (e) {
        console.error('[Notification] Send error:', e);
    }
}

/**
 * Send notification to all members of a group (excluding sender)
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

/**
 * Notify the prayer request owner that someone prayed for them
 */
export async function notifyPrayerPrayed({
    prayerOwnerId,
    prayerContent,
    prayerUserName,
    prayerId,
}: {
    prayerOwnerId: string;
    prayerContent: string;
    prayerUserName: string;
    prayerId: string;
}) {
    const shortContent = prayerContent.substring(0, 60) + (prayerContent.length > 60 ? '...' : '');
    await sendNotification({
        userId: prayerOwnerId,
        title: '🙏 Quelqu\'un a prié pour vous',
        message: `${prayerUserName} a prié pour votre demande : "${shortContent}"`,
        type: 'prayer',
        actionType: 'prayer_prayed',
        actionData: {
            tab: 'community',
            communityTab: 'prieres',
            prayerId,
        },
    });
}

/**
 * Notify all users of a new prayer request
 */
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
        // Get all users except the poster (limit to avoid spam on large user base)
        const { data: users } = await supabase
            .from('profiles')
            .select('id')
            .neq('id', excludeUserId)
            .limit(200);

        if (users && users.length > 0) {
            const shortContent = prayerContent.substring(0, 60) + (prayerContent.length > 60 ? '...' : '');
            const displayName = isAnonymous ? 'Anonyme' : userName;
            const notifications = users.map((u: any) => ({
                user_id: u.id,
                title: '📢 Nouvelle demande de prière',
                message: `${displayName} a publié : "${shortContent}"`,
                type: 'prayer',
                action_type: 'new_prayer_published',
                action_data: JSON.stringify({
                    tab: 'community',
                    communityTab: 'prieres',
                    prayerId,
                }),
                is_read: false,
            }));

            // Insert in batches of 50 to avoid timeout
            for (let i = 0; i < notifications.length; i += 50) {
                await supabase.from('notifications').insert(notifications.slice(i, i + 50));
            }
        }
    } catch (e) {
        console.error('[Notification] New prayer notify error:', e);
    }
}

/**
 * Notify group owner of a new join request
 */
export async function notifyGroupAccessRequest({
    groupOwnerId,
    groupId,
    groupName,
    requesterName,
}: {
    groupOwnerId: string;
    groupId: string;
    groupName: string;
    requesterName: string;
}) {
    await sendNotification({
        userId: groupOwnerId,
        title: '👥 Nouvelle demande d\'accès',
        message: `${requesterName} souhaite rejoindre votre groupe "${groupName}"`,
        type: 'info',
        actionType: 'group_access_request',
        actionData: {
            tab: 'community',
            viewState: 'group-detail',
            groupId,
            groupName,
        },
    });
}

/**
 * Notify user that their group access request was approved
 */
export async function notifyGroupAccessApproved({
    userId,
    groupId,
    groupName,
}: {
    userId: string;
    groupId: string;
    groupName: string;
}) {
    await sendNotification({
        userId,
        title: '✅ Demande approuvée',
        message: `Votre demande d'accès au groupe "${groupName}" a été approuvée !`,
        type: 'success',
        actionType: 'group_access_approved',
        actionData: {
            tab: 'community',
            viewState: 'group-detail',
            groupId,
            groupName,
        },
    });
}

/**
 * Notify group members of a new message
 */
export async function notifyGroupNewMessage({
    groupId,
    groupName,
    senderId,
    senderName,
    messagePreview,
}: {
    groupId: string;
    groupName: string;
    senderId: string;
    senderName: string;
    messagePreview: string;
}) {
    await notifyGroupMembers({
        groupId,
        groupName,
        excludeUserId: senderId,
        title: `💬 Nouveau message dans ${groupName}`,
        message: `${senderName}: ${messagePreview.substring(0, 80)}`,
        type: 'message',
        actionType: 'group_new_message',
        actionData: {
            tab: 'community',
            viewState: 'group-detail',
            groupId,
            groupName,
        },
    });
}

/**
 * Notify all users of a new admin-created official group
 */
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
            const notifications = users.map((u: any) => ({
                user_id: u.id,
                title: '🌟 Nouveau groupe officiel',
                message: `L'administrateur a publié un nouveau groupe : "${groupName}"`,
                type: 'info',
                action_type: 'admin_new_group',
                action_data: JSON.stringify({
                    tab: 'community',
                    viewState: 'groups',
                }),
                is_read: false,
            }));

            for (let i = 0; i < notifications.length; i += 50) {
                await supabase.from('notifications').insert(notifications.slice(i, i + 50));
            }
        }
    } catch (e) {
        console.error('[Notification] Admin group notify error:', e);
    }
}
