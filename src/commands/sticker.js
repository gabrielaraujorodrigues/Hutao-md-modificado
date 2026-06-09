const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const os = require('os')

async function sticker(ctx) {
    const { sock, from, msg, reply, react } = ctx

    let mediaMsg = msg

    // Se for resposta a outra mensagem
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const q = msg.message.extendedTextMessage.contextInfo.quotedMessage
        const qCtx = msg.message.extendedTextMessage.contextInfo
        mediaMsg = {
            key: { remoteJid: from, id: qCtx.stanzaId, participant: qCtx.participant },
            message: q,
        }
    }

    const mediaType = getContentType(mediaMsg.message)

    if (!['imageMessage', 'videoMessage', 'stickerMessage'].includes(mediaType)) {
        return reply(
            '❌ *Como usar:*\n' +
            '• Envie uma imagem com *!sticker* na legenda\n' +
            '• Ou responda uma imagem/vídeo com *!sticker*'
        )
    }

    await react('🎨')

    const msgData = mediaMsg.message[mediaType]
    const stream = await downloadContentFromMessage(msgData, mediaType.replace('Message', ''))
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const ext = mediaType === 'videoMessage' ? 'mp4' : 'jpg'
    const tmpIn = path.join(os.tmpdir(), `stk_in_${Date.now()}.${ext}`)
    const tmpOut = path.join(os.tmpdir(), `stk_out_${Date.now()}.webp`)

    fs.writeFileSync(tmpIn, buffer)

    try {
        // Tenta converter com ffmpeg
        const { execSync } = require('child_process')
        if (mediaType === 'videoMessage') {
            execSync(
                `ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15" -loop 0 -ss 0 -t 6 -y "${tmpOut}" 2>/dev/null`,
                { timeout: 30000 }
            )
        } else {
            execSync(
                `ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -y "${tmpOut}" 2>/dev/null`,
                { timeout: 15000 }
            )
        }
    } catch {
        // Fallback: usa sharp (pura JS, sem ffmpeg)
        try {
            const sharp = require('sharp')
            await sharp(tmpIn)
                .resize(512, 512, { fit: 'inside' })
                .webp({ quality: 80 })
                .toFile(tmpOut)
        } catch (sharpErr) {
            if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
            return reply(`❌ Não foi possível criar a figurinha.\nInstale o ffmpeg para melhor suporte: *pkg install ffmpeg*`)
        }
    }

    if (!fs.existsSync(tmpOut)) {
        if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
        return reply('❌ Falha ao gerar a figurinha.')
    }

    const stickerBuffer = fs.readFileSync(tmpOut)
    if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)

    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })
    await react('✅')
}

module.exports = { sticker, figurinha: sticker, s: sticker }
