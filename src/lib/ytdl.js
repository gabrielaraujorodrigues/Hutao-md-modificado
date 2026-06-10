const playdl = require('play-dl')
const fs = require('fs')
const path = require('path')
const os = require('os')

const _fetch = typeof fetch !== 'undefined' ? fetch : (() => {
    try { return require('node-fetch') } catch { return null }
})()

const INVIDIOUS = [
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
    'https://yewtu.be',
    'https://invidious.nerdvpn.de',
]

function safeTimeout(ms) {
    try { return AbortSignal.timeout(ms) } catch { return undefined }
}

function extractVideoId(url) {
    if (!url) return null
    try {
        const u = new URL(url)
        return u.searchParams.get('v') || u.pathname.split('/').pop() || null
    } catch {
        return null
    }
}

// ── BUSCA ──────────────────────────────────────────────────────────────────────

async function searchYouTube(query) {
    // Método 1: play-dl
    try {
        const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 })
        const v = results?.[0]
        if (v?.id) {
            return {
                id: v.id,
                title: v.title || 'Sem título',
                duration: v.durationInSec || 0,
                url: `https://www.youtube.com/watch?v=${v.id}`,
                thumbnail: v.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
                uploader: v.channel?.name || 'Desconhecido',
                views: v.views || 0,
            }
        }
    } catch {}

    // Método 2: Invidious
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

    throw new Error('Nenhum resultado encontrado no YouTube.')
}

// ── COBALT.TOOLS API ──────────────────────────────────────────────────────────
// API pública gratuita — sem yt-dlp, sem ffmpeg, funciona via HTTP puro

async function cobaltDownload(ytUrl, mode) {
    if (!_fetch) throw new Error('fetch indisponível')

    const res = await _fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
            url: ytUrl,
            downloadMode: mode,   // "audio" ou "auto"
            audioFormat: 'mp3',
            videoQuality: '720',
            filenameStyle: 'basic',
        }),
        signal: safeTimeout(20000),
    })

    if (!res.ok) throw new Error(`Cobalt HTTP ${res.status}`)
    const data = await res.json()

    // status pode ser "stream", "tunnel" ou "redirect" — todos têm data.url
    if (!data.url) throw new Error(`Cobalt: ${JSON.stringify(data).slice(0, 100)}`)

    // Baixa o arquivo resultante
    const ext = mode === 'audio' ? 'mp3' : 'mp4'
    const tmpPath = path.join(os.tmpdir(), `cobalt_${Date.now()}.${ext}`)

    const dl = await _fetch(data.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: safeTimeout(90000),
    })
    if (!dl.ok) throw new Error(`Cobalt download: HTTP ${dl.status}`)

    const buf = Buffer.from(await dl.arrayBuffer())
    fs.writeFileSync(tmpPath, buf)

    if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size < 1000) {
        try { fs.unlinkSync(tmpPath) } catch {}
        throw new Error('Arquivo baixado inválido')
    }

    return {
        path: tmpPath,
        mimetype: mode === 'audio' ? 'audio/mpeg' : 'video/mp4',
    }
}

// ── DOWNLOAD DE ÁUDIO ─────────────────────────────────────────────────────────

async function downloadAudio(url) {
    // Método 1: Cobalt.tools (sem yt-dlp nem ffmpeg)
    try {
        return await cobaltDownload(url, 'audio')
    } catch (err) {
        console.error('[Cobalt] Erro:', err.message?.slice(0, 150))
    }

    // Método 2: Invidious (stream direto de áudio WebM)
    const videoId = extractVideoId(url)
    if (_fetch && videoId) {
        for (const base of INVIDIOUS) {
            try {
                const res = await _fetch(
                    `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`,
                    { signal: safeTimeout(10000) }
                )
                if (!res.ok) continue
                const data = await res.json()
                const audioFormats = (data.adaptiveFormats || [])
                    .filter(f => f.type?.startsWith('audio/'))
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
                const audioUrl = audioFormats[0]?.url
                if (!audioUrl) continue

                const dl = await _fetch(audioUrl, { signal: safeTimeout(90000) })
                if (!dl.ok) continue

                const tmpPath = path.join(os.tmpdir(), `inv_audio_${Date.now()}.webm`)
                fs.writeFileSync(tmpPath, Buffer.from(await dl.arrayBuffer()))
                if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
                    return { path: tmpPath, mimetype: 'audio/ogg; codecs=opus' }
                }
            } catch {}
        }
    }

    // Método 3: play-dl stream
    try {
        const streamData = await playdl.stream(url, { quality: 1 })
        const tmpPath = path.join(os.tmpdir(), `playdl_${Date.now()}.webm`)
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
        console.error('[play-dl] Erro:', err.message?.slice(0, 100))
    }

    throw new Error('Não foi possível baixar o áudio. Tente novamente mais tarde.')
}

// ── DOWNLOAD DE VÍDEO ─────────────────────────────────────────────────────────

async function downloadVideo(url) {
    // Método 1: Cobalt.tools
    try {
        return await cobaltDownload(url, 'auto')
    } catch (err) {
        console.error('[Cobalt Video] Erro:', err.message?.slice(0, 150))
    }

    // Método 2: play-dl stream (sem conversão)
    try {
        const streamData = await playdl.stream(url, { quality: 1 })
        const tmpPath = path.join(os.tmpdir(), `playdl_video_${Date.now()}.webm`)
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(tmpPath)
            streamData.stream.pipe(out)
            out.on('finish', resolve)
            out.on('error', reject)
        })
        if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
            return { path: tmpPath, mimetype: 'video/webm' }
        }
    } catch (err) {
        console.error('[play-dl video] Erro:', err.message?.slice(0, 100))
    }

    throw new Error('Não foi possível baixar o vídeo. Tente novamente mais tarde.')
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
