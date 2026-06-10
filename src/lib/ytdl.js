/**
 * ytdl.js — download de áudio/vídeo do YouTube sem yt-dlp nem ffmpeg
 *
 * Estratégia de download:
 *  1. YouTube Innertube API (cliente ANDROID) → URLs diretas sem cipher
 *  2. cobalt.tools API pública
 *  3. Invidious (open-source YouTube frontend)
 *  4. play-dl stream (último recurso)
 *
 * Estratégia de busca:
 *  1. play-dl search
 *  2. Invidious search API
 */

const playdl = require('play-dl')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Suporte a fetch em Node < 18
const _fetch = (() => {
    if (typeof fetch === 'function') return fetch
    try { return require('node-fetch') } catch { return null }
})()

// ── Instâncias públicas do Invidious ──────────────────────────────────────────
const INVIDIOUS = [
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
    'https://yewtu.be',
    'https://invidious.nerdvpn.de',
    'https://vid.puffyan.us',
]

// Instâncias públicas do cobalt.tools (fallback)
const COBALT_INSTANCES = [
    'https://api.cobalt.tools/',
    'https://cobalt.api.timelessnesses.me/',
]

function safeTimeout(ms) {
    try { return AbortSignal.timeout(ms) } catch { return undefined }
}

function extractVideoId(url) {
    if (!url) return null
    try {
        const u = new URL(url)
        if (u.searchParams.get('v')) return u.searchParams.get('v')
        // youtu.be/VIDEOID
        const m = u.pathname.match(/\/([A-Za-z0-9_-]{11})/)
        return m ? m[1] : null
    } catch { return null }
}

// ── BUSCA ──────────────────────────────────────────────────────────────────────

async function searchYouTube(query) {
    // Método 1: play-dl (busca direta no YouTube)
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

    // Método 2: Invidious search
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

// ── INNERTUBE API (cliente Android) ───────────────────────────────────────────
// O cliente Android retorna URLs de stream SEM cipher — download direto.
// Técnica usada internamente pelo yt-dlp e outros.

async function innertubeStreams(videoId) {
    if (!_fetch) throw new Error('fetch indisponível')

    const body = {
        videoId,
        context: {
            client: {
                clientName: 'ANDROID',
                clientVersion: '19.09.37',
                androidSdkVersion: 30,
                userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
                hl: 'pt',
                gl: 'BR',
            },
        },
    }

    const res = await _fetch(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
                'X-YouTube-Client-Name': '3',
                'X-YouTube-Client-Version': '19.09.37',
                'Origin': 'https://www.youtube.com',
            },
            body: JSON.stringify(body),
            signal: safeTimeout(15000),
        }
    )

    if (!res.ok) throw new Error(`Innertube HTTP ${res.status}`)
    const data = await res.json()

    if (data.playabilityStatus?.status === 'LOGIN_REQUIRED') throw new Error('Vídeo requer login.')
    if (data.playabilityStatus?.status !== 'OK') throw new Error(`YouTube: ${data.playabilityStatus?.reason || 'não disponível'}`)

    return data.streamingData
}

async function downloadFromInnertube(url) {
    const videoId = extractVideoId(url)
    if (!videoId) throw new Error('ID de vídeo inválido')

    const streamData = await innertubeStreams(videoId)

    // Prefere adaptiveFormats (áudio separado), depois formats misturados
    const allFormats = [
        ...(streamData.adaptiveFormats || []),
        ...(streamData.formats || []),
    ]

    // Filtra apenas áudio
    const audioFormats = allFormats
        .filter(f => f.mimeType?.startsWith('audio/') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

    if (!audioFormats.length) throw new Error('Nenhum formato de áudio disponível.')

    // Usa o melhor formato de áudio disponível
    const best = audioFormats[0]
    const ext = best.mimeType?.includes('mp4') ? 'm4a' : 'webm'
    const tmpPath = path.join(os.tmpdir(), `innertube_${Date.now()}.${ext}`)

    const dl = await _fetch(best.url, {
        headers: {
            'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
            'Range': 'bytes=0-',
        },
        signal: safeTimeout(120000),
    })

    if (!dl.ok) throw new Error(`Innertube stream: HTTP ${dl.status}`)

    const buf = Buffer.from(await dl.arrayBuffer())
    fs.writeFileSync(tmpPath, buf)

    if (!fs.existsSync(tmpPath) || fs.statSync(tmpPath).size < 1000) {
        try { fs.unlinkSync(tmpPath) } catch {}
        throw new Error('Arquivo de áudio vazio')
    }

    const mimeType = ext === 'm4a' ? 'audio/mp4' : 'audio/ogg; codecs=opus'
    return { path: tmpPath, mimetype: mimeType }
}

// ── COBALT.TOOLS API ──────────────────────────────────────────────────────────

async function cobaltDownload(ytUrl, mode = 'audio') {
    if (!_fetch) throw new Error('fetch indisponível')

    for (const instance of COBALT_INSTANCES) {
        try {
            const res = await _fetch(instance, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                },
                body: JSON.stringify({
                    url: ytUrl,
                    downloadMode: mode,
                    audioFormat: 'best',
                    videoQuality: '720',
                    filenameStyle: 'basic',
                }),
                signal: safeTimeout(20000),
            })

            if (!res.ok) continue
            const data = await res.json()
            if (!data.url) continue

            const ext = mode === 'audio' ? 'mp3' : 'mp4'
            const tmpPath = path.join(os.tmpdir(), `cobalt_${Date.now()}.${ext}`)

            const dl = await _fetch(data.url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: safeTimeout(120000),
            })
            if (!dl.ok) continue

            const buf = Buffer.from(await dl.arrayBuffer())
            fs.writeFileSync(tmpPath, buf)

            if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
                return { path: tmpPath, mimetype: mode === 'audio' ? 'audio/mpeg' : 'video/mp4' }
            }
        } catch {}
    }
    throw new Error('Cobalt: todas as instâncias falharam')
}

// ── INVIDIOUS STREAM DIRETO ───────────────────────────────────────────────────

async function invidiosDownloadAudio(videoId) {
    if (!_fetch) throw new Error('fetch indisponível')

    for (const base of INVIDIOUS) {
        try {
            const res = await _fetch(
                `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`,
                { signal: safeTimeout(10000) }
            )
            if (!res.ok) continue
            const data = await res.json()

            const audioFormats = (data.adaptiveFormats || [])
                .filter(f => f.type?.startsWith('audio/') && f.url)
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

            if (!audioFormats.length) continue

            const dl = await _fetch(audioFormats[0].url, { signal: safeTimeout(120000) })
            if (!dl.ok) continue

            const tmpPath = path.join(os.tmpdir(), `inv_${Date.now()}.webm`)
            fs.writeFileSync(tmpPath, Buffer.from(await dl.arrayBuffer()))

            if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
                return { path: tmpPath, mimetype: 'audio/ogg; codecs=opus' }
            }
        } catch {}
    }
    throw new Error('Invidious: todas as instâncias falharam')
}

// ── DOWNLOAD DE ÁUDIO (com fallback em cascata) ───────────────────────────────

async function downloadAudio(url) {
    const videoId = extractVideoId(url)

    // 1️⃣ YouTube Innertube API direta (sem bloqueio, sem cipher)
    try {
        return await downloadFromInnertube(url)
    } catch (err) {
        console.error('[Innertube] Falhou:', err.message?.slice(0, 120))
    }

    // 2️⃣ cobalt.tools (API pública)
    try {
        return await cobaltDownload(url, 'audio')
    } catch (err) {
        console.error('[Cobalt] Falhou:', err.message?.slice(0, 120))
    }

    // 3️⃣ Invidious stream direto
    if (videoId) {
        try {
            return await invidiosDownloadAudio(videoId)
        } catch (err) {
            console.error('[Invidious] Falhou:', err.message?.slice(0, 120))
        }
    }

    // 4️⃣ play-dl stream (último recurso)
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
        console.error('[play-dl] Falhou:', err.message?.slice(0, 100))
    }

    throw new Error('❌ Não foi possível baixar o áudio. O YouTube pode estar temporariamente bloqueando. Tente novamente em alguns instantes.')
}

// ── DOWNLOAD DE VÍDEO ─────────────────────────────────────────────────────────

async function downloadVideo(url) {
    const videoId = extractVideoId(url)

    // 1️⃣ Innertube (formatos misturados de vídeo+áudio)
    if (videoId) {
        try {
            const streamData = await innertubeStreams(videoId)
            const formats = (streamData.formats || [])
                .filter(f => f.mimeType?.includes('video/mp4') && f.url)
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

            if (formats.length) {
                const best = formats[0]
                const tmpPath = path.join(os.tmpdir(), `innertube_video_${Date.now()}.mp4`)
                const dl = await _fetch(best.url, {
                    headers: { 'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip' },
                    signal: safeTimeout(180000),
                })
                if (dl.ok) {
                    const buf = Buffer.from(await dl.arrayBuffer())
                    fs.writeFileSync(tmpPath, buf)
                    if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
                        return { path: tmpPath, mimetype: 'video/mp4' }
                    }
                }
            }
        } catch (err) {
            console.error('[Innertube Video] Falhou:', err.message?.slice(0, 120))
        }
    }

    // 2️⃣ Cobalt
    try {
        return await cobaltDownload(url, 'auto')
    } catch (err) {
        console.error('[Cobalt Video] Falhou:', err.message?.slice(0, 120))
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
