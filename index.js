const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    proto,
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const qrcode = require('qrcode-terminal')
const { handleMessage } = require('./handler')
const config = require('./config')

const logger = pino({ level: 'silent' })

if (!fs.existsSync('./session')) fs.mkdirSync('./session')

async function startBot() {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState('./session/auth')

    console.log(chalk.green(`\n╔══════════════════════════════╗`))
    console.log(chalk.green(`║   ${chalk.bold.white(config.botName)} — Iniciando...   ║`))
    console.log(chalk.green(`╚══════════════════════════════╝\n`))
    console.log(chalk.cyan(`  Baileys v${version}`))
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
        getMessage: async () => {
            return proto.Message.fromObject({})
        },
    })

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

            if (shouldReconnect) {
                console.log(chalk.yellow('  Reconectando...'))
                setTimeout(startBot, 3000)
            } else {
                console.log(chalk.red('  Sessão encerrada. Delete a pasta session/ e reinicie.'))
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
                await handleMessage(sock, msg)
            } catch (err) {
                console.error(chalk.red('Erro ao processar mensagem:'), err.message)
            }
        }
    })
}

startBot().catch((err) => {
    console.error(chalk.red('Erro fatal:'), err)
    process.exit(1)
})
