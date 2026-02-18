// Social Features Service
// =======================
// Handles likes, favorites, sharing, and testimonials

import { supabase } from './supabase';

export interface SocialAction {
    success: boolean;
    liked?: boolean;
    favorited?: boolean;
    count?: number;
    error?: string;
}

export const socialService = {
    // ========================
    // TESTIMONIAL LIKES
    // ========================

    async toggleTestimonialLike(testimonialId: string, userId: string): Promise<SocialAction> {
        try {
            // Try to use the database function first
            const { data, error } = await supabase
                .rpc('toggle_testimonial_like', {
                    testimonial_id: testimonialId,
                    liking_user_id: userId
                });

            if (error) {
                // Fallback: manual update
                const { data: testimonial } = await supabase
                    .from('testimonials')
                    .select('likes, liked_by')
                    .eq('id', testimonialId)
                    .single();

                if (!testimonial) throw new Error('Testimonial not found');

                const likedBy = testimonial.liked_by || [];
                const alreadyLiked = likedBy.includes(userId);

                if (alreadyLiked) {
                    // Remove like
                    await supabase
                        .from('testimonials')
                        .update({
                            likes: Math.max(0, (testimonial.likes || 0) - 1),
                            liked_by: likedBy.filter((id: string) => id !== userId)
                        })
                        .eq('id', testimonialId);

                    return { success: true, liked: false, count: Math.max(0, (testimonial.likes || 0) - 1) };
                } else {
                    // Add like
                    await supabase
                        .from('testimonials')
                        .update({
                            likes: (testimonial.likes || 0) + 1,
                            liked_by: [...likedBy, userId]
                        })
                        .eq('id', testimonialId);

                    return { success: true, liked: true, count: (testimonial.likes || 0) + 1 };
                }
            }

            return { success: true, liked: data === true };
        } catch (e: any) {
            console.error('Error toggling like:', e);
            return { success: false, error: e.message };
        }
    },

    async isTestimonialLiked(testimonialId: string, userId: string): Promise<boolean> {
        try {
            const { data } = await supabase
                .from('testimonials')
                .select('liked_by')
                .eq('id', testimonialId)
                .single();

            return data?.liked_by?.includes(userId) || false;
        } catch {
            return false;
        }
    },

    // ========================
    // PRAYER REQUEST LIKES
    // ========================

    async togglePrayerLike(prayerId: string, userId: string): Promise<SocialAction> {
        try {
            const { data: prayer } = await supabase
                .from('prayer_requests')
                .select('prayer_count, prayed_by')
                .eq('id', prayerId)
                .single();

            if (!prayer) throw new Error('Prayer request not found');

            const prayedBy = prayer.prayed_by || [];
            const alreadyPrayed = prayedBy.includes(userId);

            if (alreadyPrayed) {
                // Remove prayer
                await supabase
                    .from('prayer_requests')
                    .update({
                        prayer_count: Math.max(0, (prayer.prayer_count || 0) - 1),
                        prayed_by: prayedBy.filter((id: string) => id !== userId)
                    })
                    .eq('id', prayerId);

                return { success: true, liked: false, count: Math.max(0, (prayer.prayer_count || 0) - 1) };
            } else {
                // Add prayer
                await supabase
                    .from('prayer_requests')
                    .update({
                        prayer_count: (prayer.prayer_count || 0) + 1,
                        prayed_by: [...prayedBy, userId]
                    })
                    .eq('id', prayerId);

                return { success: true, liked: true, count: (prayer.prayer_count || 0) + 1 };
            }
        } catch (e: any) {
            console.error('Error toggling prayer:', e);
            return { success: false, error: e.message };
        }
    },

    // ========================
    // FAVORITES
    // ========================

    async addFavorite(userId: string, itemType: string, itemId: string, itemData?: any): Promise<SocialAction> {
        try {
            const { error } = await supabase
                .from('favorites')
                .insert({
                    user_id: userId,
                    item_type: itemType,
                    item_id: itemId,
                    item_data: itemData || null
                });

            if (error) {
                if (error.message.includes('duplicate')) {
                    return { success: true, favorited: true }; // Already favorited
                }
                throw error;
            }

            return { success: true, favorited: true };
        } catch (e: any) {
            console.error('Error adding favorite:', e);
            return { success: false, error: e.message };
        }
    },

    async removeFavorite(userId: string, itemType: string, itemId: string): Promise<SocialAction> {
        try {
            const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', userId)
                .eq('item_type', itemType)
                .eq('item_id', itemId);

            if (error) throw error;
            return { success: true, favorited: false };
        } catch (e: any) {
            console.error('Error removing favorite:', e);
            return { success: false, error: e.message };
        }
    },

    async toggleFavorite(userId: string, itemType: string, itemId: string, itemData?: any): Promise<SocialAction> {
        const isFav = await this.isFavorited(userId, itemType, itemId);

        if (isFav) {
            return this.removeFavorite(userId, itemType, itemId);
        } else {
            return this.addFavorite(userId, itemType, itemId, itemData);
        }
    },

    async isFavorited(userId: string, itemType: string, itemId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('favorites')
                .select('id')
                .eq('user_id', userId)
                .eq('item_type', itemType)
                .eq('item_id', itemId)
                .maybeSingle();

            return !error && !!data;
        } catch {
            return false;
        }
    },

    async getFavorites(userId: string, itemType?: string) {
        try {
            let query = supabase
                .from('favorites')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (itemType) {
                query = query.eq('item_type', itemType);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Error fetching favorites:', e);
            return [];
        }
    },

    // ========================
    // TESTIMONIALS
    // ========================

    async createTestimonial(userId: string, content: string, photoUrl?: string, photos?: string[]): Promise<SocialAction> {
        try {
            const { error } = await supabase
                .from('testimonials')
                .insert({
                    user_id: userId,
                    content: content,
                    photo_url: photoUrl || null,
                    photos: photos || [],
                    is_approved: false,
                    likes: 0,
                    liked_by: []
                });

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('Error creating testimonial:', e);
            return { success: false, error: e.message };
        }
    },

    async getTestimonials(approvedOnly: boolean = true) {
        try {
            let query = supabase
                .from('testimonials')
                .select(`
                    *,
                    profiles:user_id (full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (approvedOnly) {
                query = query.eq('is_approved', true);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data?.map(t => ({
                id: t.id,
                userId: t.user_id,
                userName: t.profiles?.full_name || 'Anonyme',
                userAvatar: t.profiles?.avatar_url,
                content: t.content,
                photoUrl: t.photo_url,
                photos: t.photos || [],
                likes: t.likes || 0,
                likedBy: t.liked_by || [],
                isApproved: t.is_approved,
                createdAt: t.created_at
            })) || [];
        } catch (e) {
            console.error('Error fetching testimonials:', e);
            return [];
        }
    },

    // ========================
    // PRAYER REQUESTS
    // ========================

    async createPrayerRequest(
        userId: string,
        content: string,
        category: string = 'other',
        isAnonymous: boolean = false,
        photos?: string[]
    ): Promise<SocialAction> {
        try {
            const { error } = await supabase
                .from('prayer_requests')
                .insert({
                    user_id: userId,
                    content: content,
                    category: category,
                    is_anonymous: isAnonymous,
                    photos: photos || [],
                    prayer_count: 0,
                    prayed_by: []
                });

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('Error creating prayer request:', e);
            return { success: false, error: e.message };
        }
    },

    async getPrayerRequests(category?: string) {
        try {
            let query = supabase
                .from('prayer_requests')
                .select(`
                    *,
                    profiles:user_id (full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (category && category !== 'all') {
                query = query.eq('category', category);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data?.map(p => ({
                id: p.id,
                userId: p.user_id,
                userName: p.is_anonymous ? 'Anonyme' : (p.profiles?.full_name || 'Utilisateur'),
                userAvatar: p.is_anonymous ? null : p.profiles?.avatar_url,
                content: p.content,
                category: p.category,
                isAnonymous: p.is_anonymous,
                photos: p.photos || [],
                prayerCount: p.prayer_count || 0,
                prayedBy: p.prayed_by || [],
                isAnswered: p.is_answered,
                answeredAt: p.answered_at,
                createdAt: p.created_at
            })) || [];
        } catch (e) {
            console.error('Error fetching prayer requests:', e);
            return [];
        }
    },

    async markPrayerAnswered(prayerId: string): Promise<SocialAction> {
        try {
            const { error } = await supabase
                .from('prayer_requests')
                .update({
                    is_answered: true,
                    answered_at: new Date().toISOString()
                })
                .eq('id', prayerId);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('Error marking prayer answered:', e);
            return { success: false, error: e.message };
        }
    },

    // ========================
    // SHARE FUNCTIONALITY
    // ========================

    async shareContent(type: 'testimony' | 'prayer' | 'verse', content: string, title?: string) {
        // Use Web Share API if available
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title || 'Partagé depuis le Marathon de Prière',
                    text: content,
                    url: window.location.href
                });
                return { success: true };
            } catch (e) {
                // User cancelled or error
                return { success: false };
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(content);
                return { success: true };
            } catch (e) {
                return { success: false };
            }
        }
    },

    // ========================
    // CHAT MESSAGES
    // ========================

    async sendChatMessage(groupId: string | null, userId: string, content: string, isPrayer: boolean = false) {
        try {
            if (groupId) {
                // Group message
                const { error } = await supabase
                    .from('prayer_group_messages')
                    .insert({
                        group_id: groupId,
                        user_id: userId,
                        content: content,
                        is_prayer: isPrayer
                    });
                if (error) throw error;
            } else {
                // Community message (if table exists)
                // First try the community_messages table
                const { error } = await supabase
                    .from('prayer_group_messages')
                    .insert({
                        group_id: null, // Community chat
                        user_id: userId,
                        content: content,
                        is_prayer: isPrayer
                    });
                if (error) throw error;
            }
            return { success: true };
        } catch (e: any) {
            console.error('Error sending message:', e);
            return { success: false, error: e.message };
        }
    },

    async getGroupMessages(groupId: string, limit: number = 50) {
        try {
            // Fetch messages without embedded join (avoids PostgREST FK issues)
            const { data: rawMsgs, error } = await supabase
                .from('prayer_group_messages')
                .select('id, group_id, user_id, content, type, voice_url, voice_duration, created_at, is_pinned')
                .eq('group_id', groupId)
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) throw error;
            const msgs = rawMsgs || [];
            if (msgs.length === 0) return [];

            // Batch fetch profiles
            const uids = [...new Set(msgs.map(m => m.user_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', uids);

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));
            return msgs.map(m => ({
                ...m,
                profiles: profileMap.get(m.user_id) || { full_name: 'Utilisateur', avatar_url: null }
            }));
        } catch (e) {
            console.error('Error fetching messages:', e);
            return [];
        }
    },

    // ========================
    // DIRECT MESSAGES
    // ========================

    async sendDirectMessage(senderId: string, receiverId: string, content: string) {
        try {
            const { error } = await supabase
                .from('direct_messages')
                .insert({
                    sender_id: senderId,
                    receiver_id: receiverId,
                    content: content,
                    is_read: false
                });

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            console.error('Error sending DM:', e);
            return { success: false, error: e.message };
        }
    },

    async getDirectMessages(userId: string, otherUserId: string, limit: number = 50) {
        try {
            const { data, error } = await supabase
                .from('direct_messages')
                .select(`
                    *,
                    sender:sender_id (full_name, avatar_url)
                `)
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Error fetching DMs:', e);
            return [];
        }
    },

    async markMessagesAsRead(userId: string, senderId: string) {
        try {
            const { error } = await supabase
                .from('direct_messages')
                .update({ is_read: true })
                .eq('sender_id', senderId)
                .eq('receiver_id', userId)
                .eq('is_read', false);

            if (error) throw error;
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    async getConversations(userId: string) {
        try {
            // Get all unique users we've messaged with
            const { data: sent } = await supabase
                .from('direct_messages')
                .select('receiver_id')
                .eq('sender_id', userId);

            const { data: received } = await supabase
                .from('direct_messages')
                .select('sender_id')
                .eq('receiver_id', userId);

            const userIds = new Set([
                ...(sent?.map(m => m.receiver_id) || []),
                ...(received?.map(m => m.sender_id) || [])
            ]);

            if (userIds.size === 0) return [];

            // Get user profiles
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', Array.from(userIds));

            return profiles || [];
        } catch (e) {
            console.error('Error fetching conversations:', e);
            return [];
        }
    }
};

export default socialService;
