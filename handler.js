const config = require('./config')
const { getContentType, downloadContentFromMessage } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

const commands = {}
const cooldowns = new Map()

// Carrega todos os comandos da pasta src/commands
const commandsDir = path.join(__dirname, 'src/commands')
fs.readdirSync(commandsDir).forEach((file) => {
    if (!file.endsWith('.js')) return
    try {
        const mod = require(path.join(commandsDir, file))
        if (mod && typeof mod === 'object') {
            for (const [name, fn] of Object.entries(mod)) {
                if (typeof fn === 'function') {
                    commands[name.toLowerCase()] = fn
                }
            }
        }
    } catch (err) {
        console.error(`[LOAD] Erro ao carregar ${file}:`, err.message)
    }
})

console.log(`[BOT] ${Object.keys(commands).length} comandos carregados: ${Object.keys(commands).join(', ')}`)

/**
 * Desempacota containers de mensagem do WhatsApp
 */
function unwrapMessage(msg) {
    if (!msg?.message) return msg
    const m = msg.message

    const inner =
        m.ephemeralMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m.viewOnceMessageV2Extension?.message ||
        m.documentWithCaptionMessage?.message ||
        null

    if (inner) return { ...msg, message: inner }
    return msg
}

/**
 * Extrai o texto da mensagem — cobre todos os tipos do WhatsApp
 */
function extractBody(message) {
    if (!message) return ''

    // Texto puro (mensagem simples)
    if (message.conversation) return message.conversation

    // Texto com formatação / resposta / link
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text

    // Imagem/vídeo com legenda
    if (message.imageMessage?.caption) return message.imageMessage.caption
    if (message.videoMessage?.caption) return message.videoMessage.caption
    if (message.documentMessage?.caption) return message.documentMessage.caption

    // Botões
    if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId
    if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId
    if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
        return message.listResponseMessage.singleSelectReply.selectedRowId

    // Mensagem interativa (interactive flow)
    if (message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson)
        return message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson

    return ''
}

async function handleMessage(sock, rawMsg) {
    if (!rawMsg?.message) return
    if (rawMsg.key.fromMe) return

    // Filtra status/broadcast
    const remoteJid = rawMsg.key.remoteJid
    if (!remoteJid || remoteJid === 'status@broadcast') return

    // Desempacota mensagens efêmeras/viewOnce
    const msg = unwrapMessage(rawMsg)
    const from = msg.key.remoteJid

    const isGroup = from.endsWith('@g.us')
    const sender = isGroup ? (msg.key.participant || from) : from
    const senderNum = sender.replace(/[^0-9]/g, '')
    const isOwner = senderNum === config.ownerNumber.replace(/[^0-9]/g, '')

    const type = getContentType(msg.message)
    if (!type) return

    // Tipos de mensagem que nunca terão comandos (ignora silenciosamente)
    const tiposIgnorados = ['reactionMessage', 'protocolMessage', 'stickerMessage',
        'audioMessage', 'videoMessage', 'imageMessage', 'documentMessage',
        'contactMessage', 'locationMessage', 'liveLocationMessage', 'pollCreationMessage',
        'pollUpdateMessage', 'callLogMessage', 'encReactionMessage']

    if (tiposIgnorados.includes(type)) return

    const body = extractBody(msg.message).trim()

    const prefix = config.prefix
    if (!body.startsWith(prefix)) return

    const args = body.slice(prefix.length).trim().split(/\s+/)
    const command = args.shift().toLowerCase()
    if (!command) return
    const text = args.join(' ')

    // Log do comando recebido
    console.log(`[CMD] ${senderNum} → ${prefix}${command}${text ? ' ' + text : ''}`)

    // Cooldown por usuário+comando
    const cdKey = `${senderNum}:${command}`
    if (cooldowns.has(cdKey)) {
        const remaining = cooldowns.get(cdKey) - Date.now()
        if (remaining > 0) {
            await sock.sendMessage(from, {
                text: `⏳ Aguarde *${(remaining / 1000).toFixed(1)}s* antes de usar esse comando novamente.`
            }, { quoted: msg })
            return
        }
    }
    cooldowns.set(cdKey, Date.now() + config.cooldown)
    setTimeout(() => cooldowns.delete(cdKey), config.cooldown)

    const fn = commands[command]
    if (!fn) {
        console.log(`[CMD] "${command}" não encontrado`)
        return
    }

    const ctx = {
        sock,
        msg,
        from,
        sender,
        senderNum,
        isGroup,
        isOwner,
        args,
        text,
        body,
        type,
        reply: (content) => {
            if (typeof content === 'string') {
                return sock.sendMessage(from, { text: content }, { quoted: msg })
            }
            return sock.sendMessage(from, content, { quoted: msg })
        },
        react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {}),
        sendText: (t) => sock.sendMessage(from, { text: t }),
        downloadMsg: async () => {
            const msgData = msg.message[type]
            const stream = await downloadContentFromMessage(msgData, type.replace('Message', ''))
            const chunks = []
            for await (const chunk of stream) chunks.push(chunk)
            return Buffer.concat(chunks)
        },
    }

    try {
        await ctx.react('⏳')
        await fn(ctx)
    } catch (err) {
        console.error(`[ERRO] !${command}:`, err.message)
        console.error(err.stack)
        try {
            await ctx.reply(`❌ Erro ao executar *!${command}*:\n${err.message}`)
            await ctx.react('❌')
        } catch {}
    }
}

module.exports = { handleMessage, commands }
