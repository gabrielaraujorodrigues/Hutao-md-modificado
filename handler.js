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
 * Desempacota containers de mensagem do WhatsApp:
 * ephemeralMessage, viewOnceMessage, documentWithCaptionMessage, etc.
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
        m.newsletterAdminInviteMessage ||
        null

    if (inner) return { ...msg, message: inner }
    return msg
}

/**
 * Extrai o texto da mensagem independente do tipo.
 */
function extractBody(message) {
    if (!message) return ''
    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedButtonId ||
        message.templateButtonReplyMessage?.selectedId ||
        message.listResponseMessage?.singleSelectReply?.selectedRowId ||
        message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
        ''
    )
}

async function handleMessage(sock, rawMsg) {
    if (!rawMsg?.message) return
    if (rawMsg.key.fromMe) return

    // Desempacota mensagens efêmeras/viewOnce
    const msg = unwrapMessage(rawMsg)

    const from = msg.key.remoteJid
    if (!from || from === 'status@broadcast') return

    const isGroup = from.endsWith('@g.us')
    const sender = isGroup ? (msg.key.participant || '') : from
    const senderNum = sender.replace(/[^0-9]/g, '')
    const isOwner = senderNum === config.ownerNumber.replace(/[^0-9]/g, '')

    const type = getContentType(msg.message)
    if (!type) return

    const body = extractBody(msg.message)

    const prefix = config.prefix
    if (!body.startsWith(prefix)) return

    const args = body.slice(prefix.length).trim().split(/\s+/)
    const command = args.shift().toLowerCase()
    if (!command) return
    const text = args.join(' ')

    // Log de debug (útil pra ver se os comandos chegam)
    console.log(`[CMD] ${senderNum} → !${command} ${text}`.slice(0, 120))

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
        // Comando não existe — silêncioso, não responde
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
        try {
            await ctx.reply(`❌ Erro ao executar *!${command}*:\n${err.message}`)
            await ctx.react('❌')
        } catch {}
    }
}

module.exports = { handleMessage, commands }
