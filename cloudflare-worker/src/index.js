/**
 * MAISON DE PRIÈRE — CLOUDFLARE WORKER API
 * 
 * Services:
 *  1. 🔔 Web Push Notifications (VAPID + Web Crypto — style Pinterest)
 *  2. 🔗 URL Preview / Link Unfurling
 *  3. 📊 Health & Analytics
 *  4. 🪝 Supabase Webhook receiver (auto-push on notification INSERT)
 *
 * Storage: Cloudflare KV (push subscriptions)
 * Crypto: 100% native Web Crypto API (no npm dependencies)
 *
 * Free tier limits: 100k requests/day, 100k KV reads, 1k KV writes
 */

// ══════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS },
    });
}

// ══════════════════════════════════════════════════════════
// BASE64URL HELPERS
// ══════════════════════════════════════════════════════════

function b64urlEncode(buffer) {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function strToB64url(s) {
    return b64urlEncode(new TextEncoder().encode(s));
}

// ══════════════════════════════════════════════════════════
// VAPID JWT SIGNING (ECDSA P-256 / ES256)
// ══════════════════════════════════════════════════════════

async function importVapidPrivateKey(publicKeyB64url, privateKeyB64url) {
    const pubBytes = b64urlDecode(publicKeyB64url);
    // Uncompressed EC point: 0x04 + x(32) + y(32)
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

async function createVapidJwt(audience, subject, publicKeyB64, privateKeyB64) {
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

// ══════════════════════════════════════════════════════════
// WEB PUSH PAYLOAD ENCRYPTION (RFC 8291 — aes128gcm)
// ══════════════════════════════════════════════════════════

async function hkdf(ikm, salt, info, length) {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
    );
}

async function encryptPayload(p256dhB64, authB64, payloadString) {
    const plaintext = new TextEncoder().encode(payloadString);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // 1. Generate local ECDH key pair
    const localKeys = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    // 2. Import subscriber's p256dh public key
    const uaPublic = b64urlDecode(p256dhB64);
    const subscriberKey = await crypto.subtle.importKey(
        'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    // 3. ECDH shared secret
    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'ECDH', public: subscriberKey }, localKeys.privateKey, 256)
    );

    // 4. Auth secret
    const authSecret = b64urlDecode(authB64);

    // 5. Export local public key (65 bytes uncompressed)
    const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', localKeys.publicKey));

    // 6. Key derivation (RFC 8291 §3.4)
    //    IKM  = HKDF(ikm=ecdh_secret, salt=auth, info="WebPush: info\0" || ua_public || as_public, L=32)
    const infoPrefix = new TextEncoder().encode('WebPush: info\0');
    const keyInfo = new Uint8Array(infoPrefix.length + 65 + 65);
    keyInfo.set(infoPrefix);
    keyInfo.set(uaPublic, infoPrefix.length);
    keyInfo.set(asPublic, infoPrefix.length + 65);

    const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);

    //    CEK   = HKDF(ikm=ikm, salt=salt, info="Content-Encoding: aes128gcm\0", L=16)
    const cek = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);

    //    Nonce = HKDF(ikm=ikm, salt=salt, info="Content-Encoding: nonce\0",     L=12)
    const nonce = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

    // 7. Pad the payload (delimiter byte = 0x02, then optional zero padding)
    const padded = new Uint8Array(plaintext.length + 1);
    padded.set(plaintext);
    padded[plaintext.length] = 2; // delimiter

    // 8. Encrypt with AES-128-GCM
    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded)
    );

    // 9. Construct body (aes128gcm encoding header + ciphertext)
    //    salt(16) + rs(4, big-endian uint32 = 4096) + idlen(1, = 65) + keyid(65) + ciphertext
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

// ══════════════════════════════════════════════════════════
// SEND PUSH NOTIFICATION
// ══════════════════════════════════════════════════════════

async function sendWebPush(subscription, payloadObj, env) {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        return { ok: false, error: 'VAPID keys not configured' };
    }

    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.hostname}`;

    // VAPID Authorization header
    const jwt = await createVapidJwt(
        audience,
        env.VAPID_EMAIL || 'mailto:admin@maisondepriere.app',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
    );

    // Encrypt payload
    const body = await encryptPayload(
        subscription.keys.p256dh,
        subscription.keys.auth,
        JSON.stringify(payloadObj)
    );

    // Send to push service
    const res = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            'TTL': '86400',
            'Urgency': payloadObj.urgency || 'normal',
        },
        body,
    });

    return { ok: res.ok, status: res.status };
}

// ══════════════════════════════════════════════════════════
// ROUTE HANDLERS
// ══════════════════════════════════════════════════════════

function handleHealth(env) {
    return json({
        status: 'ok',
        platform: 'cloudflare-workers-free',
        services: ['push-notifications', 'link-preview', 'webhook'],
        vapid_configured: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    });
}

function handleVapidKey(env) {
    return json({ publicKey: env.VAPID_PUBLIC_KEY || null });
}

async function handlePushRegister(request, env) {
    const { userId, subscription } = await request.json();
    if (!userId || !subscription) return json({ error: 'userId and subscription required' }, 400);

    await env.PUSH_KV.put(`push:${userId}`, JSON.stringify(subscription), {
        expirationTtl: 60 * 60 * 24 * 90, // 90 days
    });

    return json({ success: true, message: `Subscription saved for ${userId}` });
}

async function handlePushUnregister(request, env) {
    const { userId } = await request.json();
    if (!userId) return json({ error: 'userId required' }, 400);
    await env.PUSH_KV.delete(`push:${userId}`);
    return json({ success: true });
}

async function handlePushSend(request, env) {
    const { admin_key, userId, title, message, data } = await request.json();
    if (admin_key !== env.ADMIN_KEY) return json({ error: 'Unauthorized' }, 401);

    const result = await pushToUser(env, userId, title, message || '', data);
    return json(result);
}

async function handlePushBroadcast(request, env) {
    const { admin_key, title, message, data } = await request.json();
    if (admin_key !== env.ADMIN_KEY) return json({ error: 'Unauthorized' }, 401);

    const list = await env.PUSH_KV.list({ prefix: 'push:' });
    let sent = 0, failed = 0;

    for (const key of list.keys) {
        const userId = key.name.replace('push:', '');
        try {
            const r = await pushToUser(env, userId, title, message || '', data);
            if (r.ok) sent++; else failed++;
        } catch { failed++; }
    }

    return json({ success: true, sent, failed, total: list.keys.length });
}

// Supabase Database Webhook: notifications INSERT → push
async function handleWebhook(request, env) {
    const body = await request.json();
    const record = body.record || body;
    const { user_id, title, message, link, type: notifType } = record;

    if (!user_id) return json({ error: 'No user_id' }, 400);

    const result = await pushToUser(env, user_id, title || 'Maison de Prière', message || '', {
        url: link || '/',
        type: notifType || 'notification',
        tag: notifType || undefined,
        // Pinterest-style actions
        actions: getActionsForType(notifType),
    });

    return json(result);
}

// ── Pinterest-style notification actions ─────────────────
function getActionsForType(type) {
    switch (type) {
        case 'prayer_request':
            return [{ action: 'pray', title: '🙏 Prier' }, { action: 'open', title: 'Voir' }];
        case 'message':
            return [{ action: 'reply', title: '💬 Répondre' }, { action: 'open', title: 'Voir' }];
        case 'group_invite':
            return [{ action: 'join', title: '✅ Rejoindre' }, { action: 'open', title: 'Voir' }];
        case 'testimony':
            return [{ action: 'amen', title: '🙌 Amen' }, { action: 'open', title: 'Voir' }];
        case 'live':
            return [{ action: 'watch', title: '🔴 Regarder' }];
        default:
            return [{ action: 'open', title: 'Ouvrir' }];
    }
}

// ── Push to a single user via KV lookup ──────────────────
async function pushToUser(env, userId, title, message, data = {}) {
    const subJson = await env.PUSH_KV.get(`push:${userId}`);
    if (!subJson) return { ok: false, error: 'No subscription' };

    const subscription = JSON.parse(subJson);

    const payload = {
        title,
        body: message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        image: data.image || undefined,
        data: { url: '/', ...data },
        actions: data.actions || [],
        tag: data.tag || undefined,
        renotify: !!data.tag,
    };

    try {
        const result = await sendWebPush(subscription, payload, env);

        // Subscription expired → clean up KV
        if (result.status === 410 || result.status === 404) {
            await env.PUSH_KV.delete(`push:${userId}`);
            return { ok: false, error: 'Subscription expired, removed' };
        }

        return result;
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// ══════════════════════════════════════════════════════════
// LINK PREVIEW
// ══════════════════════════════════════════════════════════

async function handleLinkPreview(request) {
    const { url } = await request.json();
    if (!url) return json({ error: 'url required' }, 400);

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaisonBot/1.0)' },
            cf: { cacheTtl: 3600 },
        });
        const html = await res.text();

        const og = (prop) => {
            const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
                || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:${prop}["']`, 'i'));
            return m ? m[1] : null;
        };
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

        return json({
            title: og('title') || (titleMatch ? titleMatch[1].trim() : null),
            description: og('description'),
            image: og('image'),
            url: og('url') || url,
            site_name: og('site_name'),
        });
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

// ══════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════

async function handleAnalytics(env) {
    const keys = await env.PUSH_KV.list();
    return json({
        total_push_subscriptions: keys.keys.length,
        timestamp: new Date().toISOString(),
    });
}

// ══════════════════════════════════════════════════════════
// 📦 R2 FILE STORAGE (Library books & covers)
// ══════════════════════════════════════════════════════════

/** Upload a file to R2 via multipart form */
async function handleR2Upload(request, env) {
    if (request.method !== 'POST') return json({ error: 'POST required' }, 405);

    // Simple auth check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_KEY}`) {
        return json({ error: 'Unauthorized' }, 401);
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const folder = formData.get('folder') || 'books'; // 'books' or 'covers'

        if (!file || !(file instanceof File)) {
            return json({ error: 'No file provided' }, 400);
        }

        // Generate unique path
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `${folder}/${Date.now()}_${cleanName}`;

        // Upload to R2
        await env.LIBRARY_R2.put(key, file.stream(), {
            httpMetadata: {
                contentType: file.type || 'application/octet-stream',
                contentDisposition: `inline; filename="${file.name}"`,
            },
            customMetadata: {
                originalName: file.name,
                uploadedAt: new Date().toISOString(),
            },
        });

        // Build public URL
        const workerUrl = new URL(request.url).origin;
        const publicUrl = `${workerUrl}/r2/${key}`;

        return json({ success: true, key, url: publicUrl, size: file.size });
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

/** Serve a file from R2 */
async function handleR2Serve(request, env, key) {
    const object = await env.LIBRARY_R2.get(key);
    if (!object) return json({ error: 'File not found' }, 404);

    const headers = new Headers({
        ...CORS,
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.httpEtag,
    });

    if (object.httpMetadata?.contentDisposition) {
        headers.set('Content-Disposition', object.httpMetadata.contentDisposition);
    }

    return new Response(object.body, { headers });
}

/** Delete a file from R2 */
async function handleR2Delete(request, env) {
    if (request.method !== 'POST') return json({ error: 'POST required' }, 405);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_KEY}`) {
        return json({ error: 'Unauthorized' }, 401);
    }

    try {
        const { key } = await request.json();
        if (!key) return json({ error: 'No key provided' }, 400);

        await env.LIBRARY_R2.delete(key);
        return json({ success: true, deleted: key });
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

// ══════════════════════════════════════════════════════════
// MAIN FETCH HANDLER
// ══════════════════════════════════════════════════════════

export default {
    async fetch(request, env) {
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS });
        }

        const { pathname } = new URL(request.url);

        try {
            // Health
            if (pathname === '/health' || pathname === '/api/status') return handleHealth(env);

            // Push
            if (pathname === '/api/push/vapid-key') return handleVapidKey(env);
            if (pathname === '/api/push/register') return handlePushRegister(request, env);
            if (pathname === '/api/push/unregister') return handlePushUnregister(request, env);
            if (pathname === '/api/push/send') return handlePushSend(request, env);
            if (pathname === '/api/push/broadcast') return handlePushBroadcast(request, env);

            // Supabase webhook
            if (pathname === '/api/webhook/notification') return handleWebhook(request, env);

            // Link preview
            if (pathname === '/api/link-preview') return handleLinkPreview(request);

            // Analytics
            if (pathname === '/api/analytics') return handleAnalytics(env);

            // R2 Storage
            if (pathname === '/api/r2/upload') return handleR2Upload(request, env);
            if (pathname === '/api/r2/delete') return handleR2Delete(request, env);
            if (pathname.startsWith('/r2/')) {
                const key = pathname.slice(4); // Remove '/r2/'
                return handleR2Serve(request, env, key);
            }

            return json({
                error: 'Not found', routes: [
                    'GET  /health',
                    'GET  /api/push/vapid-key',
                    'POST /api/push/register',
                    'POST /api/push/unregister',
                    'POST /api/push/send',
                    'POST /api/push/broadcast',
                    'POST /api/webhook/notification',
                    'POST /api/link-preview',
                    'GET  /api/analytics',
                    'POST /api/r2/upload',
                    'POST /api/r2/delete',
                    'GET  /r2/:key',
                ]
            }, 404);
        } catch (e) {
            return json({ error: e.message }, 500);
        }
    },
};
