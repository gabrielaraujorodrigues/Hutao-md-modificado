const config = require('./config')
const { getContentType, downloadContentFromMessage } = require('@whiskeysockets/baileys')
const fs = require('fs')
const path = require('path')

const commands = {}
const cooldowns = new Map()

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Carrega todos os comandos da pasta src/commands
const commandsDir = path.join(__dirname, 'src/commands')
fs.readdirSync(commandsDir).forEach((file) => {
    if (!file.endsWith('.js')) return
    try {
        const mod = require(path.join(commandsDir, file))
        if (mod && typeof mod === 'object') {
            for (const [name, fn] of Object.entries(mod)) {
                if (typeof fn === 'function') commands[name.toLowerCase()] = fn
            }
        }
    } catch (err) {
        console.error(`[LOAD] Erro ao carregar ${file}:`, err.message)
    }
})

console.log(`[BOT] ${Object.keys(commands).length} comandos carregados: ${Object.keys(commands).join(', ')}`)

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

function extractBody(message) {
    if (!message) return ''
    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.ephemeralMessage?.message?.conversation ||
        message.ephemeralMessage?.message?.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.buttonsResponseMessage?.selectedButtonId ||
        message.templateButtonReplyMessage?.selectedId ||
        message.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    )
}

// Simula digitação para parecer mais humano e evitar ban
async function simulateTyping(sock, from, ms = null) {
    try {
        await sock.sendPresenceUpdate('composing', from)
        await sleep(ms || (800 + Math.random() * 1200))
        await sock.sendPresenceUpdate('paused', from)
    } catch {}
}

async function handleMessage(sock, rawMsg) {
    if (!rawMsg?.message) return
    if (rawMsg.key.fromMe) return

    const remoteJid = rawMsg.key.remoteJid
    if (!remoteJid || remoteJid === 'status@broadcast') return

    const msg = unwrapMessage(rawMsg)
    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = isGroup ? (msg.key.participant || from) : from
    const senderNum = sender.replace(/[^0-9]/g, '')
    const isOwner = senderNum === config.ownerNumber.replace(/[^0-9]/g, '')

    const body = extractBody(msg.message).trim()
    if (!body.startsWith(config.prefix)) return

    const args = body.slice(config.prefix.length).trim().split(/\s+/)
    const command = args.shift().toLowerCase()
    if (!command) return
    const text = args.join(' ')

    console.log(`[CMD] ${senderNum} → ${config.prefix}${command}${text ? ' ' + text : ''}`)

    // Cooldown
    const cdKey = `${senderNum}:${command}`
    if (cooldowns.has(cdKey)) {
        const remaining = cooldowns.get(cdKey) - Date.now()
        if (remaining > 0) {
            await simulateTyping(sock, from, 500)
            await sock.sendMessage(from, {
                text: `⏳ Aguarde *${(remaining / 1000).toFixed(1)}s* antes de usar este comando novamente.`
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
        type: getContentType(msg.message),
        reply: async (content) => {
            await simulateTyping(sock, from)
            if (typeof content === 'string') {
                return sock.sendMessage(from, { text: content }, { quoted: msg })
            }
            return sock.sendMessage(from, content, { quoted: msg })
        },
        react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {}),
        sendText: async (t) => {
            await simulateTyping(sock, from)
            return sock.sendMessage(from, { text: t })
        },
        downloadMsg: async () => {
            const type = getContentType(msg.message)
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
            await simulateTyping(sock, from, 500)
            await ctx.reply(`❌ Erro ao executar *!${command}*:\n${err.message}`)
            await ctx.react('❌')
        } catch {}
    }
}

module.exports = { handleMessage, commands }
