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

// Captura erros não tratados para não matar o processo silenciosamente
process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n[FATAL] Exceção não tratada:'), err.message)
    console.error(err.stack)
})
process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason)
    console.error(chalk.red('\n[FATAL] Promise rejeitada sem catch:'), msg)
})

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

function clearSession() {
    try {
        fs.rmSync('./session/auth', { recursive: true, force: true })
    } catch {}
    try {
        fs.mkdirSync('./session/auth', { recursive: true })
    } catch {}
}

async function startBot() {
    // Busca a versão mais recente do WhatsApp Web com fallback caso a rede bloqueie
    let version = [2, 3000, 1015901307]
    try {
        const latest = await fetchLatestBaileysVersion()
        version = latest.version
        console.log(chalk.gray(`  [OK] Versão Baileys: ${version.join('.')}`))
    } catch {
        console.log(chalk.yellow(`  [AVISO] Não foi possível verificar versão online. Usando versão padrão: ${version.join('.')}`))
    }

    const { state, saveCreds } = await useMultiFileAuthState('./session/auth')

    if (retryCount === 0) {
        console.log(chalk.green(`\n╔══════════════════════════════╗`))
        console.log(chalk.green(`║   ${chalk.bold.white(config.botName)} — Iniciando...   ║`))
        console.log(chalk.green(`╚══════════════════════════════╝\n`))
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
        getMessage: async () => ({ conversation: '' }),
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log(chalk.yellow('\n  Escaneie o QR Code abaixo com o WhatsApp:\n'))
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output?.statusCode
                : 0

            const loggedOut = statusCode === DisconnectReason.loggedOut
            const badSession = statusCode === DisconnectReason.badSession

            if (loggedOut || badSession) {
                const motivo = loggedOut ? 'logout' : 'sessão inválida'
                console.log(chalk.red(`\n  [SESSÃO] Desconectado por ${motivo}. Limpando sessão para novo QR Code...\n`))
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

console.log(chalk.cyan('[BOT] Carregando módulos e iniciando...'))

startBot().catch((err) => {
    console.error(chalk.red('\n[ERRO FATAL ao iniciar:]'), err.message)
    console.error(err.stack)
    console.log(chalk.yellow('[BOT] Tentando reiniciar em 10 segundos...'))
    setTimeout(() => {
        retryCount = 0
        startBot().catch((err2) => {
            console.error(chalk.red('[ERRO FATAL segundo início:]'), err2.message)
            process.exit(1)
        })
    }, 10000)
})
