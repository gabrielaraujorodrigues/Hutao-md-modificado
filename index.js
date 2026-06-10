const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    proto,
    makeInMemoryStore,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const qrcode = require('qrcode-terminal')
const { handleMessage } = require('./handler')
const { handleGroupUpdate } = require('./src/commands/welcome')
const config = require('./config')

process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n[FATAL]'), err.message)
    console.error(err.stack)
})
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('\n[REJECTION]'), reason?.message || reason)
})

const SILENT = () => {}
const logger = {
    level: 'silent',
    trace: SILENT, debug: SILENT, info: SILENT,
    warn: SILENT, error: SILENT, fatal: SILENT,
    child: () => logger,
}

// Store em memória para recuperar mensagens (necessário para retry/re-chave)
let store = null
try {
    store = makeInMemoryStore({ logger })
} catch {
    store = null
}

if (!fs.existsSync('./session')) fs.mkdirSync('./session')

let retryCount = 0

function clearSession() {
    try { fs.rmSync('./session/auth', { recursive: true, force: true }) } catch {}
    try { fs.mkdirSync('./session/auth', { recursive: true }) } catch {}
}

async function startBot() {
    let version = [2, 3000, 1015901307]
    try {
        const latest = await fetchLatestBaileysVersion()
        version = latest.version
    } catch {
        console.log(chalk.yellow(`  [AVISO] Usando versão padrão: ${version.join('.')}`))
    }

    const { state, saveCreds } = await useMultiFileAuthState('./session/auth')

    if (retryCount === 0) {
        console.log(chalk.green(`\n╔══════════════════════════════╗`))
        console.log(chalk.green(`║   ${chalk.bold.white(config.botName)} — Iniciando...   ║`))
        console.log(chalk.green(`╚══════════════════════════════╝\n`))
        console.log(chalk.cyan(`  Prefixo : ${chalk.bold(config.prefix)}`))
        console.log(chalk.cyan(`  Dono    : ${chalk.bold(config.ownerNumber)}\n`))
    }

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        // baileys() é mais compatível e menos bloqueado pelo WhatsApp
        browser: Browsers.baileys('Chrome'),
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg?.message || undefined
            }
            return proto.Message.fromObject({})
        },
    })

    // Vincula o store ao socket para armazenar mensagens
    if (store) store.bind(sock.ev)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log(chalk.yellow('\n  Escaneie o QR Code abaixo:\n'))
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode
                : 0

            const loggedOut  = statusCode === DisconnectReason.loggedOut
            const badSession = statusCode === DisconnectReason.badSession

            if (loggedOut || badSession) {
                console.log(chalk.red(`\n  [SESSÃO] ${loggedOut ? 'Logout' : 'Sessão inválida'}. Limpando e reiniciando...\n`))
                clearSession()
                retryCount = 0
                setTimeout(startBot, 3000)
            } else {
                retryCount++
                const delay = Math.min(retryCount * 3000, 30000)
                console.log(chalk.yellow(`  [RECONEXÃO] Código ${statusCode} — Tentativa ${retryCount}. Aguardando ${delay / 1000}s...`))
                setTimeout(startBot, delay)
            }
        } else if (connection === 'open') {
            retryCount = 0
            console.log(chalk.green('\n  ✅ Bot conectado! Aguardando mensagens...\n'))
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
            handleMessage(sock, msg).catch((err) => {
                console.error(chalk.red('[HANDLER ERRO]'), err.message)
                console.error(err.stack)
            })
        }
    })

    sock.ev.on('group-participants.update', async (update) => {
        handleGroupUpdate(sock, update).catch((err) => {
            console.error(chalk.red('[GRUPO ERRO]'), err.message)
        })
    })
}

console.log(chalk.cyan('[BOT] Iniciando...'))

startBot().catch((err) => {
    console.error(chalk.red('[ERRO FATAL]'), err.message)
    setTimeout(() => { retryCount = 0; startBot().catch(() => process.exit(1)) }, 10000)
})
