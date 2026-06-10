const playdl = require('play-dl')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

// Usa fetch global (Node 18+) ou node-fetch como fallback
const _fetch = typeof fetch !== 'undefined' ? fetch : (() => {
    try { return require('node-fetch') } catch { return null }
})()

// Instâncias Invidious (frontend open-source do YouTube, sem bloqueio de bot)
const INVIDIOUS = [
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
    'https://yewtu.be',
    'https://invidious.nerdvpn.de',
]

function hasFfmpeg() {
    try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true } catch { return false }
}

function hasYtdlp() {
    try { execSync('yt-dlp --version', { stdio: 'ignore' }); return true } catch { return false }
}

function extractVideoId(url) {
    try {
        const u = new URL(url)
        return u.searchParams.get('v') || u.pathname.split('/').pop()
    } catch {
        return null
    }
}

// ── BUSCA ────────────────────────────────────────────────────────────────────

async function searchYouTube(query) {
    // Método 1: play-dl (rápido quando não está bloqueado)
    try {
        const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 })
        const v = results?.[0]
        if (v) {
            // Em algumas versões v.url pode vir undefined; constrói pelo id
            const url = v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : null)
            if (url) return {
                id: v.id,
                title: v.title || 'Sem título',
                duration: v.durationInSec || 0,
                url,
                thumbnail: v.thumbnails?.[0]?.url || '',
                uploader: v.channel?.name || 'Desconhecido',
                views: v.views || 0,
            }
        }
    } catch {}

    // Método 2: Invidious API (não é afetado pelo bloqueio do YouTube)
    if (_fetch) {
        for (const base of INVIDIOUS) {
            try {
                const res = await _fetch(
                    `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,lengthSeconds,viewCount`,
                    { signal: AbortSignal.timeout(8000) }
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
                    thumbnail: '',
                    uploader: v.author || 'Desconhecido',
                    views: v.viewCount || 0,
                }
            } catch {}
        }
    }

    // Método 3: yt-dlp --dump-json (se instalado)
    if (hasYtdlp()) {
        try {
            const out = execSync(
                `yt-dlp "ytsearch1:${query.replace(/"/g, '')}" --dump-json --no-playlist --quiet 2>/dev/null`,
                { timeout: 30000, encoding: 'utf8' }
            )
            const data = JSON.parse(out.trim().split('\n')[0])
            if (data?.webpage_url) return {
                id: data.id,
                title: data.title || 'Sem título',
                duration: data.duration || 0,
                url: data.webpage_url,
                thumbnail: data.thumbnail || '',
                uploader: data.uploader || 'Desconhecido',
                views: data.view_count || 0,
            }
        } catch {}
    }

    throw new Error('Nenhum resultado encontrado no YouTube.')
}

// ── DOWNLOAD DE ÁUDIO ─────────────────────────────────────────────────────────

async function downloadAudio(url) {
    const videoId = extractVideoId(url)
    const tmpBase = path.join(os.tmpdir(), `yt_audio_${Date.now()}`)

    // Método 1: yt-dlp (mais confiável, burla qualquer bloqueio)
    if (hasYtdlp()) {
        try {
            const outTemplate = tmpBase + '.%(ext)s'
            execSync(
                `yt-dlp -x --audio-format mp3 --audio-quality 3 -o "${outTemplate}" --no-playlist "${url}" 2>&1`,
                { timeout: 120000 }
            )
            const mp3 = tmpBase + '.mp3'
            if (fs.existsSync(mp3)) return { path: mp3, mimetype: 'audio/mpeg' }
            // Tenta encontrar qualquer arquivo gerado com esse prefixo
            const dir = os.tmpdir()
            const base = path.basename(tmpBase)
            const found = fs.readdirSync(dir).find(f => f.startsWith(base))
            if (found) return { path: path.join(dir, found), mimetype: 'audio/mpeg' }
        } catch (err) {
            console.error('[YTDLP] Erro:', err.message?.slice(0, 200))
        }
    }

    // Método 2: Invidious API (não usa servidores do YouTube diretamente)
    if (_fetch && videoId) {
        for (const base of INVIDIOUS) {
            try {
                const res = await _fetch(
                    `${base}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`,
                    { signal: AbortSignal.timeout(10000) }
                )
                if (!res.ok) continue
                const data = await res.json()

                // Pega o melhor formato de áudio disponível
                const audioFormats = (data.adaptiveFormats || [])
                    .filter(f => f.type?.startsWith('audio/'))
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

                const audioUrl = audioFormats[0]?.url
                if (!audioUrl) continue

                const dl = await _fetch(audioUrl, { signal: AbortSignal.timeout(60000) })
                if (!dl.ok) continue

                const rawPath = tmpBase + '.webm'
                const buf = Buffer.from(await dl.arrayBuffer())
                fs.writeFileSync(rawPath, buf)

                if (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 1000) {
                    try { fs.unlinkSync(rawPath) } catch {}
                    continue
                }

                if (hasFfmpeg()) {
                    const mp3Path = tmpBase + '.mp3'
                    try {
                        execSync(
                            `ffmpeg -i "${rawPath}" -vn -acodec libmp3lame -q:a 3 -y "${mp3Path}" 2>/dev/null`,
                            { timeout: 60000 }
                        )
                        try { fs.unlinkSync(rawPath) } catch {}
                        if (fs.existsSync(mp3Path)) return { path: mp3Path, mimetype: 'audio/mpeg' }
                    } catch {}
                }

                return { path: rawPath, mimetype: 'audio/ogg; codecs=opus' }
            } catch {}
        }
    }

    // Método 3: play-dl (último recurso)
    const streamData = await playdl.stream(url, { quality: 1 })
    const rawPath = tmpBase + '.webm'
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(rawPath)
        streamData.stream.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
    })
    if (!fs.existsSync(rawPath)) throw new Error('Falha ao baixar o áudio.')

    if (hasFfmpeg()) {
        const mp3Path = tmpBase + '.mp3'
        try {
            execSync(`ffmpeg -i "${rawPath}" -vn -acodec libmp3lame -q:a 3 -y "${mp3Path}" 2>/dev/null`, { timeout: 60000 })
            try { fs.unlinkSync(rawPath) } catch {}
            return { path: mp3Path, mimetype: 'audio/mpeg' }
        } catch {}
    }
    return { path: rawPath, mimetype: 'audio/ogg; codecs=opus' }
}

// ── DOWNLOAD DE VÍDEO ─────────────────────────────────────────────────────────

async function downloadVideo(url, maxHeight = 480) {
    const tmpBase = path.join(os.tmpdir(), `yt_video_${Date.now()}`)

    // Método 1: yt-dlp
    if (hasYtdlp()) {
        try {
            const format = maxHeight <= 360
                ? `bestvideo[height<=360]+bestaudio/best[height<=360]`
                : `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`
            const outTemplate = tmpBase + '.%(ext)s'
            execSync(
                `yt-dlp -f "${format}" --merge-output-format mp4 -o "${outTemplate}" --no-playlist "${url}" 2>&1`,
                { timeout: 180000 }
            )
            const mp4 = tmpBase + '.mp4'
            if (fs.existsSync(mp4)) return { path: mp4, mimetype: 'video/mp4' }
            const dir = os.tmpdir()
            const base = path.basename(tmpBase)
            const found = fs.readdirSync(dir).find(f => f.startsWith(base))
            if (found) return { path: path.join(dir, found), mimetype: 'video/mp4' }
        } catch (err) {
            console.error('[YTDLP] Erro vídeo:', err.message?.slice(0, 200))
        }
    }

    // Método 2: play-dl
    const streamData = await playdl.stream(url, { quality: maxHeight <= 360 ? 2 : 1 })
    const rawPath = tmpBase + '.webm'
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(rawPath)
        streamData.stream.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
    })
    if (!fs.existsSync(rawPath)) throw new Error('Falha ao baixar o vídeo.')

    if (hasFfmpeg()) {
        const mp4Path = tmpBase + '.mp4'
        try {
            execSync(`ffmpeg -i "${rawPath}" -c:v libx264 -c:a aac -movflags +faststart -y "${mp4Path}" 2>/dev/null`, { timeout: 120000 })
            try { fs.unlinkSync(rawPath) } catch {}
            return { path: mp4Path, mimetype: 'video/mp4' }
        } catch {}
    }
    return { path: rawPath, mimetype: 'video/webm' }
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
