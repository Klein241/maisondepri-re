/**
 * ══════════════════════════════════════════════════════════
 * MAISON DE PRIÈRE — NOTIFICATION WORKER
 * ══════════════════════════════════════════════════════════
 *
 * Advanced notification gateway (Facebook-tier ~70%):
 *  - POST /notify        → receive event, aggregate, insert Supabase + enqueue push
 *  - GET  /notify/count  → unread count from KV (no SQL)
 *  - PATCH /notify/read  → mark one read + decrement KV
 *  - PATCH /notify/read-all → mark all read + reset KV
 *  - GET  /notify/list   → cursor-based pagination (Supabase wrapper)
 *
 *  Queue consumer: batch push via Web Push API (up to 100/req)
 *  Cron trigger:   prayer_no_response reminders (48h without prayer)
 */

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export interface Env {
    // KV
    NOTIFICATION_CACHE: KVNamespace;
    PUSH_TOKEN_CACHE: KVNamespace;
    UNREAD_COUNTERS: KVNamespace;
    USER_PREFERENCES: KVNamespace;
    // R2 Storage (10GB free)
    LIBRARY_BUCKET: R2Bucket;
    // Queue (optional — only if on Workers Paid plan)
    PUSH_QUEUE?: Queue;
    // Secrets
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
    VAPID_PUBLIC_KEY: string;
    VAPID_PRIVATE_KEY: string;
    VAPID_EMAIL: string;
    ADMIN_KEY: string;
    // Vars
    RATE_LIMIT_PUSH_INTERVAL_MS: string;
    RATE_LIMIT_HOURLY_MAX: string;
    BROADCAST_RATE_LIMIT_MS: string;
}

type NotificationActionType =
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
    | 'new_book_published'
    | 'general';

type Priority = 'high' | 'medium' | 'low';

interface NotifyPayload {
    action_type: NotificationActionType;
    actor_id: string;
    actor_name: string;
    actor_avatar?: string;
    recipient_id?: string;       // single recipient
    recipient_ids?: string[];    // broadcast
    target_id?: string;          // prayerId, groupId, conversationId
    target_name?: string;        // group name, prayer preview, etc.
    is_anonymous?: boolean;
    message_preview?: string;
    extra_data?: Record<string, any>;
}

interface AggregationEntry {
    actors: { id: string; name: string; avatar?: string }[];
    count: number;
    first_at: number;
    notification_id?: string;  // Supabase notification ID to update
}

// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════

const AGGREGATION_WINDOWS: Partial<Record<NotificationActionType, number>> = {
    prayer_prayed: 30 * 60,        // 30 min
    friend_prayed: 60 * 60,        // 1h
    prayer_comment: 15 * 60,       // 15 min
    group_access_request: 60 * 60, // 1h
    group_new_message: 5 * 60,     // 5 min
    dm_new_message: 3 * 60,        // 3 min
    group_invitation: 60 * 60,     // 1h
};

const DEFAULT_PREFERENCES: Record<NotificationActionType, { in_app: boolean; push: boolean }> = {
    prayer_prayed: { in_app: true, push: true },
    friend_prayed: { in_app: true, push: false },
    new_prayer_published: { in_app: true, push: false },
    prayer_comment: { in_app: true, push: true },
    prayer_no_response: { in_app: false, push: true },
    group_access_request: { in_app: true, push: true },
    group_access_approved: { in_app: true, push: true },
    group_new_message: { in_app: true, push: true },
    admin_new_group: { in_app: true, push: true },
    group_invitation: { in_app: true, push: true },
    group_mention: { in_app: true, push: true },
    dm_new_message: { in_app: true, push: true },
    friend_request_received: { in_app: true, push: true },
    friend_request_accepted: { in_app: true, push: false },
    new_book_published: { in_app: true, push: true },
    general: { in_app: true, push: false },
};

const PRIORITY_MAP: Record<NotificationActionType, Priority> = {
    prayer_prayed: 'high',
    friend_prayed: 'low',
    new_prayer_published: 'medium',
    prayer_comment: 'high',
    prayer_no_response: 'low',
    group_access_request: 'high',
    group_access_approved: 'high',
    group_new_message: 'medium',
    admin_new_group: 'high',
    group_invitation: 'high',
    group_mention: 'high',
    dm_new_message: 'high',
    friend_request_received: 'high',
    friend_request_accepted: 'high',
    new_book_published: 'medium',
    general: 'low',
};

// ══════════════════════════════════════════════════════════
// CORS & HELPERS
// ══════════════════════════════════════════════════════════

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
};

function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

function getUserId(request: Request): string | null {
    return request.headers.get('X-User-Id') || null;
}

// ══════════════════════════════════════════════════════════
// SUPABASE CLIENT (simple fetch wrapper)
// ══════════════════════════════════════════════════════════

class SupabaseClient {
    private url: string;
    private key: string;

    constructor(url: string, key: string) {
        this.url = url.replace(/\/$/, '');
        this.key = key;
    }

    async query(table: string, options: {
        method?: string;
        select?: string;
        filters?: string;
        body?: any;
        order?: string;
        limit?: number;
        range?: [number, number];
        prefer?: string;
        single?: boolean;
    } = {}) {
        const { method = 'GET', select, filters, body, order, limit, prefer, single } = options;

        let url = `${this.url}/rest/v1/${table}`;
        const params: string[] = [];

        if (select) params.push(`select=${encodeURIComponent(select)}`);
        if (filters) params.push(filters);
        if (order) params.push(`order=${encodeURIComponent(order)}`);
        if (limit) params.push(`limit=${limit}`);
        if (params.length) url += '?' + params.join('&');

        const headers: Record<string, string> = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
        };

        if (prefer) headers['Prefer'] = prefer;
        if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Supabase error ${response.status}: ${errText}`);
        }

        // For HEAD requests or 204 responses
        if (response.status === 204 || method === 'HEAD') return null;

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json')) {
            return response.json();
        }
        return null;
    }

    async insert(table: string, data: any | any[], options?: { returning?: boolean }) {
        const prefer = options?.returning !== false ? 'return=representation' : 'return=minimal';
        return this.query(table, { method: 'POST', body: data, prefer });
    }

    async update(table: string, data: any, filters: string) {
        return this.query(table, { method: 'PATCH', body: data, filters, prefer: 'return=representation' });
    }

    async select(table: string, options: {
        select?: string;
        filters?: string;
        order?: string;
        limit?: number;
        single?: boolean;
    } = {}) {
        return this.query(table, { method: 'GET', ...options });
    }
}

// ══════════════════════════════════════════════════════════
// MESSAGE BUILDER
// ══════════════════════════════════════════════════════════

function buildNotificationMessage(
    actionType: NotificationActionType,
    actors: { name: string }[],
    targetName?: string,
    count?: number,
    preview?: string,
): { title: string; message: string } {
    const actorCount = count || actors.length;
    const first = actors[0]?.name || 'Quelqu\'un';
    const second = actors[1]?.name;

    function formatActors(): string {
        if (actorCount === 1) return first;
        if (actorCount === 2) return `${first} et ${second}`;
        return `${first}, ${second} et ${actorCount - 2} autre${actorCount - 2 > 1 ? 's' : ''}`;
    }

    const short = (s?: string, len = 60) => s ? (s.length > len ? s.substring(0, len) + '…' : s) : '';

    switch (actionType) {
        case 'prayer_prayed':
            if (actorCount === 1) {
                return {
                    title: '🙏 Quelqu\'un a prié pour vous',
                    message: `${first} a prié pour votre demande : "${short(targetName)}"`,
                };
            }
            return {
                title: '🙏 Plusieurs personnes ont prié',
                message: `${formatActors()} ont prié pour votre demande`,
            };

        case 'friend_prayed':
            return {
                title: '🙏 Votre ami a prié',
                message: `Votre ami ${first} a aussi prié pour ce sujet`,
            };

        case 'new_prayer_published':
            return {
                title: '📢 Nouvelle demande de prière',
                message: `${first} a publié : "${short(targetName)}"`,
            };

        case 'prayer_comment':
            if (actorCount === 1) {
                return {
                    title: '💬 Nouveau commentaire',
                    message: `${first} a commenté votre demande de prière`,
                };
            }
            return {
                title: '💬 Nouveaux commentaires',
                message: `${formatActors()} ont commenté votre demande de prière`,
            };

        case 'prayer_no_response':
            return {
                title: '🕊️ Votre demande attend',
                message: 'Votre demande n\'a pas encore reçu de prière. La communauté est là.',
            };

        case 'group_access_request':
            if (actorCount === 1) {
                return {
                    title: '👥 Nouvelle demande d\'accès',
                    message: `${first} souhaite rejoindre votre groupe ${targetName}`,
                };
            }
            return {
                title: '👥 Demandes d\'accès',
                message: `${formatActors()} souhaitent rejoindre ${targetName}`,
            };

        case 'group_access_approved':
            return {
                title: '✅ Demande approuvée',
                message: `Votre demande d'accès au groupe ${targetName} a été approuvée !`,
            };

        case 'group_new_message':
            if (actorCount === 1) {
                return {
                    title: `💬 ${targetName}`,
                    message: `${first}: ${short(preview, 80)}`,
                };
            }
            return {
                title: `💬 ${targetName}`,
                message: `${first} a envoyé ${actorCount} messages dans ${targetName}`,
            };

        case 'admin_new_group':
            return {
                title: '🌟 Nouveau groupe officiel',
                message: `Nouveau groupe officiel : ${targetName}`,
            };

        case 'group_invitation':
            if (actorCount === 1) {
                return {
                    title: '👥 Invitation à un groupe',
                    message: `${first} vous invite à rejoindre ${targetName}`,
                };
            }
            return {
                title: '👥 Invitations à un groupe',
                message: `${formatActors()} vous invitent à rejoindre ${targetName}`,
            };

        case 'group_mention':
            return {
                title: '🔔 Mention dans un groupe',
                message: `${first} vous a mentionné dans ${targetName} : ${short(preview, 60)}`,
            };

        case 'dm_new_message':
            if (actorCount === 1) {
                return {
                    title: `💬 ${first}`,
                    message: short(preview, 80),
                };
            }
            return {
                title: `💬 ${first}`,
                message: `${first} vous a envoyé ${actorCount} messages`,
            };

        case 'friend_request_received':
            return {
                title: '👋 Demande d\'ami',
                message: `${first} vous a envoyé une demande d'ami`,
            };

        case 'friend_request_accepted':
            return {
                title: '👋 Ami ajouté !',
                message: `${first} a accepté votre demande d'ami`,
            };

        case 'new_book_published':
            return {
                title: '📚 Nouveau livre disponible',
                message: `"${targetName}" vient d'être ajouté à la bibliothèque`,
            };

        default:
            return {
                title: 'Notification',
                message: preview || 'Nouvelle notification',
            };
    }
}

// ══════════════════════════════════════════════════════════
// DEEP-LINK BUILDER
// ══════════════════════════════════════════════════════════

function buildActionData(actionType: NotificationActionType, payload: NotifyPayload): Record<string, any> {
    const base: Record<string, any> = {};

    switch (actionType) {
        case 'prayer_prayed':
        case 'friend_prayed':
        case 'new_prayer_published':
        case 'prayer_comment':
        case 'prayer_no_response':
            return {
                ...base,
                tab: 'community',
                communityTab: 'prieres',
                prayerId: payload.target_id,
                ...(actionType === 'prayer_comment' ? { scrollToComments: true } : {}),
            };

        case 'group_access_request':
            return {
                ...base,
                tab: 'community',
                viewState: 'group-detail',
                groupId: payload.target_id,
                groupName: payload.target_name,
                communityTab: 'demandes',
            };

        case 'group_access_approved':
        case 'group_new_message':
            return {
                ...base,
                tab: 'community',
                viewState: 'group-detail',
                groupId: payload.target_id,
                groupName: payload.target_name,
                communityTab: actionType === 'group_new_message' ? 'chat' : undefined,
            };

        case 'admin_new_group':
            return {
                ...base,
                tab: 'community',
                viewState: 'groups',
            };

        case 'group_invitation':
            return {
                ...base,
                tab: 'community',
                viewState: 'group-detail',
                groupId: payload.target_id,
                groupName: payload.target_name,
            };

        case 'group_mention':
            return {
                ...base,
                tab: 'community',
                viewState: 'group-detail',
                groupId: payload.target_id,
                groupName: payload.target_name,
                communityTab: 'chat',
                scrollToMessage: payload.extra_data?.messageId,
            };

        case 'dm_new_message':
            return {
                ...base,
                tab: 'community',
                communityTab: 'chat',
                viewState: 'conversation',
                conversationId: payload.target_id,
            };

        case 'friend_request_received':
            return {
                ...base,
                tab: 'profil',
                viewState: 'friend-requests',
            };

        case 'friend_request_accepted':
            return {
                ...base,
                tab: 'community',
                communityTab: 'chat',
                viewState: 'conversation',
                conversationId: payload.extra_data?.conversationId,
            };

        case 'new_book_published':
            return {
                ...base,
                tab: 'library',
                bookId: payload.target_id,
            };

        default:
            return { ...base, tab: 'community' };
    }
}

// ══════════════════════════════════════════════════════════
// AGGREGATION KEY
// ══════════════════════════════════════════════════════════

function buildAggregationKey(
    recipientId: string,
    actionType: NotificationActionType,
    targetId?: string,
    actorId?: string,
): string | null {
    const window = AGGREGATION_WINDOWS[actionType];
    if (!window) return null; // No aggregation for this type

    // For certain types, include actor in the key
    const includeActor = ['friend_prayed', 'group_new_message', 'dm_new_message'].includes(actionType);

    const parts = [recipientId, actionType, targetId || 'none'];
    if (includeActor && actorId) parts.push(actorId);

    return `agg:${parts.join(':')}`;
}

// ══════════════════════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════════════════════

async function checkRateLimit(
    kv: KVNamespace,
    userId: string,
    env: Env,
): Promise<{ allowed: boolean; reason?: string }> {
    const pushIntervalMs = parseInt(env.RATE_LIMIT_PUSH_INTERVAL_MS || '10000');
    const hourlyMax = parseInt(env.RATE_LIMIT_HOURLY_MAX || '50');

    // Check push interval (sliding window)
    const lastPushKey = `rate:push:${userId}`;
    const lastPush = await kv.get(lastPushKey);
    if (lastPush) {
        const elapsed = Date.now() - parseInt(lastPush);
        if (elapsed < pushIntervalMs) {
            return { allowed: false, reason: `Rate limit: wait ${pushIntervalMs - elapsed}ms` };
        }
    }

    // Check hourly count
    const hourKey = `rate:hour:${userId}:${Math.floor(Date.now() / 3600000)}`;
    const hourCount = parseInt(await kv.get(hourKey) || '0');
    if (hourCount >= hourlyMax) {
        return { allowed: false, reason: `Hourly limit reached (${hourlyMax})` };
    }

    return { allowed: true };
}

async function recordRateLimit(kv: KVNamespace, userId: string): Promise<void> {
    const lastPushKey = `rate:push:${userId}`;
    await kv.put(lastPushKey, String(Date.now()), { expirationTtl: 30 });

    const hourKey = `rate:hour:${userId}:${Math.floor(Date.now() / 3600000)}`;
    const current = parseInt(await kv.get(hourKey) || '0');
    await kv.put(hourKey, String(current + 1), { expirationTtl: 3600 });
}

// ══════════════════════════════════════════════════════════
// USER PREFERENCES
// ══════════════════════════════════════════════════════════

async function getUserPreferences(
    kv: KVNamespace,
    db: SupabaseClient,
    userId: string,
    actionType: NotificationActionType,
): Promise<{ in_app: boolean; push: boolean }> {
    const cacheKey = `prefs:${userId}`;

    // Check KV cache first
    const cached = await kv.get(cacheKey, 'json') as Record<string, any> | null;
    if (cached && cached[actionType]) {
        return cached[actionType];
    }

    // Fetch from Supabase
    try {
        const prefs = await db.select('notification_preferences', {
            select: 'action_type,in_app,push_enabled',
            filters: `user_id=eq.${userId}`,
        });

        if (prefs && Array.isArray(prefs) && prefs.length > 0) {
            const prefsMap: Record<string, any> = {};
            for (const p of prefs) {
                prefsMap[p.action_type] = { in_app: p.in_app, push: p.push_enabled };
            }
            // Cache for 10 min
            await kv.put(cacheKey, JSON.stringify(prefsMap), { expirationTtl: 600 });
            return prefsMap[actionType] || DEFAULT_PREFERENCES[actionType] || DEFAULT_PREFERENCES.general;
        }
    } catch (e) {
        // Fallback to defaults
    }

    return DEFAULT_PREFERENCES[actionType] || DEFAULT_PREFERENCES.general;
}

// ══════════════════════════════════════════════════════════
// PUSH DEDUPLICATION
// ══════════════════════════════════════════════════════════

async function checkPushDedup(kv: KVNamespace, userId: string, aggKey: string): Promise<boolean> {
    const dedupKey = `push_sent:${userId}:${aggKey}`;
    const existing = await kv.get(dedupKey);
    if (existing) return true; // Already sent
    await kv.put(dedupKey, '1', { expirationTtl: 5 });
    return false;
}

// ══════════════════════════════════════════════════════════
// WEB PUSH ENCRYPTION (RFC 8291)
// ══════════════════════════════════════════════════════════

function b64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function strToB64url(s: string): string {
    return b64urlEncode(new TextEncoder().encode(s));
}

async function importVapidPrivateKey(publicKeyB64url: string, privateKeyB64url: string) {
    const pubBytes = b64urlDecode(publicKeyB64url);
    const x = b64urlEncode(pubBytes.slice(1, 33));
    const y = b64urlEncode(pubBytes.slice(33, 65));

    return crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', x, y, d: privateKeyB64url, ext: true },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
}

async function createVapidJwt(audience: string, subject: string, publicKeyB64: string, privateKeyB64: string) {
    const header = strToB64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const payload = strToB64url(JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
    }));

    const unsigned = `${header}.${payload}`;
    const key = await importVapidPrivateKey(publicKeyB64, privateKeyB64);

    const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(unsigned)
    );

    return `${unsigned}.${b64urlEncode(new Uint8Array(sig))}`;
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
    );
}

async function encryptPayload(p256dhB64: string, authB64: string, payloadString: string): Promise<Uint8Array> {
    const plaintext = new TextEncoder().encode(payloadString);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const localKeys = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    const uaPublic = b64urlDecode(p256dhB64);
    const subscriberKey = await crypto.subtle.importKey(
        'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: subscriberKey },
            localKeys.privateKey,
            256
        )
    );

    const authSecret = b64urlDecode(authB64);
    const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', localKeys.publicKey));

    const infoPrefix = new TextEncoder().encode('WebPush: info\0');
    const keyInfo = new Uint8Array(infoPrefix.length + 65 + 65);
    keyInfo.set(infoPrefix);
    keyInfo.set(uaPublic, infoPrefix.length);
    keyInfo.set(asPublic, infoPrefix.length + 65);

    const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);
    const cek = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

    const padded = new Uint8Array(plaintext.length + 1);
    padded.set(plaintext);
    padded[plaintext.length] = 2;

    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded)
    );

    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096, false);

    const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
    let off = 0;
    body.set(salt, off); off += 16;
    body.set(rs, off); off += 4;
    body[off] = 65; off += 1;
    body.set(asPublic, off); off += 65;
    body.set(ciphertext, off);

    return body;
}

async function sendWebPush(
    subscription: any,
    payloadObj: any,
    env: Env
): Promise<{ ok: boolean; status?: number; error?: string }> {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        return { ok: false, error: 'VAPID keys not configured' };
    }

    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.hostname}`;

    const jwt = await createVapidJwt(
        audience,
        env.VAPID_EMAIL || 'mailto:admin@maisondepriere.app',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );

    const body = await encryptPayload(
        subscription.keys.p256dh,
        subscription.keys.auth,
        JSON.stringify(payloadObj)
    );

    const urgency = payloadObj.urgency || 'normal';

    const res = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            'TTL': '86400',
            'Urgency': urgency,
        },
        body,
    });

    if (res.status === 410 || res.status === 404) {
        // Subscription expired
        return { ok: false, status: res.status, error: 'Subscription expired' };
    }

    return { ok: res.ok, status: res.status };
}

// ══════════════════════════════════════════════════════════
// HANDLER: POST /notify
// ══════════════════════════════════════════════════════════

async function handleNotify(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const payload: NotifyPayload = await request.json();
    const { action_type, actor_id, actor_name, actor_avatar } = payload;

    if (!action_type || !actor_id || !actor_name) {
        return json({ error: 'action_type, actor_id, actor_name required' }, 400);
    }

    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const recipientIds = payload.recipient_ids || (payload.recipient_id ? [payload.recipient_id] : []);

    if (recipientIds.length === 0) {
        return json({ error: 'recipient_id or recipient_ids required' }, 400);
    }

    const results: any[] = [];

    // Process each recipient
    for (const recipientId of recipientIds) {
        // Skip self-notifications
        if (recipientId === actor_id) continue;

        try {
            // 1. Check user preferences
            const prefs = await getUserPreferences(env.USER_PREFERENCES, db, recipientId, action_type);

            if (!prefs.in_app && !prefs.push) {
                results.push({ userId: recipientId, skipped: true, reason: 'preferences' });
                continue;
            }

            // 2. Check aggregation
            const aggKey = buildAggregationKey(recipientId, action_type, payload.target_id, actor_id);
            const window = AGGREGATION_WINDOWS[action_type];

            let isAggregated = false;
            let existingEntry: AggregationEntry | null = null;

            if (aggKey && window) {
                const cached = await env.NOTIFICATION_CACHE.get(aggKey, 'json') as AggregationEntry | null;
                if (cached && (Date.now() - cached.first_at) < window * 1000) {
                    existingEntry = cached;
                    isAggregated = true;
                }
            }

            // 3. Build message
            const actors = isAggregated && existingEntry
                ? [...existingEntry.actors, { id: actor_id, name: actor_name, avatar: actor_avatar }]
                : [{ id: actor_id, name: actor_name, avatar: actor_avatar }];

            // Deduplicate actors
            const uniqueActors = actors.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
            const totalCount = isAggregated && existingEntry ? existingEntry.count + 1 : 1;

            const { title, message } = buildNotificationMessage(
                action_type,
                uniqueActors,
                payload.target_name,
                totalCount,
                payload.message_preview,
            );

            const actionData = buildActionData(action_type, payload);
            const priority = PRIORITY_MAP[action_type] || 'medium';

            // 4. Insert or update in Supabase
            if (prefs.in_app) {
                if (isAggregated && existingEntry?.notification_id) {
                    // Update existing aggregated notification
                    await db.update('notifications', {
                        title,
                        message,
                        actors: JSON.stringify(uniqueActors.slice(0, 5)), // Store up to 5 actors
                        actor_count: totalCount,
                        aggregation_key: aggKey,
                        is_read: false,
                        updated_at: new Date().toISOString(),
                    }, `id=eq.${existingEntry.notification_id}`);
                } else {
                    // Insert new notification
                    const inserted = await db.insert('notifications', {
                        user_id: recipientId,
                        title,
                        message,
                        type: mapActionTypeToLegacyType(action_type),
                        action_type,
                        action_data: JSON.stringify(actionData),
                        actors: JSON.stringify(uniqueActors.slice(0, 5)),
                        actor_count: totalCount,
                        aggregation_key: aggKey,
                        priority,
                        is_read: false,
                    });

                    // Update aggregation cache
                    if (aggKey && window) {
                        const newEntry: AggregationEntry = {
                            actors: uniqueActors.slice(0, 10),
                            count: totalCount,
                            first_at: existingEntry?.first_at || Date.now(),
                            notification_id: Array.isArray(inserted) ? inserted[0]?.id : undefined,
                        };
                        await env.NOTIFICATION_CACHE.put(aggKey, JSON.stringify(newEntry), { expirationTtl: window });
                    }

                    // 5. Increment unread counter
                    const unreadKey = `unread:${recipientId}`;
                    const current = parseInt(await env.UNREAD_COUNTERS.get(unreadKey) || '0');
                    await env.UNREAD_COUNTERS.put(unreadKey, String(current + 1));
                }
            }

            // 6. Enqueue push notification
            if (prefs.push) {
                const rateCheck = await checkRateLimit(env.NOTIFICATION_CACHE, recipientId, env);
                if (rateCheck.allowed) {
                    const dedupKey = aggKey || `${recipientId}:${action_type}:${payload.target_id}:${Date.now()}`;
                    const isDuplicate = await checkPushDedup(env.NOTIFICATION_CACHE, recipientId, dedupKey);

                    if (!isDuplicate) {
                        // Send push directly (no queue needed)
                        ctx.waitUntil(sendPushDirect(recipientId, title, message, actionData, priority, dedupKey, env));
                        await recordRateLimit(env.NOTIFICATION_CACHE, recipientId);
                    }
                }
            }

            results.push({ userId: recipientId, ok: true, aggregated: isAggregated });
        } catch (e: any) {
            results.push({ userId: recipientId, ok: false, error: e.message });
        }
    }

    return json({ success: true, results });
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
            return 'friend_request';
        case 'new_book_published':
            return 'info';
        default:
            return 'info';
    }
}

// ══════════════════════════════════════════════════════════
// HANDLER: GET /notify/count
// ══════════════════════════════════════════════════════════

async function handleGetCount(request: Request, env: Env): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) return json({ error: 'X-User-Id header required' }, 401);

    const unreadKey = `unread:${userId}`;
    const count = parseInt(await env.UNREAD_COUNTERS.get(unreadKey) || '0');

    return json({ unread_count: count });
}

// ══════════════════════════════════════════════════════════
// HANDLER: PATCH /notify/read
// ══════════════════════════════════════════════════════════

async function handleMarkRead(request: Request, env: Env): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) return json({ error: 'X-User-Id header required' }, 401);

    const { notification_id } = await request.json() as { notification_id: string };
    if (!notification_id) return json({ error: 'notification_id required' }, 400);

    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Mark as read in Supabase
    await db.update('notifications', { is_read: true }, `id=eq.${notification_id}&user_id=eq.${userId}`);

    // Decrement KV counter
    const unreadKey = `unread:${userId}`;
    const current = parseInt(await env.UNREAD_COUNTERS.get(unreadKey) || '0');
    await env.UNREAD_COUNTERS.put(unreadKey, String(Math.max(0, current - 1)));

    return json({ success: true });
}

// ══════════════════════════════════════════════════════════
// HANDLER: PATCH /notify/read-all
// ══════════════════════════════════════════════════════════

async function handleMarkAllRead(request: Request, env: Env): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) return json({ error: 'X-User-Id header required' }, 401);

    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Mark all as read in Supabase
    await db.update('notifications', { is_read: true }, `user_id=eq.${userId}&is_read=eq.false`);

    // Reset KV counter
    await env.UNREAD_COUNTERS.put(`unread:${userId}`, '0');

    return json({ success: true });
}

// ══════════════════════════════════════════════════════════
// HANDLER: GET /notify/list
// ══════════════════════════════════════════════════════════

async function handleList(request: Request, env: Env): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) return json({ error: 'X-User-Id header required' }, 401);

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor'); // ISO timestamp
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const filter = url.searchParams.get('filter'); // 'unread' | 'all'

    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    let filters = `user_id=eq.${userId}`;
    if (cursor) {
        filters += `&created_at=lt.${cursor}`;
    }
    if (filter === 'unread') {
        filters += '&is_read=eq.false';
    }

    const notifications = await db.select('notifications', {
        select: 'id,title,message,type,action_type,action_data,actors,actor_count,is_read,created_at,priority,aggregation_key',
        filters,
        order: 'created_at.desc',
        limit: limit + 1, // Fetch one extra to check if there's more
    });

    const items = Array.isArray(notifications) ? notifications : [];
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

    return json({
        notifications: page,
        next_cursor: nextCursor,
        has_more: hasMore,
    });
}

// ══════════════════════════════════════════════════════════
// HANDLER: User Preferences
// ══════════════════════════════════════════════════════════

async function handleGetPreferences(request: Request, env: Env): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) return json({ error: 'X-User-Id header required' }, 401);

    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const prefs = await db.select('notification_preferences', {
        select: 'action_type,in_app,push_enabled',
        filters: `user_id=eq.${userId}`,
    });

    // Merge with defaults
    const merged: Record<string, any> = {};
    for (const [key, defaults] of Object.entries(DEFAULT_PREFERENCES)) {
        merged[key] = { in_app: defaults.in_app, push: defaults.push };
    }

    if (Array.isArray(prefs)) {
        for (const p of prefs) {
            merged[p.action_type] = { in_app: p.in_app, push: p.push_enabled };
        }
    }

    return json({ preferences: merged });
}

async function handleUpdatePreferences(request: Request, env: Env): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) return json({ error: 'X-User-Id header required' }, 401);

    const { preferences } = await request.json() as {
        preferences: Record<string, { in_app?: boolean; push?: boolean }>;
    };

    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    for (const [actionType, pref] of Object.entries(preferences)) {
        // Upsert each preference
        await db.query('notification_preferences', {
            method: 'POST',
            body: {
                user_id: userId,
                action_type: actionType,
                in_app: pref.in_app ?? true,
                push_enabled: pref.push ?? true,
            },
            prefer: 'resolution=merge-duplicates,return=minimal',
        });
    }

    // Invalidate KV cache
    await env.USER_PREFERENCES.delete(`prefs:${userId}`);

    return json({ success: true });
}

// ══════════════════════════════════════════════════════════
// HANDLER: Push token registration
// ══════════════════════════════════════════════════════════

async function handlePushRegister(request: Request, env: Env): Promise<Response> {
    const { userId, subscription } = await request.json() as { userId: string; subscription: any };
    if (!userId || !subscription) return json({ error: 'userId and subscription required' }, 400);

    // Store in KV with 24h TTL
    await env.PUSH_TOKEN_CACHE.put(`push:${userId}`, JSON.stringify(subscription), {
        expirationTtl: 86400,
    });

    // Also store in Supabase for persistence
    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    try {
        await db.query('push_tokens', {
            method: 'POST',
            body: {
                user_id: userId,
                subscription_json: JSON.stringify(subscription),
                platform: 'web',
                updated_at: new Date().toISOString(),
            },
            prefer: 'resolution=merge-duplicates,return=minimal',
        });
    } catch (e) {
        // Non-critical: KV is the primary store
    }

    return json({ success: true });
}

// ══════════════════════════════════════════════════════════
// DIRECT PUSH SENDER (replaces queue for free tier)
// ══════════════════════════════════════════════════════════

async function sendPushDirect(
    userId: string,
    title: string,
    body: string,
    data: any,
    priority: string,
    aggKey: string,
    env: Env
): Promise<void> {
    try {
        // Get push subscription from KV first, then Supabase
        let subJson = await env.PUSH_TOKEN_CACHE.get(`push:${userId}`);

        if (!subJson) {
            const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
            const tokens = await db.select('push_tokens', {
                select: 'subscription_json',
                filters: `user_id=eq.${userId}`,
                single: true,
            });
            if (tokens?.subscription_json) {
                subJson = tokens.subscription_json;
                await env.PUSH_TOKEN_CACHE.put(`push:${userId}`, subJson, { expirationTtl: 86400 });
            }
        }

        if (!subJson) return;

        const subscription = JSON.parse(subJson);
        const pushPayload = {
            title,
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: '/', ...data },
            urgency: priority === 'high' ? 'high' : 'normal',
            tag: aggKey || undefined,
            renotify: !!aggKey,
        };

        const result = await sendWebPush(subscription, pushPayload, env);

        if (result.status === 410 || result.status === 404) {
            // Subscription expired → clean up
            await env.PUSH_TOKEN_CACHE.delete(`push:${userId}`);
            const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
            try {
                await db.query('push_tokens', { method: 'DELETE', filters: `user_id=eq.${userId}` });
            } catch (e) { /* non-critical */ }
        }
    } catch (e) {
        console.error('[Push] Direct send error for user', userId, e);
    }
}

// ══════════════════════════════════════════════════════════
// CRON HANDLER — prayer_no_response Reminders
// ══════════════════════════════════════════════════════════

async function handleCron(env: Env): Promise<void> {
    const db = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Find prayer requests older than 48h with 0 prayers
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    try {
        const prayers = await db.select('prayer_requests', {
            select: 'id,user_id,content,pray_count,created_at',
            filters: `created_at=lt.${cutoff}&pray_count=eq.0`,
            limit: 50,
        });

        if (!Array.isArray(prayers) || prayers.length === 0) return;

        for (const prayer of prayers) {
            // Check if we already sent a reminder (deduplicate via KV)
            const reminderKey = `reminder:prayer_no_resp:${prayer.id}`;
            const alreadySent = await env.NOTIFICATION_CACHE.get(reminderKey);
            if (alreadySent) continue;

            // Get user preferences
            const prefs = await getUserPreferences(env.USER_PREFERENCES, db, prayer.user_id, 'prayer_no_response');

            const { title, message } = buildNotificationMessage('prayer_no_response', [], prayer.content);
            const actionData = {
                tab: 'community',
                communityTab: 'prieres',
                prayerId: prayer.id,
            };

            if (prefs.in_app) {
                await db.insert('notifications', {
                    user_id: prayer.user_id,
                    title,
                    message,
                    type: 'prayer',
                    action_type: 'prayer_no_response',
                    action_data: JSON.stringify(actionData),
                    priority: 'low',
                    is_read: false,
                });

                // Increment unread counter
                const unreadKey = `unread:${prayer.user_id}`;
                const current = parseInt(await env.UNREAD_COUNTERS.get(unreadKey) || '0');
                await env.UNREAD_COUNTERS.put(unreadKey, String(current + 1));
            }

            if (prefs.push) {
                // Send push directly (no queue needed)
                await sendPushDirect(prayer.user_id, title, message, actionData, 'low', `cron:prayer:${prayer.id}`, env);
            }

            // Mark reminder as sent (TTL 7 days — don't resend)
            await env.NOTIFICATION_CACHE.put(reminderKey, '1', { expirationTtl: 7 * 86400 });
        }
    } catch (e) {
        console.error('[Cron] prayer_no_response error:', e);
    }
}

// ══════════════════════════════════════════════════════════
// LEGACY PUSH ENDPOINTS (Backward-compatible with existing worker)
// ══════════════════════════════════════════════════════════

function handleVapidKey(env: Env): Response {
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
}

async function handlePushSend(request: Request, env: Env): Promise<Response> {
    const { userId, title, message, data } = await request.json() as any;

    let subJson = await env.PUSH_TOKEN_CACHE.get(`push:${userId}`);
    if (!subJson) return json({ ok: false, error: 'No subscription' });

    const subscription = JSON.parse(subJson);
    const result = await sendWebPush(subscription, {
        title,
        body: message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: data || {},
    }, env);

    return json(result);
}

// ══════════════════════════════════════════════════════════
// HEALTH & ANALYTICS
// ══════════════════════════════════════════════════════════

function handleHealth(env: Env): Response {
    return json({
        status: 'ok',
        service: 'notification-worker',
        version: '2.0.0',
        vapid_configured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
        supabase_configured: !!env.SUPABASE_URL,
        features: [
            'aggregation',
            'kv-counters',
            'direct-push',
            'cron-reminders',
            'cursor-pagination',
            'user-preferences',
            'rate-limiting',
        ],
    });
}

// ══════════════════════════════════════════════════════════
// R2 FILE STORAGE HANDLERS
// ══════════════════════════════════════════════════════════

function checkAdminAuth(request: Request, env: Env): boolean {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    return token === env.ADMIN_KEY && !!token;
}

async function handleR2Upload(request: Request, env: Env): Promise<Response> {
    if (!checkAdminAuth(request, env)) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'books';

    if (!file) {
        return json({ error: 'No file provided' }, 400);
    }

    // Generate unique key
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${timestamp}_${safeName}`;

    // Upload to R2
    await env.LIBRARY_BUCKET.put(key, file.stream(), {
        httpMetadata: {
            contentType: file.type || 'application/octet-stream',
        },
        customMetadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
        },
    });

    // Build public URL
    const workerUrl = new URL(request.url);
    const url = `${workerUrl.protocol}//${workerUrl.host}/r2/${key}`;

    return json({ url, key });
}

async function handleR2Delete(request: Request, env: Env): Promise<Response> {
    if (!checkAdminAuth(request, env)) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const { key } = await request.json() as { key: string };
    if (!key) {
        return json({ error: 'key required' }, 400);
    }

    await env.LIBRARY_BUCKET.delete(key);
    return json({ ok: true });
}

async function handleR2Serve(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.replace('/r2/', '');

    const object = await env.LIBRARY_BUCKET.get(key);
    if (!object) {
        return json({ error: 'Not found' }, 404);
    }

    const headers = new Headers({
        ...CORS_HEADERS,
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.httpEtag,
    });

    return new Response(object.body, { headers });
}

// ══════════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════════

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        const { pathname } = new URL(request.url);
        const method = request.method;

        try {
            // ── Notification Gateway ──
            if (pathname === '/notify' && method === 'POST') return handleNotify(request, env, ctx);
            if (pathname === '/notify/count' && method === 'GET') return handleGetCount(request, env);
            if (pathname === '/notify/read' && method === 'PATCH') return handleMarkRead(request, env);
            if (pathname === '/notify/read-all' && method === 'PATCH') return handleMarkAllRead(request, env);
            if (pathname === '/notify/list' && method === 'GET') return handleList(request, env);

            // ── Preferences ──
            if (pathname === '/notify/preferences' && method === 'GET') return handleGetPreferences(request, env);
            if (pathname === '/notify/preferences' && method === 'PATCH') return handleUpdatePreferences(request, env);

            // ── Push Registration ──
            if (pathname === '/api/push/register' && method === 'POST') return handlePushRegister(request, env);
            if (pathname === '/api/push/vapid-key' && method === 'GET') return handleVapidKey(env);
            if (pathname === '/api/push/send' && method === 'POST') return handlePushSend(request, env);

            // ── Health ──
            if (pathname === '/health' || pathname === '/api/status') return handleHealth(env);

            // ── R2 File Storage ──
            if (pathname === '/api/r2/upload' && method === 'POST') return handleR2Upload(request, env);
            if (pathname === '/api/r2/delete' && method === 'POST') return handleR2Delete(request, env);
            if (pathname.startsWith('/r2/') && method === 'GET') return handleR2Serve(request, env);

            return json({
                error: 'Not found',
                routes: [
                    'POST   /notify                → send notification event',
                    'GET    /notify/count           → unread count (KV)',
                    'PATCH  /notify/read            → mark one read',
                    'PATCH  /notify/read-all        → mark all read',
                    'GET    /notify/list            → cursor-based list',
                    'GET    /notify/preferences     → get user preferences',
                    'PATCH  /notify/preferences     → update preferences',
                    'POST   /api/push/register      → register push token',
                    'GET    /api/push/vapid-key     → VAPID public key',
                    'POST   /api/push/send          → direct push',
                    'POST   /api/r2/upload          → upload file to R2',
                    'POST   /api/r2/delete          → delete file from R2',
                    'GET    /r2/*                   → serve R2 file',
                    'GET    /health                 → health check',
                ],
            }, 404);
        } catch (e: any) {
            return json({ error: e.message, stack: e.stack }, 500);
        }
    },

    // Cron trigger
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(handleCron(env));
    },
};
