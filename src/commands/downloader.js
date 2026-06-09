const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Baixa um buffer de uma URL
async function downloadBuffer(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 60000,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.buffer()
}

async function tiktok(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do TikTok!\nExemplo: *!tiktok https://vm.tiktok.com/...*')

    await react('⬇️')
    await reply('⬇️ Baixando vídeo do TikTok...')

    try {
        // API sem marca d'água
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`
        const res = await fetch(apiUrl, { timeout: 20000 })
        const data = await res.json()

        if (!data.data?.play) throw new Error('Vídeo não encontrado.')

        const buffer = await downloadBuffer(data.data.play)
        await sock.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: `🎵 ${data.data.title || 'TikTok'}`,
        }, { quoted: msg })
        await react('✅')
    } catch (err) {
        await reply(`❌ Erro ao baixar TikTok: ${err.message}`)
        await react('❌')
    }
}

async function instagram(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Instagram!\nExemplo: *!instagram https://www.instagram.com/p/...*')

    await react('📸')
    await reply('⬇️ Baixando do Instagram...')

    try {
        const apiUrl = `https://api.snapinsta.app/v2?url=${encodeURIComponent(text)}`
        const res = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
            },
            timeout: 30000,
        })
        const data = await res.json()
        const mediaUrl = data?.data?.[0]?.url || data?.url || data?.media?.[0]

        if (!mediaUrl) throw new Error('Mídia não encontrada. Verifique se o perfil é público.')

        const buffer = await downloadBuffer(mediaUrl)
        const isVideo = mediaUrl.includes('.mp4') || data?.data?.[0]?.type === 'video'

        if (isVideo) {
            await sock.sendMessage(from, {
                video: buffer, mimetype: 'video/mp4', caption: '📸 Instagram',
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                image: buffer, caption: '📸 Instagram',
            }, { quoted: msg })
        }
        await react('✅')
    } catch (err) {
        await reply(`❌ Erro ao baixar Instagram: ${err.message}`)
        await react('❌')
    }
}

async function threads(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Threads!\nExemplo: *!threads https://www.threads.net/...*')

    await react('⬇️')
    await reply('⬇️ Baixando do Threads...')

    try {
        const apiUrl = `https://threadsdl.com/api?url=${encodeURIComponent(text)}`
        const res = await fetch(apiUrl, { timeout: 20000 })
        const data = await res.json()
        const mediaUrl = data?.data?.video_url || data?.data?.image_url || data?.url

        if (!mediaUrl) throw new Error('Mídia não encontrada.')

        const buffer = await downloadBuffer(mediaUrl)
        const isVideo = mediaUrl.includes('.mp4') || data?.data?.video_url

        if (isVideo) {
            await sock.sendMessage(from, {
                video: buffer, mimetype: 'video/mp4', caption: '🧵 Threads',
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                image: buffer, caption: '🧵 Threads',
            }, { quoted: msg })
        }
        await react('✅')
    } catch (err) {
        await reply(`❌ Erro ao baixar Threads: ${err.message}`)
        await react('❌')
    }
}

async function twitter(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Twitter/X!\nExemplo: *!twitter https://twitter.com/...*')

    await react('⬇️')
    await reply('⬇️ Baixando do Twitter/X...')

    try {
        const apiUrl = `https://twitsave.com/info?url=${encodeURIComponent(text)}`
        const res = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 20000,
        })
        const data = await res.json()
        const mediaUrl = data?.data?.[0]?.url || data?.url

        if (!mediaUrl) throw new Error('Vídeo não encontrado.')

        const buffer = await downloadBuffer(mediaUrl)
        await sock.sendMessage(from, {
            video: buffer, mimetype: 'video/mp4', caption: '🐦 Twitter/X',
        }, { quoted: msg })
        await react('✅')
    } catch (err) {
        await reply(`❌ Erro ao baixar Twitter: ${err.message}`)
        await react('❌')
    }
}

async function pinterest(ctx) {
    const { reply, react, sock, from, msg, text } = ctx
    if (!text || !text.startsWith('http')) return reply('❌ Informe o link do Pinterest!\nExemplo: *!pinterest https://pin.it/...*')

    await react('📌')
    await reply('⬇️ Baixando do Pinterest...')

    try {
        const apiUrl = `https://api.pinterestdownloader.com/download?url=${encodeURIComponent(text)}`
        const res = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 20000,
        })
        const data = await res.json()
        const mediaUrl = data?.data?.video_url || data?.data?.image_url || data?.url

        if (!mediaUrl) throw new Error('Mídia não encontrada.')

        const buffer = await downloadBuffer(mediaUrl)
        const isVideo = mediaUrl.includes('.mp4') || data?.data?.video_url

        if (isVideo) {
            await sock.sendMessage(from, {
                video: buffer, mimetype: 'video/mp4', caption: '📌 Pinterest',
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                image: buffer, caption: '📌 Pinterest',
            }, { quoted: msg })
        }
        await react('✅')
    } catch (err) {
        await reply(`❌ Erro ao baixar Pinterest: ${err.message}`)
        await react('❌')
    }
}

module.exports = { tiktok, instagram, ig: instagram, threads, twitter, pinterest }
