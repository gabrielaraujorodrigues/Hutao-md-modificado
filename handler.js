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
    const mod = require(path.join(commandsDir, file))
    if (typeof mod === 'object') {
        for (const [name, fn] of Object.entries(mod)) {
            commands[name.toLowerCase()] = fn
        }
    }
})

async function handleMessage(sock, msg) {
    if (!msg.message) return
    if (msg.key.fromMe) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = isGroup ? msg.key.participant : msg.key.remoteJid
    const senderNum = sender.replace(/[^0-9]/g, '')
    const isOwner = senderNum === config.ownerNumber.replace(/[^0-9]/g, '')

    const type = getContentType(msg.message)
    const body = (
        type === 'conversation' ? msg.message.conversation :
        type === 'extendedTextMessage' ? msg.message.extendedTextMessage?.text :
        type === 'imageMessage' ? msg.message.imageMessage?.caption :
        type === 'videoMessage' ? msg.message.videoMessage?.caption :
        type === 'documentMessage' ? msg.message.documentMessage?.caption : ''
    ) || ''

    const prefix = config.prefix
    if (!body.startsWith(prefix)) return

    const args = body.slice(prefix.length).trim().split(/\s+/)
    const command = args.shift().toLowerCase()
    const text = args.join(' ')

    // Cooldown por usuário e comando
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
    if (!fn) return

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
        react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }),
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
        await ctx.reply(`❌ Erro ao executar *!${command}*:\n${err.message}`)
        await ctx.react('❌')
    }
}

module.exports = { handleMessage, commands }
