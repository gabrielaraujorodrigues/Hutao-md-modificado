const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

function hasFfmpeg() {
    try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true } catch { return false }
}

function hasSharp() {
    try { require('sharp'); return true } catch { return false }
}

async function toWebp(inputPath, isVideo) {
    const outPath = inputPath.replace(/\.[^.]+$/, '.webp')

    if (hasFfmpeg()) {
        if (isVideo) {
            execSync(
                `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15" -loop 0 -t 6 -y "${outPath}" 2>/dev/null`,
                { timeout: 30000 }
            )
        } else {
            execSync(
                `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -y "${outPath}" 2>/dev/null`,
                { timeout: 15000 }
            )
        }
        return outPath
    }

    if (!isVideo && hasSharp()) {
        const sharp = require('sharp')
        await sharp(inputPath)
            .resize(512, 512, { fit: 'inside' })
            .webp({ quality: 80 })
            .toFile(outPath)
        return outPath
    }

    throw new Error(
        'Para criar figurinhas, instale o *ffmpeg* no servidor.\n' +
        'No Termux: `pkg install ffmpeg`'
    )
}

async function sticker(ctx) {
    const { sock, from, msg, reply, react } = ctx

    let mediaMsg = msg

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
    const tmpOut = tmpIn.replace(`.${ext}`, '.webp')

    fs.writeFileSync(tmpIn, buffer)

    try {
        await toWebp(tmpIn, mediaType === 'videoMessage')

        if (!fs.existsSync(tmpOut)) throw new Error('Falha ao gerar WebP.')

        const stickerBuffer = fs.readFileSync(tmpOut)
        fs.unlinkSync(tmpIn)
        fs.unlinkSync(tmpOut)

        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })
        await react('✅')
    } catch (err) {
        if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)
        await reply(`❌ ${err.message}`)
        await react('❌')
    }
}

module.exports = { sticker, figurinha: sticker, s: sticker }
