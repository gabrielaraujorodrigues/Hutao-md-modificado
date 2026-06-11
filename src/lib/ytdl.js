/**
 * ytdl.js — download de áudio/vídeo do YouTube
 *
 * Estratégia:
 *  1. yt-dlp  (binário auto-baixado em ./bin/yt-dlp — sem root, sem instalação global)
 *  2. @distube/ytdl-core (Node.js puro)
 *  3. play-dl stream (último recurso)
 *
 * Busca:
 *  1. yt-dlp --dump-json (se disponível)
 *  2. play-dl search
 *  3. Invidious search API
 */

const { execSync, execFileSync } = require('child_process')
const ytdl   = require('@distube/ytdl-core')
const playdl = require('play-dl')
const fs     = require('fs')
const path   = require('path')
const os     = require('os')

const _fetch = (() => {
    if (typeof fetch === 'function') return fetch
    try { return require('node-fetch') } catch { return null }
})()

// Caminho do binário yt-dlp dentro do projeto (não precisa de root)
const YTDLP_PATH = path.resolve(__dirname, '../../bin/yt-dlp')

const INVIDIOUS = [
    'https://iv.datura.network',
    'https://invidious.privacyredirect.com',
    'https://yewtu.be',
    'https://inv.tux.pizza',
]

function safeTimeout(ms) {
    try { return AbortSignal.timeout(ms) } catch { return undefined }
}

function extractVideoId(url) {
    if (!url) return null
    try {
        const u = new URL(url)
        if (u.searchParams.get('v')) return u.searchParams.get('v')
        const m = u.pathname.match(/\/([A-Za-z0-9_-]{11})$/)
        return m ? m[1] : null
    } catch { return null }
}

// ── AUTO-DOWNLOAD DO yt-dlp ───────────────────────────────────────────────────

async function ensureYtdlp() {
    if (fs.existsSync(YTDLP_PATH)) {
        try { execFileSync(YTDLP_PATH, ['--version'], { stdio: 'ignore', timeout: 5000 }); return true } catch {}
    }

    if (!_fetch) return false

    const binDir = path.dirname(YTDLP_PATH)
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true })

    // Detecta arquitetura do servidor
    const arch = os.arch()
    const urls = [
        arch === 'arm64'
            ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64'
            : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
        'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    ]

    for (const url of urls) {
        try {
            console.log('[yt-dlp] Baixando binário de', url)
            const res = await _fetch(url, { redirect: 'follow', signal: safeTimeout(60000) })
            if (!res.ok) continue
            const buf = Buffer.from(await res.arrayBuffer())
            if (buf.length < 1_000_000) continue            // sanidade — binário tem ~10 MB+
            fs.writeFileSync(YTDLP_PATH, buf)
            fs.chmodSync(YTDLP_PATH, '755')
            execFileSync(YTDLP_PATH, ['--version'], { stdio: 'ignore', timeout: 5000 })
            console.log('[yt-dlp] Instalado com sucesso em', YTDLP_PATH)
            return true
        } catch (e) {
            console.error('[yt-dlp] Falha ao baixar:', e.message?.slice(0, 80))
        }
    }
    return false
}

// Faz o download usando yt-dlp local (sem instalação global)
function runYtdlp(args, timeoutMs = 120000) {
    return execFileSync(YTDLP_PATH, args, { timeout: timeoutMs, encoding: 'utf8' })
}

// ── BUSCA ─────────────────────────────────────────────────────────────────────

async function searchYouTube(query) {
    // Método 1: yt-dlp (mais preciso)
    if (fs.existsSync(YTDLP_PATH)) {
        try {
            const out = runYtdlp([
                `ytsearch1:${query}`,
                '--dump-json', '--no-playlist', '--quiet',
                '--extractor-args', 'youtube:player_client=android',
            ], 30000)
            const data = JSON.parse(out.trim().split('\n')[0])
            if (data?.id) return {
                id: data.id,
                title: data.title || 'Sem título',
                duration: data.duration || 0,
                url: data.webpage_url || `https://www.youtube.com/watch?v=${data.id}`,
                thumbnail: data.thumbnail || `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`,
                uploader: data.uploader || 'Desconhecido',
                views: data.view_count || 0,
            }
        } catch {}
    }

    // Método 2: play-dl
    try {
        const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 })
        const v = results?.[0]
        if (v?.id) return {
            id: v.id,
            title: v.title || 'Sem título',
            duration: v.durationInSec || 0,
            url: `https://www.youtube.com/watch?v=${v.id}`,
            thumbnail: v.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
            uploader: v.channel?.name || 'Desconhecido',
            views: v.views || 0,
        }
    } catch {}

    // Método 3: Invidious search
    if (_fetch) {
        for (const base of INVIDIOUS) {
            try {
                const res = await _fetch(
                    `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,lengthSeconds,viewCount`,
                    { signal: safeTimeout(8000) }
                )
                if (!res.ok) continue
                const data = await res.json()
                if (!Array.isArray(data) || !data.length) continue
                const v = data[0]
                if (!v.videoId) continue
                return {
                    id: v.videoId,
                    title: v.title || 'Sem título',
                    duration: v.lengthSeconds || 0,
                    url: `https://www.youtube.com/watch?v=${v.videoId}`,
                    thumbnail: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
                    uploader: v.author || 'Desconhecido',
                    views: v.viewCount || 0,
                }
            } catch {}
        }
    }

    throw new Error('Nenhum resultado encontrado. Tente um termo diferente.')
}

// ── DOWNLOAD DE ÁUDIO ─────────────────────────────────────────────────────────

async function downloadAudio(url) {
    const tmpBase = path.join(os.tmpdir(), `yt_audio_${Date.now()}`)

    // Garante que yt-dlp está disponível (baixa automaticamente se não estiver)
    const ytdlpOk = await ensureYtdlp()

    // Método 1: yt-dlp com cliente Android (burla bloqueio de datacenter)
    if (ytdlpOk) {
        try {
            const outTemplate = tmpBase + '.%(ext)s'
            runYtdlp([
                url,
                '-x', '--audio-format', 'mp3', '--audio-quality', '5',
                '--no-playlist', '--quiet', '--no-warnings',
                '--extractor-args', 'youtube:player_client=android,ios',
                '--output', outTemplate,
            ], 120000)

            // Procura o arquivo gerado
            const dir = os.tmpdir()
            const base = path.basename(tmpBase)
            const found = fs.readdirSync(dir).find(f => f.startsWith(base) && f.endsWith('.mp3'))
            if (found) {
                const fp = path.join(dir, found)
                if (fs.statSync(fp).size > 1000) return { path: fp, mimetype: 'audio/mpeg' }
            }
        } catch (err) {
            console.error('[yt-dlp] Falhou:', err.message?.slice(0, 150))
        }
    }

    // Método 2: @distube/ytdl-core
    try {
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
                    },
                },
            })
            const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
                .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))

            if (audioFormats.length) {
                const fmt = audioFormats[0]
                const ext = fmt.container || 'webm'
                const tmpPath = `${tmpBase}.${ext}`
                await new Promise((resolve, reject) => {
                    const stream = ytdl.downloadFromInfo(info, { format: fmt })
                    const out = fs.createWriteStream(tmpPath)
                    stream.pipe(out)
                    stream.on('error', reject)
                    out.on('finish', resolve)
                    out.on('error', reject)
                })
                if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
                    return { path: tmpPath, mimetype: fmt.mimeType?.split(';')[0] || 'audio/webm' }
                }
            }
        }
    } catch (err) {
        console.error('[ytdl-core] Falhou:', err.message?.slice(0, 150))
    }

    // Método 3: play-dl stream
    try {
        const streamData = await playdl.stream(url, { quality: 1 })
        const tmpPath = `${tmpBase}_pd.webm`
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(tmpPath)
            streamData.stream.pipe(out)
            out.on('finish', resolve)
            out.on('error', reject)
        })
        if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
            return { path: tmpPath, mimetype: 'audio/ogg; codecs=opus' }
        }
    } catch (err) {
        console.error('[play-dl] Falhou:', err.message?.slice(0, 100))
    }

    throw new Error('❌ Não foi possível baixar o áudio. Verifique os logs do bot para mais detalhes.')
}

// ── DOWNLOAD DE VÍDEO ─────────────────────────────────────────────────────────

async function downloadVideo(url) {
    const tmpBase = path.join(os.tmpdir(), `yt_video_${Date.now()}`)
    const ytdlpOk = await ensureYtdlp()

    // Método 1: yt-dlp (mp4 até 480p)
    if (ytdlpOk) {
        try {
            const outTemplate = tmpBase + '.%(ext)s'
            runYtdlp([
                url,
                '-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
                '--merge-output-format', 'mp4',
                '--no-playlist', '--quiet', '--no-warnings',
                '--extractor-args', 'youtube:player_client=android,ios',
                '--output', outTemplate,
            ], 180000)

            const dir = os.tmpdir()
            const base = path.basename(tmpBase)
            const found = fs.readdirSync(dir).find(f => f.startsWith(base) && f.endsWith('.mp4'))
            if (found) {
                const fp = path.join(dir, found)
                if (fs.statSync(fp).size > 1000) return { path: fp, mimetype: 'video/mp4' }
            }
        } catch (err) {
            console.error('[yt-dlp video] Falhou:', err.message?.slice(0, 150))
        }
    }

    // Método 2: @distube/ytdl-core
    try {
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url, {
                requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } },
            })
            const mixedFormats = ytdl.filterFormats(info.formats, 'videoandaudio')
                .filter(f => f.container === 'mp4')
                .sort((a, b) => (b.height || 0) - (a.height || 0))

            if (mixedFormats.length) {
                const fmt = mixedFormats.find(f => (f.height || 999) <= 480) || mixedFormats[mixedFormats.length - 1]
                const tmpPath = `${tmpBase}.mp4`
                await new Promise((resolve, reject) => {
                    const stream = ytdl.downloadFromInfo(info, { format: fmt })
                    const out = fs.createWriteStream(tmpPath)
                    stream.pipe(out)
                    stream.on('error', reject)
                    out.on('finish', resolve)
                    out.on('error', reject)
                })
                if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
                    return { path: tmpPath, mimetype: 'video/mp4' }
                }
            }
        }
    } catch (err) {
        console.error('[ytdl-core video] Falhou:', err.message?.slice(0, 150))
    }

    throw new Error('❌ Não foi possível baixar o vídeo.')
}

// ── UTILITÁRIOS ───────────────────────────────────────────────────────────────

function formatDuration(seconds) {
    if (!seconds) return 'Ao vivo'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

function formatViews(n) {
    if (!n) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

module.exports = { searchYouTube, downloadAudio, downloadVideo, formatDuration, formatViews }
