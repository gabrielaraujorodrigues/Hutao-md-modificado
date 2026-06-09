const { searchYouTube, downloadAudio, downloadVideo, formatDuration, formatViews } = require('../lib/ytdl')
const fs = require('fs')

async function play(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text) return reply('❌ Informe o nome da música!\nExemplo: *!play Emicida AmarElo*')

    await react('🎵')
    await reply(`🔎 Buscando *${text}*...`)

    const info = await searchYouTube(text)

    await reply(
        `🎵 *${info.title}*\n` +
        `👤 ${info.uploader}\n` +
        `⏱ ${formatDuration(info.duration)} | 👁 ${formatViews(info.views)}\n\n` +
        `⬇️ Baixando áudio...`
    )

    const filePath = await downloadAudio(info.url)
    const stat = fs.statSync(filePath)

    if (stat.size > 60 * 1024 * 1024) {
        fs.unlinkSync(filePath)
        return reply('❌ Arquivo muito grande (acima de 60 MB). Tente uma música mais curta.')
    }

    await sock.sendMessage(from, {
        audio: fs.readFileSync(filePath),
        mimetype: 'audio/mp4',
        ptt: false,
    }, { quoted: msg })

    fs.unlinkSync(filePath)
    await react('✅')
}

async function ytmp3(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text) return reply('❌ Informe o link ou nome!\nExemplo: *!ytmp3 https://youtube.com/...*')

    await react('🎵')

    const isUrl = text.startsWith('http')
    const info = isUrl
        ? { url: text, title: 'Áudio', duration: 0, uploader: '', views: '' }
        : await searchYouTube(text)

    await reply(`⬇️ Baixando *${info.title}* em MP3...`)
    const filePath = await downloadAudio(info.url)

    await sock.sendMessage(from, {
        audio: fs.readFileSync(filePath),
        mimetype: 'audio/mp4',
        ptt: false,
    }, { quoted: msg })

    fs.unlinkSync(filePath)
    await react('✅')
}

async function ytmp4(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text) return reply('❌ Informe o link ou nome!\nExemplo: *!ytmp4 https://youtube.com/...*')

    await react('🎬')

    const isUrl = text.startsWith('http')
    const info = isUrl
        ? { url: text, title: 'Vídeo', duration: 0, uploader: '', views: '' }
        : await searchYouTube(text)

    await reply(`⬇️ Baixando *${info.title}* em MP4 (480p)...`)
    const filePath = await downloadVideo(info.url, 480)

    const stat = fs.statSync(filePath)
    if (stat.size > 60 * 1024 * 1024) {
        fs.unlinkSync(filePath)
        return reply('❌ Vídeo muito grande (acima de 60 MB). Use *!ytmp3* para áudio.')
    }

    await sock.sendMessage(from, {
        video: fs.readFileSync(filePath),
        mimetype: 'video/mp4',
        caption: `🎬 ${info.title}`,
    }, { quoted: msg })

    fs.unlinkSync(filePath)
    await react('✅')
}

async function video(ctx) {
    return ytmp4(ctx)
}

module.exports = { play, ytmp3, ytmp4, video }
