const ytDlpExec = require('yt-dlp-exec')
const path = require('path')
const fs = require('fs')
const os = require('os')

const tmpDir = os.tmpdir()

async function searchYouTube(query) {
    const result = await ytDlpExec(`ytsearch1:${query}`, {
        dumpSingleJson: true,
        noPlaylist: true,
        noWarnings: true,
        quiet: true,
    })
    if (!result || !result.id) throw new Error('Nenhum resultado encontrado.')
    return {
        id: result.id,
        title: result.title,
        duration: result.duration,
        url: result.webpage_url || `https://www.youtube.com/watch?v=${result.id}`,
        thumbnail: result.thumbnail,
        uploader: result.uploader,
        views: result.view_count,
    }
}

async function downloadAudio(url) {
    const out = path.join(tmpDir, `yt_audio_${Date.now()}.mp3`)
    await ytDlpExec(url, {
        output: out,
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: '128K',
        noPlaylist: true,
        noWarnings: true,
        quiet: true,
    })
    if (!fs.existsSync(out)) throw new Error('Falha ao baixar áudio.')
    return out
}

async function downloadVideo(url, maxHeight = 480) {
    const out = path.join(tmpDir, `yt_video_${Date.now()}.mp4`)
    await ytDlpExec(url, {
        output: out,
        format: `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${maxHeight}][ext=mp4]/best[ext=mp4]/best`,
        mergeOutputFormat: 'mp4',
        noPlaylist: true,
        noWarnings: true,
        quiet: true,
    })
    if (!fs.existsSync(out)) throw new Error('Falha ao baixar vídeo.')
    return out
}

async function downloadGeneric(url) {
    const out = path.join(tmpDir, `dl_${Date.now()}.mp4`)
    await ytDlpExec(url, {
        output: out,
        format: 'best[ext=mp4]/best',
        noPlaylist: true,
        noWarnings: true,
        quiet: true,
    })
    if (!fs.existsSync(out)) throw new Error('Falha ao baixar.')
    return out
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

module.exports = { searchYouTube, downloadAudio, downloadVideo, downloadGeneric, formatDuration, formatViews }
