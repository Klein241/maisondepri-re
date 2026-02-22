/**
 * MAISON DE PRIÈRE — MULTI-SERVICE PROXY SERVER
 * Hosted on Fly.io (free tier)
 *
 * SERVICES:
 * 1. 📺 Live Stream Proxy (yt-dlp + FFmpeg → HLS)
 * 2. 🎬 Facebook Video Gallery (extract & proxy videos without VPN)
 * 3. 🔔 Web Push Notifications (VAPID)
 * 4. 📊 Presence (who's online)
 * 5. ⌨️ Typing Indicator
 * 6. 📈 Live Analytics
 * 7. 🔗 URL Preview / Link Unfurling
 * 8. 🖼️ Image Compression
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Optional deps — loaded gracefully
let webpush, sharp, supabaseJs;
try { webpush = require('web-push'); } catch (e) { console.warn('web-push not available'); }
try { sharp = require('sharp'); } catch (e) { console.warn('sharp not available'); }
try { supabaseJs = require('@supabase/supabase-js'); } catch (e) { console.warn('@supabase/supabase-js not available'); }

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/streams', express.static(path.join(__dirname, 'streams')));
app.use('/replays', express.static(path.join(__dirname, 'replays')));

// Ensure directories
['streams', 'replays', 'streams/live', 'cache'].forEach(dir => {
    const p = path.join(__dirname, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── CONFIG ──────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'maison-de-priere-admin-2026';
const BASE_URL = process.env.FLY_APP_NAME
    ? `https://${process.env.FLY_APP_NAME}.fly.dev`
    : `http://localhost:3000`;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@maisondepriere.app';

console.log('🌍 Server URL:', BASE_URL);

// ── VAPID Setup ─────────────────────────────────────────
if (webpush && VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('✅ Web Push configured');
}

// ── Supabase connection (for auto push notifications) ───
let supabase = null;
if (supabaseJs && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase connected');

    // Listen for new notifications → send push
    supabase.channel('push-notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
        }, async (payload) => {
            const { user_id, title, message } = payload.new;
            await sendPushToUser(user_id, title, message);
        })
        .subscribe();
}

// ══════════════════════════════════════════════════════════
// 1. 📺 LIVE STREAM PROXY
// ══════════════════════════════════════════════════════════
let activeFFmpeg = null;
let replayFFmpeg = null;
let currentLiveId = null;
let currentSourceUrl = null;
let proxyStatus = 'idle';
let lastError = null;

// Real-time state
let viewerCount = 0;
let reactionCounts = { '❤️': 0, '🙏': 0, '🔥': 0, '👏': 0, '😍': 0, '✝️': 0 };
let recentComments = [];

// ── Presence state ──────────────────────────────────────
const onlineUsers = new Map(); // userId → { socketId, name, avatar, lastSeen }
const typingUsers = new Map(); // `roomId:userId` → timeout

// ── Push subscriptions ──────────────────────────────────
const pushSubscriptions = new Map(); // userId → subscription

app.get('/health', (req, res) => {
    res.json({
        status: 'ok', base_url: BASE_URL, proxy_status: proxyStatus,
        is_live: proxyStatus === 'live', viewers: viewerCount,
        online_users: onlineUsers.size, push_subs: pushSubscriptions.size,
        services: ['live-proxy', 'video-gallery', 'push', 'presence', 'typing', 'link-preview', 'image-compress'],
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        is_live: proxyStatus === 'live', status: proxyStatus,
        live_id: currentLiveId, source_url: currentSourceUrl,
        viewers: viewerCount, reactions: reactionCounts,
        comments_count: recentComments.length, error: lastError,
        stream_url: proxyStatus === 'live' ? `${BASE_URL}/streams/live/playlist.m3u8` : null,
    });
});

// Clean embed/iframe URLs → original URLs for yt-dlp
function cleanUrl(url) {
    if (!url) return url;
    try {
        const u = new URL(url);
        // Facebook embed → original URL
        if (u.pathname.includes('/plugins/video.php') || u.pathname.includes('/plugins/post.php')) {
            const href = u.searchParams.get('href');
            if (href) return decodeURIComponent(href);
        }
        // YouTube embed → original URL
        if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
            const videoId = u.pathname.split('/embed/')[1]?.split('?')[0];
            if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
        }
    } catch (e) { /* not a valid URL, return as-is */ }
    return url;
}

function extractStreamUrl(socialUrl) {
    const cleanedUrl = cleanUrl(socialUrl);
    return new Promise((resolve, reject) => {
        console.log('🔍 Extracting stream URL from:', cleanedUrl, cleanedUrl !== socialUrl ? `(cleaned from: ${socialUrl.substring(0, 80)}...)` : '');
        // Try multiple format strategies for maximum compatibility
        const formats = ['b', 'best', 'best[ext=mp4]/best', 'worst'];
        let lastErr = '';

        const tryFormat = (idx) => {
            if (idx >= formats.length) {
                reject(new Error(`Extraction failed after all format attempts: ${lastErr}`));
                return;
            }
            const fmt = formats[idx];
            const cmd = `yt-dlp -g -f "${fmt}" --no-warnings --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${cleanedUrl}"`;
            exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
                if (error) {
                    lastErr = (stderr || error.message).trim();
                    console.warn(`⚠️ Format "${fmt}" failed, trying next...`);
                    tryFormat(idx + 1);
                    return;
                }
                const url = stdout.trim().split('\n')[0];
                if (!url) { tryFormat(idx + 1); return; }
                console.log(`✅ Stream URL extracted (format: ${fmt})`);
                resolve(url);
            });
        };
        tryFormat(0);
    });
}

app.post('/api/start-proxy', async (req, res) => {
    const { url, admin_key } = req.body;
    if (admin_key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
    if (!url) return res.status(400).json({ error: 'URL required' });

    stopAllFFmpeg();
    proxyStatus = 'extracting';
    lastError = null;
    currentSourceUrl = url;
    currentLiveId = Date.now().toString();
    reactionCounts = { '❤️': 0, '🙏': 0, '🔥': 0, '👏': 0, '😍': 0, '✝️': 0 };
    recentComments = [];
    io.emit('proxy_status', { status: 'extracting', message: 'Extraction du flux...' });

    try {
        const streamUrl = await extractStreamUrl(url);
        const hlsDir = path.join(__dirname, 'streams', 'live');
        fs.readdirSync(hlsDir).forEach(f => { try { fs.unlinkSync(path.join(hlsDir, f)); } catch (e) { } });

        activeFFmpeg = spawn('ffmpeg', [
            '-re', '-i', streamUrl,
            '-c:v', 'libx264', '-c:a', 'aac',
            '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-g', '30', '-sc_threshold', '0',
            '-f', 'hls', '-hls_time', '2', '-hls_list_size', '6',
            '-hls_flags', 'delete_segments+append_list+omit_endlist',
            '-hls_segment_filename', path.join(hlsDir, 'seg_%d.ts'),
            path.join(hlsDir, 'playlist.m3u8')
        ]);

        activeFFmpeg.stderr.on('data', (data) => {
            if (data.toString().includes('Opening') && data.toString().includes('.ts') && proxyStatus !== 'live') {
                proxyStatus = 'live';
                console.log('🔴 LIVE!');
                io.emit('proxy_status', { status: 'live', stream_url: `${BASE_URL}/streams/live/playlist.m3u8` });
                io.emit('live_started', { stream_url: `${BASE_URL}/streams/live/playlist.m3u8`, live_id: currentLiveId });
            }
        });
        activeFFmpeg.on('close', (code) => {
            if (proxyStatus === 'live') { proxyStatus = 'idle'; io.emit('live_ended', { timestamp: new Date() }); }
            activeFFmpeg = null;
        });

        // Record replay
        const replayFile = path.join(__dirname, 'replays', `replay_${currentLiveId}.mp4`);
        replayFFmpeg = spawn('ffmpeg', ['-i', streamUrl, '-c', 'copy', '-movflags', '+faststart', replayFile]);
        replayFFmpeg.on('close', () => {
            io.emit('replay_available', { url: `${BASE_URL}/replays/replay_${currentLiveId}.mp4` });
            replayFFmpeg = null;
        });

        res.json({ success: true, status: 'extracting', stream_url: `${BASE_URL}/streams/live/playlist.m3u8`, live_id: currentLiveId });
    } catch (error) {
        proxyStatus = 'error'; lastError = error.message;
        io.emit('proxy_status', { status: 'error', error: error.message });
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stop-proxy', (req, res) => {
    if (req.body.admin_key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
    stopAllFFmpeg(); proxyStatus = 'idle'; currentLiveId = null;
    io.emit('live_ended', { timestamp: new Date() }); io.emit('proxy_status', { status: 'idle' });
    res.json({ success: true });
});

function stopAllFFmpeg() {
    if (activeFFmpeg) { try { activeFFmpeg.kill('SIGTERM'); } catch (e) { } activeFFmpeg = null; }
    if (replayFFmpeg) { try { replayFFmpeg.kill('SIGTERM'); } catch (e) { } replayFFmpeg = null; }
}

// ══════════════════════════════════════════════════════════
// 2. 🎬 FACEBOOK VIDEO GALLERY (bypass VPN)
// ══════════════════════════════════════════════════════════

// List all videos from a Facebook page
app.post('/api/videos/list', async (req, res) => {
    const { page_url } = req.body;
    if (!page_url) return res.status(400).json({ error: 'page_url required' });

    try {
        console.log('📋 Listing videos from:', page_url);
        const cmd = `yt-dlp --flat-playlist -j --no-warnings --no-check-certificates --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${page_url}" 2>/dev/null | head -50`;
        exec(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error && !stdout) {
                return res.status(500).json({ error: 'Failed to list videos', detail: stderr });
            }
            const videos = stdout.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        const v = JSON.parse(line);
                        return {
                            id: v.id || v.url,
                            title: v.title || 'Vidéo',
                            url: v.url || v.webpage_url || `https://www.facebook.com/watch/?v=${v.id}`,
                            duration: v.duration || null,
                            thumbnail: v.thumbnail || null,
                            timestamp: v.timestamp || v.upload_date || null,
                            view_count: v.view_count || null,
                        };
                    } catch (e) { return null; }
                })
                .filter(Boolean);
            res.json({ videos, count: videos.length });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Extract direct video URL for playback (client plays directly)
app.post('/api/videos/extract', async (req, res) => {
    const { video_url } = req.body;
    if (!video_url) return res.status(400).json({ error: 'video_url required' });

    try {
        const directUrl = await extractStreamUrl(video_url);
        res.json({ success: true, direct_url: directUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Stream a video through our proxy (for users where even FB CDN is blocked)
app.get('/api/videos/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'url param required' });

    try {
        const directUrl = await extractStreamUrl(decodeURIComponent(videoUrl));

        // Use native fetch to pipe the video
        const response = await fetch(directUrl, {
            headers: { 'Range': req.headers.range || '' }
        });

        res.status(response.status);
        response.headers.forEach((value, key) => {
            if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        const reader = response.body.getReader();
        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); break; }
                if (!res.write(value)) {
                    await new Promise(r => res.once('drain', r));
                }
            }
        };
        pump().catch(() => res.end());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/replays', (req, res) => {
    const dir = path.join(__dirname, 'replays');
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4')).map(f => {
            const stat = fs.statSync(path.join(dir, f));
            return { filename: f, url: `${BASE_URL}/replays/${f}`, size_mb: Math.round(stat.size / 1024 / 1024 * 10) / 10, created_at: stat.mtime };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ replays: files });
    } catch (e) { res.json({ replays: [] }); }
});

// ══════════════════════════════════════════════════════════
// 3. 🔔 WEB PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════

// Get VAPID public key (client needs this to subscribe)
app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC || null });
});

// Register a push subscription
app.post('/api/push/register', (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ error: 'userId and subscription required' });
    pushSubscriptions.set(userId, subscription);
    console.log(`🔔 Push registered for user ${userId} (total: ${pushSubscriptions.size})`);
    res.json({ success: true });
});

// Unregister
app.post('/api/push/unregister', (req, res) => {
    const { userId } = req.body;
    pushSubscriptions.delete(userId);
    res.json({ success: true });
});

// Send push to a specific user
async function sendPushToUser(userId, title, message, data = {}) {
    if (!webpush || !VAPID_PUBLIC) return;
    const sub = pushSubscriptions.get(userId);
    if (!sub) return;

    try {
        await webpush.sendNotification(sub, JSON.stringify({
            title, body: message, icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png', data: { url: '/', ...data },
        }));
    } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
            pushSubscriptions.delete(userId);
        }
        console.error('Push error:', e.message);
    }
}

// Send push to ALL users (admin broadcast)
app.post('/api/push/broadcast', async (req, res) => {
    const { admin_key, title, message, data } = req.body;
    if (admin_key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });

    let sent = 0, failed = 0;
    for (const [userId, sub] of pushSubscriptions) {
        try {
            await sendPushToUser(userId, title, message, data);
            sent++;
        } catch (e) { failed++; }
    }
    res.json({ success: true, sent, failed, total: pushSubscriptions.size });
});

// ══════════════════════════════════════════════════════════
// 4. 🔗 URL PREVIEW / LINK UNFURLING
// ══════════════════════════════════════════════════════════

app.post('/api/link-preview', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaisonBot/1.0)' },
            signal: AbortSignal.timeout(8000),
        });
        const html = await response.text();

        // Extract OpenGraph tags
        const getOG = (prop) => {
            const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
                || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:${prop}["']`, 'i'));
            return m ? m[1] : null;
        };
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

        res.json({
            title: getOG('title') || (titleMatch ? titleMatch[1].trim() : null),
            description: getOG('description'),
            image: getOG('image'),
            url: getOG('url') || url,
            site_name: getOG('site_name'),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ══════════════════════════════════════════════════════════
// 5. 🖼️ IMAGE COMPRESSION
// ══════════════════════════════════════════════════════════

app.post('/api/compress-image', async (req, res) => {
    if (!sharp) return res.status(501).json({ error: 'Image compression not available' });

    const { image_base64, max_width, quality } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

    try {
        const buffer = Buffer.from(image_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const compressed = await sharp(buffer)
            .resize(max_width || 1200, null, { withoutEnlargement: true })
            .jpeg({ quality: quality || 75 })
            .toBuffer();

        const originalSize = buffer.length;
        const compressedSize = compressed.length;

        res.json({
            image_base64: `data:image/jpeg;base64,${compressed.toString('base64')}`,
            original_size_kb: Math.round(originalSize / 1024),
            compressed_size_kb: Math.round(compressedSize / 1024),
            reduction_percent: Math.round((1 - compressedSize / originalSize) * 100),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ══════════════════════════════════════════════════════════
// 6. 🔌 WEBSOCKET — Presence, Typing, Live, Comments
// ══════════════════════════════════════════════════════════

io.on('connection', (socket) => {
    let currentUserId = null;
    viewerCount++;
    io.emit('viewer_count', viewerCount);

    // ── Initial state ──
    socket.emit('connection_ready', {
        is_live: proxyStatus === 'live', status: proxyStatus,
        live_id: currentLiveId, viewers: viewerCount,
        reactions: reactionCounts, recent_comments: recentComments.slice(-30),
        online_users: Array.from(onlineUsers.entries()).map(([id, u]) => ({ id, name: u.name, avatar: u.avatar })),
        stream_url: proxyStatus === 'live' ? `${BASE_URL}/streams/live/playlist.m3u8` : null,
    });

    // ── 📊 User goes online ──
    socket.on('user_online', ({ userId, name, avatar }) => {
        if (!userId) return;
        currentUserId = userId;
        onlineUsers.set(userId, { socketId: socket.id, name, avatar, lastSeen: Date.now() });
        io.emit('presence_update', {
            type: 'online', userId, name, avatar,
            online_users: Array.from(onlineUsers.entries()).map(([id, u]) => ({ id, name: u.name, avatar: u.avatar })),
        });
    });

    // ── ⌨️ Typing indicator ──
    socket.on('typing_start', ({ roomId, userId, userName }) => {
        if (!roomId || !userId) return;
        const key = `${roomId}:${userId}`;
        // Clear old timeout
        if (typingUsers.has(key)) clearTimeout(typingUsers.get(key));
        // Broadcast to room
        socket.broadcast.emit('user_typing', { roomId, userId, userName, isTyping: true });
        // Auto-clear after 3s
        typingUsers.set(key, setTimeout(() => {
            typingUsers.delete(key);
            socket.broadcast.emit('user_typing', { roomId, userId, userName, isTyping: false });
        }, 3000));
    });

    socket.on('typing_stop', ({ roomId, userId, userName }) => {
        const key = `${roomId}:${userId}`;
        if (typingUsers.has(key)) { clearTimeout(typingUsers.get(key)); typingUsers.delete(key); }
        socket.broadcast.emit('user_typing', { roomId, userId, userName, isTyping: false });
    });

    // ── ❤️ Reactions ──
    socket.on('reaction', ({ emoji, userId, userName }) => {
        if (!emoji || !reactionCounts.hasOwnProperty(emoji)) return;
        reactionCounts[emoji]++;
        io.emit('new_reaction', { emoji, userId, userName, count: reactionCounts[emoji] });
        io.emit('reaction_counts', reactionCounts);
    });

    // ── 💬 Comments ──
    socket.on('comment', ({ text, userName, userId, parentId }) => {
        if (!text || text.length > 500 || !userName) return;
        const comment = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: text.trim(), userName, userId,
            parentId: parentId || null, timestamp: new Date().toISOString(),
        };
        recentComments.push(comment);
        if (recentComments.length > 200) recentComments.shift();
        io.emit('new_comment', comment);
    });

    socket.on('delete_comment', ({ commentId, admin_key }) => {
        if (admin_key !== ADMIN_KEY) return;
        recentComments = recentComments.filter(c => c.id !== commentId);
        io.emit('comment_deleted', { commentId });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
        viewerCount = Math.max(0, viewerCount - 1);
        io.emit('viewer_count', viewerCount);

        if (currentUserId) {
            onlineUsers.delete(currentUserId);
            io.emit('presence_update', {
                type: 'offline', userId: currentUserId,
                online_users: Array.from(onlineUsers.entries()).map(([id, u]) => ({ id, name: u.name, avatar: u.avatar })),
            });
        }
    });
});

// ══════════════════════════════════════════════════════════
// 7. 📈 ADMIN ANALYTICS
// ══════════════════════════════════════════════════════════

app.get('/api/analytics', (req, res) => {
    res.json({
        live: { is_live: proxyStatus === 'live', viewers: viewerCount, reactions: reactionCounts, comments: recentComments.length },
        users: { online: onlineUsers.size, push_subscribers: pushSubscriptions.size },
        server: { uptime_hours: Math.round(process.uptime() / 3600 * 10) / 10, memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
    });
});

// ── START ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Multi-Service Proxy Server on port ${PORT}`);
    console.log(`🌍 ${BASE_URL}`);
    console.log('📺 Live Proxy: /api/start-proxy, /api/stop-proxy');
    console.log('🎬 Video Gallery: /api/videos/list, /api/videos/extract, /api/videos/stream');
    console.log('🔔 Push: /api/push/register, /api/push/broadcast');
    console.log('🔗 Link Preview: /api/link-preview');
    console.log('🖼️ Image: /api/compress-image');
    console.log('📈 Analytics: /api/analytics');

    try { const v = require('child_process').execSync('yt-dlp --version').toString().trim(); console.log(`✅ yt-dlp ${v}`); } catch (e) { console.warn('⚠️ yt-dlp not found'); }
    try { require('child_process').execSync('ffmpeg -version', { stdio: 'pipe' }); console.log('✅ FFmpeg OK'); } catch (e) { console.warn('⚠️ FFmpeg not found'); }
});

process.on('SIGTERM', () => { stopAllFFmpeg(); server.close(); process.exit(0); });
