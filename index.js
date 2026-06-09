const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    proto,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const qrcode = require('qrcode-terminal')
const { handleMessage } = require('./handler')
const { handleGroupUpdate } = require('./src/commands/welcome')
const config = require('./config')

// Logger completamente silencioso — suprime TODOS os logs internos do Baileys
const SILENT = () => {}
const logger = {
    level: 'silent',
    trace: SILENT, debug: SILENT, info: SILENT,
    warn: SILENT, error: SILENT, fatal: SILENT,
    child: () => logger,
}

if (!fs.existsSync('./session')) fs.mkdirSync('./session')

let retryCount = 0

async function startBot() {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState('./session/auth')

    if (retryCount === 0) {
        console.log(chalk.green(`\n╔══════════════════════════════╗`))
        console.log(chalk.green(`║   ${chalk.bold.white(config.botName)} — Iniciando...   ║`))
        console.log(chalk.green(`╚══════════════════════════════╝\n`))
        console.log(chalk.cyan(`  Baileys v${version.join('.')}`))
        console.log(chalk.cyan(`  Prefixo: ${chalk.bold(config.prefix)}`))
        console.log(chalk.cyan(`  Dono: ${chalk.bold(config.ownerNumber)}\n`))
    }

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
        generateHighQualityLinkPreview: true,
        getMessage: async () => proto.Message.fromObject({}),
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log(chalk.yellow('\n  Escaneie o QR Code abaixo com o WhatsApp:\n'))
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const code = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode
                : 0
            const loggedOut = code === DisconnectReason.loggedOut

            if (loggedOut) {
                console.log(chalk.red('\n  Sessão encerrada (logout). Delete a pasta session/ e reinicie.\n'))
            } else {
                retryCount++
                const delay = Math.min(retryCount * 3000, 30000)
                console.log(chalk.yellow(`  Conexão encerrada (código ${code}). Reconectando em ${delay / 1000}s...`))
                setTimeout(startBot, delay)
            }
        } else if (connection === 'open') {
            retryCount = 0
            console.log(chalk.green('\n  ✅ Bot conectado com sucesso!\n'))
            console.log(chalk.gray('  Aguardando mensagens...\n'))
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
            handleMessage(sock, msg).catch((err) => {
                console.error(chalk.red('[HANDLER]'), err.message)
            })
        }
    })

    sock.ev.on('group-participants.update', async (update) => {
        handleGroupUpdate(sock, update).catch((err) => {
            console.error(chalk.red('[GRUPO]'), err.message)
        })
    })
}

startBot().catch((err) => {
    console.error(chalk.red('Erro fatal ao iniciar:'), err.message)
    process.exit(1)
})
