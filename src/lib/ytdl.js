const { Innertube } = require('youtubei.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

let yt = null

async function getYT() {
    if (!yt) {
        yt = await Innertube.create({ cache: false, generate_session_locally: true })
    }
    return yt
}

async function searchYouTube(query) {
    const client = await getYT()
    const results = await client.search(query, { type: 'video' })
    const video = results.videos?.[0]
    if (!video) throw new Error('Nenhum resultado encontrado.')
    return {
        id: video.id,
        title: video.title?.text || 'Sem título',
        duration: video.duration?.seconds || 0,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnail: video.thumbnails?.[0]?.url || '',
        uploader: video.author?.name || 'Desconhecido',
        views: video.view_count?.text || '0',
    }
}

async function downloadAudio(url) {
    const client = await getYT()
    const id = extractId(url)
    const info = await client.getInfo(id)

    const format = info.streaming_data?.adaptive_formats
        ?.filter(f => f.has_audio && !f.has_video)
        ?.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))?.[0]

    if (!format) throw new Error('Formato de áudio não encontrado.')

    const outPath = path.join(os.tmpdir(), `yt_audio_${Date.now()}.mp3`)
    const stream = await client.download(id, {
        type: 'audio',
        quality: 'best',
        format: 'mp4',
    })

    await writeStream(stream, outPath)
    return outPath
}

async function downloadVideo(url, maxHeight = 480) {
    const client = await getYT()
    const id = extractId(url)

    const outPath = path.join(os.tmpdir(), `yt_video_${Date.now()}.mp4`)
    const stream = await client.download(id, {
        type: 'video+audio',
        quality: `${maxHeight}p`,
        format: 'mp4',
    })

    await writeStream(stream, outPath)
    return outPath
}

function extractId(url) {
    if (!url.includes('http')) return url
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (match) return match[1]
    throw new Error('Link do YouTube inválido.')
}

async function writeStream(stream, outPath) {
    const { Readable } = require('stream')
    const chunks = []
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    const buffer = Buffer.concat(chunks)
    fs.writeFileSync(outPath, buffer)
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
        throw new Error('Falha ao salvar o arquivo de mídia.')
    }
}

function formatDuration(seconds) {
    if (!seconds) return 'Ao vivo'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

function formatViews(text) {
    return text || '0'
}

module.exports = { searchYouTube, downloadAudio, downloadVideo, formatDuration, formatViews }
