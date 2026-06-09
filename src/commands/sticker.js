const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const config = require('../../config')

async function sticker(ctx) {
    const { sock, from, msg, reply, react, isGroup } = ctx

    let mediaMsg = msg
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const q = msg.message.extendedTextMessage.contextInfo.quotedMessage
        const qKey = msg.message.extendedTextMessage.contextInfo
        mediaMsg = {
            key: {
                remoteJid: from,
                id: qKey.stanzaId,
                participant: qKey.participant,
            },
            message: q,
        }
    }

    const mediaType = getContentType(mediaMsg.message)
    if (!['imageMessage', 'videoMessage', 'stickerMessage'].includes(mediaType)) {
        return reply('❌ Envie ou marque uma *imagem* ou *vídeo curto* junto com o comando!\nExemplo: Envie a imagem com *!sticker* na legenda.')
    }

    await react('🎨')

    const msgData = mediaMsg.message[mediaType]
    const stream = await downloadContentFromMessage(msgData, mediaType.replace('Message', ''))
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const tmpIn = path.join(os.tmpdir(), `stk_in_${Date.now()}.${mediaType === 'videoMessage' ? 'mp4' : 'jpg'}`)
    const tmpOut = path.join(os.tmpdir(), `stk_out_${Date.now()}.webp`)
    fs.writeFileSync(tmpIn, buffer)

    try {
        if (mediaType === 'videoMessage') {
            execSync(`ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15" -loop 0 -ss 0 -t 6 -y "${tmpOut}" 2>/dev/null`)
        } else {
            execSync(`ffmpeg -i "${tmpIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -y "${tmpOut}" 2>/dev/null`)
        }
    } catch {
        // tenta com sharp se ffmpeg falhar
        try {
            const sharp = require('sharp')
            await sharp(tmpIn).resize(512, 512, { fit: 'inside' }).webp().toFile(tmpOut)
        } catch {
            fs.unlinkSync(tmpIn)
            return reply('❌ Não foi possível criar a figurinha. Tente com outra imagem.')
        }
    }

    const stickerBuffer = fs.readFileSync(tmpOut)
    fs.unlinkSync(tmpIn)
    fs.unlinkSync(tmpOut)

    await sock.sendMessage(from, {
        sticker: stickerBuffer,
    }, { quoted: msg })

    await react('✅')
}

module.exports = { sticker, figurinha: sticker, s: sticker }
