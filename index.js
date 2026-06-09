const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    PHONENUMBER_MCC,
    proto,
    getAggregateVotesInPollMessage,
    Browsers,
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const qrcode = require('qrcode-terminal')
const { handleMessage } = require('./handler')
const config = require('./config')

const logger = pino({ level: 'silent' })

const store = makeInMemoryStore({ logger })
store.readFromFile('./session/store.json')
setInterval(() => { store.writeToFile('./session/store.json') }, 10_000)

if (!fs.existsSync('./session')) fs.mkdirSync('./session')

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState('./session/auth')

    console.log(chalk.green(`\n╔══════════════════════════════╗`))
    console.log(chalk.green(`║   ${chalk.bold.white(config.botName)} — Iniciando...   ║`))
    console.log(chalk.green(`╚══════════════════════════════╝\n`))
    console.log(chalk.cyan(`  Baileys v${version} ${isLatest ? chalk.green('(latest)') : chalk.yellow('(update available)')}`))
    console.log(chalk.cyan(`  Prefixo: ${chalk.bold(config.prefix)}`))
    console.log(chalk.cyan(`  Dono: ${chalk.bold(config.ownerNumber)}\n`))

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg?.message || undefined
            }
            return proto.Message.fromObject({})
        },
    })

    store.bind(sock.ev)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log(chalk.yellow('\n  Escaneie o QR Code abaixo com o WhatsApp:\n'))
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
                : true

            console.log(chalk.red('\n  Conexão encerrada.'), chalk.yellow(shouldReconnect ? 'Reconectando...' : 'Sessão encerrada. Delete a pasta session/ e reinicie.'))

            if (shouldReconnect) {
                setTimeout(startBot, 3000)
            }
        } else if (connection === 'open') {
            console.log(chalk.green('\n  ✅ Bot conectado com sucesso!\n'))
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
            try {
                await handleMessage(sock, msg, store)
            } catch (err) {
                console.error(chalk.red('Erro ao processar mensagem:'), err.message)
            }
        }
    })

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        // Boas-vindas e despedidas automáticas podem ser adicionadas aqui
    })

    return sock
}

startBot().catch((err) => {
    console.error(chalk.red('Erro fatal ao iniciar o bot:'), err)
    process.exit(1)
})
