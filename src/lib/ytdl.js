/**
 * ytdl.js — download de áudio/vídeo do YouTube sem yt-dlp nem ffmpeg
 *
 * Métodos em cascata:
 *  1. @distube/ytdl-core  — pacote Node.js que decifra o YouTube internamente
 *  2. play-dl stream      — fallback leve
 *
 * Busca:
 *  1. @distube/ytdl-core search (via getInfo por URL)
 *  2. play-dl search
 *  3. Invidious search API (vários servidores)
 */

const ytdl   = require('@distube/ytdl-core')
const playdl = require('play-dl')
const fs     = require('fs')
const path   = require('path')
const os     = require('os')

const _fetch = (() => {
    if (typeof fetch === 'function') return fetch
    try { return require('node-fetch') } catch { return null }
})()

const INVIDIOUS = [
    'https://iv.datura.network',
    'https://invidious.privacyredirect.com',
    'https://yewtu.be',
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
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

// ── BUSCA ─────────────────────────────────────────────────────────────────────

async function searchYouTube(query) {
    // Método 1: play-dl (mais rápido)
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

    throw new Error('Nenhum resultado encontrado. Tente um termo diferente.')
}

// ── DOWNLOAD DE ÁUDIO ─────────────────────────────────────────────────────────

async function downloadAudio(url) {
    const tmpBase = path.join(os.tmpdir(), `yt_audio_${Date.now()}`)

    // Método 1: @distube/ytdl-core
    // Lida com cipher/deobfuscation internamente — o mais confiável em Node.js puro
    try {
        // Verifica se o vídeo é acessível
        if (!ytdl.validateURL(url)) throw new Error('URL inválida')

        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'pt-BR,pt;q=0.9',
                },
            },
        })

        // Ordena por bitrate — pega o melhor áudio
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
            .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))

        if (!audioFormats.length) throw new Error('Nenhum formato de áudio disponível')

        const fmt = audioFormats[0]
        const ext = fmt.container || 'webm'
        const tmpPath = `${tmpBase}.${ext}`
        const mimeType = fmt.mimeType?.split(';')[0] || 'audio/webm'

        await new Promise((resolve, reject) => {
            const stream = ytdl.downloadFromInfo(info, { format: fmt })
            const out = fs.createWriteStream(tmpPath)
            stream.pipe(out)
            stream.on('error', reject)
            out.on('finish', resolve)
            out.on('error', reject)
        })

        if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1000) {
            return { path: tmpPath, mimetype: mimeType }
        }
        throw new Error('Arquivo muito pequeno')
    } catch (err) {
        console.error('[ytdl-core] Falhou:', err.message?.slice(0, 150))
    }

    // Método 2: play-dl stream
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

    throw new Error('❌ Não foi possível baixar o áudio. Verifique se o vídeo está disponível no Brasil e tente novamente.')
}

// ── DOWNLOAD DE VÍDEO ─────────────────────────────────────────────────────────

async function downloadVideo(url) {
    const tmpBase = path.join(os.tmpdir(), `yt_video_${Date.now()}`)

    // @distube/ytdl-core — formato misto (vídeo+áudio no mesmo container)
    try {
        if (!ytdl.validateURL(url)) throw new Error('URL inválida')

        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            },
        })

        // Formatos com vídeo + áudio juntos (mp4), ordenados por resolução
        const mixedFormats = ytdl.filterFormats(info.formats, 'videoandaudio')
            .filter(f => f.container === 'mp4')
            .sort((a, b) => (b.height || 0) - (a.height || 0))

        if (!mixedFormats.length) throw new Error('Nenhum formato mp4 disponível')

        // Limita a 480p para não esourar os 60 MB
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
        throw new Error('Arquivo vazio')
    } catch (err) {
        console.error('[ytdl-core video] Falhou:', err.message?.slice(0, 150))
    }

    throw new Error('❌ Não foi possível baixar o vídeo. Tente novamente.')
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
