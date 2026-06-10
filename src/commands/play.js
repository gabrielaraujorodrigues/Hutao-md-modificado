const { searchYouTube, downloadAudio, downloadVideo, formatDuration, formatViews } = require('../lib/ytdl')
const fs = require('fs')

async function play(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text) return reply('❌ Informe o nome da música!\nExemplo: *!play Emicida AmarElo*')

    await react('🎵')
    await reply(`🔎 Buscando *${text}*...`)

    const info = await searchYouTube(text)
    const ytLink = `https://www.youtube.com/watch?v=${info.id}`

    // Envia thumbnail + informações + link ANTES de baixar
    try {
        const thumb = info.thumbnail || `https://img.youtube.com/vi/${info.id}/hqdefault.jpg`
        await sock.sendMessage(from, {
            image: { url: thumb },
            caption:
                `🎵 *${info.title}*\n` +
                `👤 *Artista:* ${info.uploader}\n` +
                `⏱ *Duração:* ${formatDuration(info.duration)}\n` +
                `👁 *Views:* ${formatViews(info.views)}\n` +
                `🔗 ${ytLink}\n\n` +
                `⬇️ _Baixando áudio, aguarde..._`,
        }, { quoted: msg })
    } catch {
        await reply(
            `🎵 *${info.title}*\n` +
            `👤 ${info.uploader} | ⏱ ${formatDuration(info.duration)}\n` +
            `🔗 ${ytLink}\n\n` +
            `⬇️ _Baixando áudio, aguarde..._`
        )
    }

    const { path: filePath, mimetype } = await downloadAudio(info.url)
    const stat = fs.statSync(filePath)

    if (stat.size > 60 * 1024 * 1024) {
        fs.unlinkSync(filePath)
        return reply('❌ Arquivo muito grande (acima de 60 MB). Tente uma música mais curta.')
    }

    await sock.sendMessage(from, {
        audio: fs.readFileSync(filePath),
        mimetype,
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
        ? { id: new URL(text).searchParams.get('v') || '', url: text, title: 'Áudio', duration: 0, uploader: '', views: 0, thumbnail: '' }
        : await searchYouTube(text)

    if (!isUrl) {
        const ytLink = `https://www.youtube.com/watch?v=${info.id}`
        try {
            const thumb = info.thumbnail || `https://img.youtube.com/vi/${info.id}/hqdefault.jpg`
            await sock.sendMessage(from, {
                image: { url: thumb },
                caption: `🎵 *${info.title}*\n👤 ${info.uploader}\n🔗 ${ytLink}\n\n⬇️ _Baixando MP3..._`,
            }, { quoted: msg })
        } catch {
            await reply(`⬇️ Baixando *${info.title}* em MP3...`)
        }
    } else {
        await reply(`⬇️ Baixando áudio em MP3...`)
    }

    const { path: filePath, mimetype } = await downloadAudio(info.url)

    await sock.sendMessage(from, {
        audio: fs.readFileSync(filePath),
        mimetype,
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
        ? { id: new URL(text).searchParams.get('v') || '', url: text, title: 'Vídeo', duration: 0, uploader: '', views: 0, thumbnail: '' }
        : await searchYouTube(text)

    if (!isUrl) {
        const ytLink = `https://www.youtube.com/watch?v=${info.id}`
        try {
            const thumb = info.thumbnail || `https://img.youtube.com/vi/${info.id}/hqdefault.jpg`
            await sock.sendMessage(from, {
                image: { url: thumb },
                caption: `🎬 *${info.title}*\n👤 ${info.uploader}\n🔗 ${ytLink}\n\n⬇️ _Baixando vídeo..._`,
            }, { quoted: msg })
        } catch {
            await reply(`⬇️ Baixando *${info.title}* em vídeo...`)
        }
    } else {
        await reply(`⬇️ Baixando vídeo...`)
    }

    const { path: filePath, mimetype } = await downloadVideo(info.url, 480)

    const stat = fs.statSync(filePath)
    if (stat.size > 60 * 1024 * 1024) {
        fs.unlinkSync(filePath)
        return reply('❌ Vídeo muito grande (acima de 60 MB). Use *!ytmp3* para baixar só o áudio.')
    }

    await sock.sendMessage(from, {
        video: fs.readFileSync(filePath),
        mimetype,
        caption: `🎬 ${info.title}`,
    }, { quoted: msg })

    fs.unlinkSync(filePath)
    await react('✅')
}

async function video(ctx) {
    return ytmp4(ctx)
}

module.exports = { play, ytmp3, ytmp4, video }
