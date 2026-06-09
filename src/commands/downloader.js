const { downloadGeneric } = require('../lib/ytdl')
const ytDlpExec = require('yt-dlp-exec')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function tiktok(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do TikTok!\nExemplo: *!tiktok https://vm.tiktok.com/...*')

    await react('⬇️')
    await reply('⬇️ Baixando vídeo do TikTok...')

    const out = path.join(os.tmpdir(), `tiktok_${Date.now()}.mp4`)
    await ytDlpExec(text, {
        output: out,
        format: 'best[ext=mp4]/best',
        noPlaylist: true,
        quiet: true,
    })

    if (!fs.existsSync(out)) return reply('❌ Não foi possível baixar o vídeo.')

    await sock.sendMessage(from, {
        video: fs.readFileSync(out),
        mimetype: 'video/mp4',
        caption: '🎵 TikTok',
    }, { quoted: msg })

    fs.unlinkSync(out)
    await react('✅')
}

async function instagram(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Instagram!\nExemplo: *!instagram https://www.instagram.com/p/...*')

    await react('📸')
    await reply('⬇️ Baixando do Instagram...')

    const out = path.join(os.tmpdir(), `ig_${Date.now()}.mp4`)
    await ytDlpExec(text, {
        output: out,
        format: 'best[ext=mp4]/best',
        noPlaylist: true,
        quiet: true,
    })

    if (!fs.existsSync(out)) return reply('❌ Não foi possível baixar. Verifique se o perfil é público.')

    const stat = fs.statSync(out)
    if (stat.size > 60 * 1024 * 1024) {
        fs.unlinkSync(out)
        return reply('❌ Arquivo muito grande para enviar.')
    }

    await sock.sendMessage(from, {
        video: fs.readFileSync(out),
        mimetype: 'video/mp4',
        caption: '📸 Instagram',
    }, { quoted: msg })

    fs.unlinkSync(out)
    await react('✅')
}

async function threads(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Threads!\nExemplo: *!threads https://www.threads.net/...*')

    await react('⬇️')
    await reply('⬇️ Baixando do Threads...')

    const out = path.join(os.tmpdir(), `threads_${Date.now()}.mp4`)
    await ytDlpExec(text, {
        output: out,
        format: 'best[ext=mp4]/best',
        noPlaylist: true,
        quiet: true,
    })

    if (!fs.existsSync(out)) return reply('❌ Não foi possível baixar o conteúdo.')

    await sock.sendMessage(from, {
        video: fs.readFileSync(out),
        mimetype: 'video/mp4',
        caption: '🧵 Threads',
    }, { quoted: msg })

    fs.unlinkSync(out)
    await react('✅')
}

async function twitter(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Twitter/X!\nExemplo: *!twitter https://twitter.com/...*')

    await react('⬇️')
    await reply('⬇️ Baixando do Twitter/X...')

    const out = path.join(os.tmpdir(), `twitter_${Date.now()}.mp4`)
    await ytDlpExec(text, {
        output: out,
        format: 'best[ext=mp4]/best',
        noPlaylist: true,
        quiet: true,
    })

    if (!fs.existsSync(out)) return reply('❌ Não foi possível baixar o vídeo.')

    await sock.sendMessage(from, {
        video: fs.readFileSync(out),
        mimetype: 'video/mp4',
        caption: '🐦 Twitter/X',
    }, { quoted: msg })

    fs.unlinkSync(out)
    await react('✅')
}

async function pinterest(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Pinterest!\nExemplo: *!pinterest https://pin.it/...*')

    await react('📌')
    await reply('⬇️ Baixando do Pinterest...')

    const out = path.join(os.tmpdir(), `pinterest_${Date.now()}.mp4`)
    await ytDlpExec(text, {
        output: out,
        format: 'best[ext=mp4]/best/best[ext=jpg]/best[ext=png]',
        noPlaylist: true,
        quiet: true,
    })

    if (!fs.existsSync(out)) return reply('❌ Não foi possível baixar o conteúdo.')

    await sock.sendMessage(from, {
        video: fs.readFileSync(out),
        mimetype: 'video/mp4',
        caption: '📌 Pinterest',
    }, { quoted: msg })

    fs.unlinkSync(out)
    await react('✅')
}

module.exports = { tiktok, instagram, ig: instagram, threads, twitter, pinterest }
