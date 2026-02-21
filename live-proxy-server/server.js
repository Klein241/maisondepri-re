/**
 * LIVE PROXY SERVER — Maison de Prière
 * 
 * Extracts live streams from blocked platforms (Facebook, YouTube, TikTok, etc.)
 * using yt-dlp, converts to HLS via FFmpeg, and serves via a non-blocked URL.
 * 
 * Also provides WebSocket for real-time comments, reactions, and viewer count.
 * 
 * FLOW:
 * 1. Admin pastes a social media live URL in the admin panel
 * 2. Admin panel calls POST /api/start-proxy with the URL
 * 3. Server uses yt-dlp to extract the real stream URL
 * 4. FFmpeg converts to HLS (ultra-low latency)
 * 5. Users watch from https://maisondepriere-live.fly.dev/streams/live/playlist.m3u8
 * 6. WebSocket handles comments, reactions, viewer count in real-time
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { exec, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS for the app
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

// Serve HLS streams and replays as static files
app.use('/streams', express.static(path.join(__dirname, 'streams')));
app.use('/replays', express.static(path.join(__dirname, 'replays')));

// Create directories
['streams', 'replays', 'streams/live'].forEach(dir => {
    const fullDir = path.join(__dirname, dir);
    if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
});

// ── State ──────────────────────────────────────────────
let activeFFmpeg = null;        // Active FFmpeg process for live HLS
let replayFFmpeg = null;        // Active FFmpeg process for replay recording
let currentLiveId = null;       // Current live session ID
let currentSourceUrl = null;    // The social media URL being proxied
let proxyStatus = 'idle';       // idle | extracting | live | error
let lastError = null;

// Real-time state (managed via WebSocket, NOT Supabase for the proxy)
let viewerCount = 0;
let reactionCounts = { '❤️': 0, '🙏': 0, '🔥': 0, '👏': 0, '😍': 0, '✝️': 0 };
let recentComments = [];

const ADMIN_KEY = process.env.ADMIN_KEY || 'maison-de-priere-admin-2026';
const BASE_URL = process.env.FLY_APP_NAME
    ? `https://${process.env.FLY_APP_NAME}.fly.dev`
    : `http://localhost:3000`;

console.log('🌍 Server URL:', BASE_URL);

// ── HEALTH CHECK ───────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        base_url: BASE_URL,
        proxy_status: proxyStatus,
        is_live: proxyStatus === 'live',
        viewers: viewerCount,
    });
});

// ── STATUS ─────────────────────────────────────────────
app.get('/api/status', (req, res) => {
    res.json({
        is_live: proxyStatus === 'live',
        status: proxyStatus,
        live_id: currentLiveId,
        source_url: currentSourceUrl,
        viewers: viewerCount,
        reactions: reactionCounts,
        comments_count: recentComments.length,
        stream_url: proxyStatus === 'live'
            ? `${BASE_URL}/streams/live/playlist.m3u8`
            : null,
        error: lastError,
    });
});

// ── LIST REPLAYS ───────────────────────────────────────
app.get('/api/replays', (req, res) => {
    const replaysDir = path.join(__dirname, 'replays');
    try {
        const files = fs.readdirSync(replaysDir)
            .filter(f => f.endsWith('.mp4'))
            .map(f => {
                const stat = fs.statSync(path.join(replaysDir, f));
                return {
                    filename: f,
                    url: `${BASE_URL}/replays/${f}`,
                    size_mb: Math.round(stat.size / 1024 / 1024 * 10) / 10,
                    created_at: stat.mtime,
                };
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ replays: files });
    } catch (e) {
        res.json({ replays: [] });
    }
});

// ── EXTRACT STREAM URL via yt-dlp ─────────────────────
function extractStreamUrl(socialUrl) {
    return new Promise((resolve, reject) => {
        console.log('🔍 Extracting stream URL from:', socialUrl);

        // yt-dlp extracts the real stream URL from any supported platform
        // -g = get URL only, -f best = best quality, --no-warnings
        const cmd = `yt-dlp -g -f "best[ext=mp4]/best" --no-warnings --no-check-certificates "${socialUrl}"`;

        exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ yt-dlp error:', stderr || error.message);
                reject(new Error(`Impossible d'extraire le flux: ${stderr || error.message}`));
                return;
            }
            const url = stdout.trim().split('\n')[0];
            if (!url) {
                reject(new Error('URL de stream introuvable'));
                return;
            }
            console.log('✅ Stream URL extracted:', url.substring(0, 80) + '...');
            resolve(url);
        });
    });
}

// ── START PROXY ────────────────────────────────────────
app.post('/api/start-proxy', async (req, res) => {
    const { url, admin_key, title } = req.body;

    // Auth check
    if (admin_key !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Clé admin incorrecte' });
    }
    if (!url) {
        return res.status(400).json({ error: 'URL requise' });
    }

    // Stop previous stream
    stopAllFFmpeg();

    proxyStatus = 'extracting';
    lastError = null;
    currentSourceUrl = url;
    currentLiveId = Date.now().toString();
    reactionCounts = { '❤️': 0, '🙏': 0, '🔥': 0, '👏': 0, '😍': 0, '✝️': 0 };
    recentComments = [];

    // Notify all connected clients
    io.emit('proxy_status', { status: 'extracting', message: 'Extraction du flux en cours...' });

    try {
        // Step 1: Extract real stream URL via yt-dlp
        const streamUrl = await extractStreamUrl(url);

        // Step 2: Clean old HLS files
        const hlsDir = path.join(__dirname, 'streams', 'live');
        fs.readdirSync(hlsDir).forEach(f => {
            try { fs.unlinkSync(path.join(hlsDir, f)); } catch (e) { }
        });

        // Step 3: Start FFmpeg for HLS (ultra-low latency)
        const hlsOutput = path.join(hlsDir, 'playlist.m3u8');

        activeFFmpeg = spawn('ffmpeg', [
            '-re',                            // Read at native frame rate
            '-i', streamUrl,                  // Input from extracted URL
            '-c:v', 'libx264',               // Video codec
            '-c:a', 'aac',                   // Audio codec
            '-preset', 'ultrafast',          // Fastest encoding
            '-tune', 'zerolatency',          // Minimize latency
            '-g', '30',                      // Keyframe every 30 frames
            '-sc_threshold', '0',            // Disable scene change detection
            '-f', 'hls',                     // Output format: HLS
            '-hls_time', '2',                // 2-second segments
            '-hls_list_size', '6',           // Keep 6 segments in playlist
            '-hls_flags', 'delete_segments+append_list+omit_endlist',
            '-hls_segment_filename', path.join(hlsDir, 'seg_%d.ts'),
            hlsOutput
        ]);

        activeFFmpeg.stdout.on('data', (data) => {
            // FFmpeg outputs on stderr, not stdout
        });

        activeFFmpeg.stderr.on('data', (data) => {
            const msg = data.toString();
            // Detect when HLS starts generating
            if (msg.includes('Opening') && msg.includes('.ts') && proxyStatus !== 'live') {
                proxyStatus = 'live';
                console.log('🔴 LIVE! Stream is now available');
                io.emit('proxy_status', {
                    status: 'live',
                    stream_url: `${BASE_URL}/streams/live/playlist.m3u8`,
                    live_id: currentLiveId,
                });
                io.emit('live_started', {
                    stream_url: `${BASE_URL}/streams/live/playlist.m3u8`,
                    live_id: currentLiveId,
                });
            }
        });

        activeFFmpeg.on('close', (code) => {
            console.log(`FFmpeg HLS exited with code ${code}`);
            if (proxyStatus === 'live') {
                proxyStatus = 'idle';
                io.emit('live_ended', { timestamp: new Date() });
                io.emit('proxy_status', { status: 'idle' });
            }
            activeFFmpeg = null;
        });

        activeFFmpeg.on('error', (err) => {
            console.error('FFmpeg spawn error:', err);
            proxyStatus = 'error';
            lastError = err.message;
            io.emit('proxy_status', { status: 'error', error: err.message });
        });

        // Step 4: Also record replay
        const replayFile = path.join(__dirname, 'replays', `replay_${currentLiveId}.mp4`);
        replayFFmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-c', 'copy',                   // Just copy, no re-encode
            '-movflags', '+faststart',       // Optimize for web playback
            replayFile
        ]);

        replayFFmpeg.on('close', (code) => {
            console.log(`FFmpeg replay exited with code ${code}`);
            if (code === 0 || fs.existsSync(replayFile)) {
                io.emit('replay_available', {
                    url: `${BASE_URL}/replays/replay_${currentLiveId}.mp4`,
                    live_id: currentLiveId,
                });
            }
            replayFFmpeg = null;
        });

        // Mark as extracting → will transition to 'live' when FFmpeg starts outputting
        res.json({
            success: true,
            status: 'extracting',
            stream_url: `${BASE_URL}/streams/live/playlist.m3u8`,
            live_id: currentLiveId,
            message: 'Flux en cours d\'extraction. Le stream sera disponible dans quelques secondes.',
        });

    } catch (error) {
        proxyStatus = 'error';
        lastError = error.message;
        io.emit('proxy_status', { status: 'error', error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ── STOP PROXY ─────────────────────────────────────────
app.post('/api/stop-proxy', (req, res) => {
    const { admin_key } = req.body;
    if (admin_key !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Clé admin incorrecte' });
    }

    stopAllFFmpeg();
    proxyStatus = 'idle';
    currentLiveId = null;

    io.emit('live_ended', { timestamp: new Date() });
    io.emit('proxy_status', { status: 'idle' });

    res.json({ success: true, message: 'Proxy arrêté' });
});

function stopAllFFmpeg() {
    if (activeFFmpeg) {
        try { activeFFmpeg.kill('SIGTERM'); } catch (e) { }
        activeFFmpeg = null;
    }
    if (replayFFmpeg) {
        try { replayFFmpeg.kill('SIGTERM'); } catch (e) { }
        replayFFmpeg = null;
    }
}

// ── WEBSOCKET — Real-time comments, reactions, viewers ─
io.on('connection', (socket) => {
    viewerCount++;
    io.emit('viewer_count', viewerCount);

    // Send current state to new viewer
    socket.emit('connection_ready', {
        is_live: proxyStatus === 'live',
        status: proxyStatus,
        live_id: currentLiveId,
        viewers: viewerCount,
        reactions: reactionCounts,
        recent_comments: recentComments.slice(-30),
        stream_url: proxyStatus === 'live'
            ? `${BASE_URL}/streams/live/playlist.m3u8`
            : null,
    });

    // ── Reaction ──
    socket.on('reaction', ({ emoji, userId, userName }) => {
        if (!emoji || !reactionCounts.hasOwnProperty(emoji)) return;
        reactionCounts[emoji]++;
        io.emit('new_reaction', { emoji, userId, userName, count: reactionCounts[emoji] });
        io.emit('reaction_counts', reactionCounts);
    });

    // ── Comment ──
    socket.on('comment', ({ text, userName, userId, parentId }) => {
        if (!text || text.length > 500 || !userName) return;
        const comment = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: text.trim(),
            userName,
            userId,
            parentId: parentId || null,
            timestamp: new Date().toISOString(),
        };
        recentComments.push(comment);
        if (recentComments.length > 200) recentComments.shift();
        io.emit('new_comment', comment);
    });

    // ── Delete comment (admin only) ──
    socket.on('delete_comment', ({ commentId, admin_key }) => {
        if (admin_key !== ADMIN_KEY) return;
        recentComments = recentComments.filter(c => c.id !== commentId);
        io.emit('comment_deleted', { commentId });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
        viewerCount = Math.max(0, viewerCount - 1);
        io.emit('viewer_count', viewerCount);
    });
});

// ── START SERVER ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Live Proxy Server running on port ${PORT}`);
    console.log(`🌍 Public URL: ${BASE_URL}`);
    console.log(`📺 HLS Stream: ${BASE_URL}/streams/live/playlist.m3u8`);
    console.log(`🔌 WebSocket: ${BASE_URL}`);

    // Check yt-dlp is available
    try {
        const version = execSync('yt-dlp --version').toString().trim();
        console.log(`✅ yt-dlp version: ${version}`);
    } catch (e) {
        console.warn('⚠️ yt-dlp not found! Install with: apt-get install python3 && pip3 install yt-dlp');
    }

    // Check FFmpeg is available
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        console.log('✅ FFmpeg available');
    } catch (e) {
        console.warn('⚠️ FFmpeg not found!');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    stopAllFFmpeg();
    server.close();
    process.exit(0);
});
