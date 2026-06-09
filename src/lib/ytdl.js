const playdl = require('play-dl')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

function hasFfmpeg() {
    try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true } catch { return false }
}

async function searchYouTube(query) {
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 })
    const video = results[0]
    if (!video) throw new Error('Nenhum resultado encontrado.')
    return {
        id: video.id,
        title: video.title || 'Sem título',
        duration: video.durationInSec || 0,
        url: video.url,
        thumbnail: video.thumbnails?.[0]?.url || '',
        uploader: video.channel?.name || 'Desconhecido',
        views: video.views || 0,
    }
}

async function downloadAudio(url) {
    const streamData = await playdl.stream(url, { quality: 1 })
    const rawPath = path.join(os.tmpdir(), `yt_raw_${Date.now()}.webm`)

    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(rawPath)
        streamData.stream.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
    })

    if (!fs.existsSync(rawPath)) throw new Error('Falha ao baixar o áudio.')

    // Tenta converter para MP3 com ffmpeg
    if (hasFfmpeg()) {
        const mp3Path = rawPath.replace('.webm', '.mp3')
        try {
            execSync(`ffmpeg -i "${rawPath}" -vn -acodec libmp3lame -q:a 3 -y "${mp3Path}" 2>/dev/null`, { timeout: 60000 })
            fs.unlinkSync(rawPath)
            return { path: mp3Path, mimetype: 'audio/mpeg' }
        } catch {
            // Se ffmpeg falhou na conversão, usa o webm mesmo
        }
    }

    // Sem ffmpeg: retorna ogg/opus (WhatsApp aceita)
    return { path: rawPath, mimetype: 'audio/ogg; codecs=opus' }
}

async function downloadVideo(url, maxHeight = 480) {
    const streamData = await playdl.stream(url, {
        quality: maxHeight <= 360 ? 2 : 1,
    })
    const rawPath = path.join(os.tmpdir(), `yt_video_${Date.now()}.webm`)

    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(rawPath)
        streamData.stream.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
    })

    if (!fs.existsSync(rawPath)) throw new Error('Falha ao baixar o vídeo.')

    // Converte para mp4 com ffmpeg
    if (hasFfmpeg()) {
        const mp4Path = rawPath.replace('.webm', '.mp4')
        try {
            execSync(`ffmpeg -i "${rawPath}" -c:v libx264 -c:a aac -movflags +faststart -y "${mp4Path}" 2>/dev/null`, { timeout: 120000 })
            fs.unlinkSync(rawPath)
            return { path: mp4Path, mimetype: 'video/mp4' }
        } catch {}
    }

    return { path: rawPath, mimetype: 'video/webm' }
}

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
