const config = require('../../config')
const os = require('os')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

function getTime() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
}

function getGreeting() {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return 'Bom dia ☀️'
    if (h >= 12 && h < 18) return 'Boa tarde 🌤'
    return 'Boa noite 🌙'
}

async function ping(ctx) {
    const start = Date.now()
    await ctx.reply('🏓 *Pong!*')
    const latencia = Date.now() - start
    await ctx.reply(`⚡ *Latência:* ${latencia}ms`)
    await ctx.react('✅')
}

async function menu(ctx) {
    const { sock, from, msg, react, sender } = ctx
    await react('📋')

    const senderNum = sender.replace(/[^0-9]/g, '')
    const hora = getTime()
    const saudacao = getGreeting()

    const texto =
`┏═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┓
┣⋆⃟ۣۜ᭪➣ 𖡦 𝐌𝐄𝐍𝐔 𝐆𝐄𝐑𝐀𝐋 【📋】
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛
┃╭━━─ ≪ •❈• ≫ ─━━╮
┃╎ ✫✫✫✫✫
┃╎ *${saudacao} @${senderNum}!*
┃╎ ✯ *Bot*: ${config.botName}
┃╎ ✯ *Prefixo*: ${config.prefix}
┃╎ ✯ *Hora*: ${hora}
┃╎ ✫✫✫✫✫
┃╰━━─ ≪ •❈• ≫ ─━━╯
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 🎵 MÚSICAS |✭˚•═┓
┃╎ ${config.prefix}play *[nome ou link]*
┃╎ ${config.prefix}ytmp3 *[nome ou link]*
┃╎ ${config.prefix}ytmp4 *[nome ou link]*
┃╎ ${config.prefix}video *[nome ou link]*
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 📥 DOWNLOADS |✭˚•═┓
┃╎ ${config.prefix}tiktok *[link]*
┃╎ ${config.prefix}instagram *[link]*
┃╎ ${config.prefix}twitter *[link]*
┃╎ ${config.prefix}threads *[link]*
┃╎ ${config.prefix}pinterest *[link]*
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 🎨 FIGURINHAS |✭˚•═┓
┃╎ ${config.prefix}sticker
┃╎ ${config.prefix}figurinha
┃╎ ${config.prefix}s
┃╎ ${config.prefix}stealsticker
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 🤖 IA & BUSCA |✭˚•═┓
┃╎ ${config.prefix}ia *[pergunta]*
┃╎ ${config.prefix}gpt *[pergunta]*
┃╎ ${config.prefix}gemini *[pergunta]*
┃╎ ${config.prefix}traduzir *[idioma] [texto]*
┃╎ ${config.prefix}calc *[expressão]*
┃╎ ${config.prefix}clima *[cidade]*
┃╎ ${config.prefix}noticias
┃╎ ${config.prefix}anime *[nome]*
┃╎ ${config.prefix}letra *[música - artista]*
┃╎ ${config.prefix}cep *[número]*
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 😂 DIVERSÃO |✭˚•═┓
┃╎ ${config.prefix}cantada
┃╎ ${config.prefix}curiosidade
┃╎ ${config.prefix}conselho
┃╎ ${config.prefix}piada
┃╎ ${config.prefix}vdd
┃╎ ${config.prefix}pergunta
┃╎ ${config.prefix}ship *[Nome x Nome]*
┃╎ ${config.prefix}sorte
┃╎ ${config.prefix}dado
┃╎ ${config.prefix}coinflip
┃╎ ${config.prefix}escolher *[op1 | op2]*
┃╎ ${config.prefix}simsim *[pergunta]*
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 👥 GRUPOS |✭˚•═┓
┃╎ ${config.prefix}ban *[@membro]*
┃╎ ${config.prefix}add *[número]*
┃╎ ${config.prefix}promote *[@membro]*
┃╎ ${config.prefix}demote *[@membro]*
┃╎ ${config.prefix}everyone *[msg]*
┃╎ ${config.prefix}hidetag *[msg]*
┃╎ ${config.prefix}link
┃╎ ${config.prefix}revoke
┃╎ ${config.prefix}ginfo
┃╎ ${config.prefix}fechar / ${config.prefix}abrir
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| 🎉 BOAS-VINDAS |✭˚•═┓
┃╎ ${config.prefix}bemvindo on/off
┃╎ ${config.prefix}bemvindo msg [texto]
┃╎ ${config.prefix}saida on/off
┃╎ ${config.prefix}saida msg [texto]
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

┏═•✭･ﾟ✧*･ﾟ| ℹ️ BOT |✭˚•═┓
┃╎ ${config.prefix}ping
┃╎ ${config.prefix}dono
┃╎ ${config.prefix}uptime
┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛

_✰ ${config.botName} — Todos os comandos são gratuitos ✰_`

    // Tenta enviar com imagem; se falhar, envia só o texto
    try {
        const imgPath = path.join(__dirname, '../../src/assets/menu.jpg')
        if (fs.existsSync(imgPath)) {
            await sock.sendMessage(from, {
                image: fs.readFileSync(imgPath),
                caption: texto,
                mentions: [sender],
            }, { quoted: msg })
        } else {
            // Fallback: imagem via URL do repositório
            await sock.sendMessage(from, {
                image: { url: config.menuImage },
                caption: texto,
                mentions: [sender],
            }, { quoted: msg })
        }
    } catch {
        await sock.sendMessage(from, { text: texto, mentions: [sender] }, { quoted: msg })
    }

    await ctx.react('✅')
}

async function dono(ctx) {
    const { reply, react } = ctx
    await react('👑')
    await reply(
        `┏═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┓\n` +
        `┣⋆⃟ۣۜ᭪➣ 𖡦 𝐈𝐍𝐅𝐎 𝐃𝐎𝐍𝐎 【👑】\n` +
        `┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛\n` +
        `┃╭━━─ ≪ •❈• ≫ ─━━╮\n` +
        `┃╎ ✫✫✫✫✫\n` +
        `┃╎ ✯ *Nome*: ${config.ownerName}\n` +
        `┃╎ ✯ *Contato*: wa.me/${config.ownerNumber}\n` +
        `┃╎ ✯ *Bot*: ${config.botName}\n` +
        `┃╎ ✫✫✫✫✫\n` +
        `┃╰━━─ ≪ •❈• ≫ ─━━╯\n` +
        `┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛\n\n` +
        `_Para suporte, fale com o dono!_`
    )
}

async function uptime(ctx) {
    const { reply, react } = ctx
    await react('⏱')
    const segundos = Math.floor(process.uptime())
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segs = segundos % 60
    const mem = process.memoryUsage()
    const mbUsado = (mem.heapUsed / 1024 / 1024).toFixed(1)
    const mbTotal = (mem.heapTotal / 1024 / 1024).toFixed(1)

    await reply(
        `┏═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┓\n` +
        `┣⋆⃟ۣۜ᭪➣ 𖡦 𝐒𝐓𝐀𝐓𝐔𝐒 𝐃𝐎 𝐁𝐎𝐓 【⏱】\n` +
        `┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛\n` +
        `┃╎ 🕐 *Online há:* ${horas}h ${minutos}m ${segs}s\n` +
        `┃╎ 💾 *Memória:* ${mbUsado}MB / ${mbTotal}MB\n` +
        `┃╎ 🖥 *Plataforma:* ${os.platform()}\n` +
        `┃╎ ⚡ *Node.js:* ${process.version}\n` +
        `┗═•✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ•═┛`
    )
}

async function anime(ctx) {
    const { reply, react, text, sock, from, msg } = ctx
    if (!text) return reply('❌ Informe o nome do anime!\nExemplo: *!anime Naruto*')
    await react('🎌')
    try {
        const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(text)}&limit=1`)
        const data = await res.json()
        const item = data.data?.[0]
        if (!item) return reply('❌ Anime não encontrado.')
        await sock.sendMessage(from, {
            image: { url: item.images?.jpg?.image_url },
            caption:
                `🎌 *${item.title}*\n` +
                `📝 *Título JP:* ${item.title_japanese || '-'}\n` +
                `⭐ *Nota:* ${item.score || '-'}/10\n` +
                `📺 *Tipo:* ${item.type || '-'}\n` +
                `🎬 *Episódios:* ${item.episodes || '?'}\n` +
                `📅 *Status:* ${item.status || '-'}\n` +
                `🏷 *Gêneros:* ${item.genres?.map(g => g.name).join(', ') || '-'}\n\n` +
                `📋 *Sinopse:*\n${(item.synopsis || '-').slice(0, 500)}${(item.synopsis?.length || 0) > 500 ? '...' : ''}`,
        }, { quoted: msg })
        await react('✅')
    } catch {
        await reply('❌ Erro ao buscar anime. Tente novamente.')
    }
}

async function letra(ctx) {
    const { reply, react, text } = ctx
    if (!text) return reply('❌ Informe o nome da música!\nExemplo: *!letra Evidências Chitãozinho*')
    await react('🎵')
    try {
        const res = await fetch(`https://api.vagalume.com.br/search.php?apikey=guest&q=${encodeURIComponent(text)}`)
        const data = await res.json()
        if (!data.response?.docs?.length) return reply('❌ Letra não encontrada.')
        const musica = data.response.docs[0]
        const letraTexto = musica.text?.slice(0, 3000) || 'Letra não disponível.'
        await reply(
            `🎵 *${musica.title}*\n` +
            `👤 *Artista:* ${musica.band?.name || '-'}\n\n` +
            `${letraTexto}${(musica.text?.length || 0) > 3000 ? '\n\n_(letra cortada — muito longa)_' : ''}`
        )
        await react('✅')
    } catch {
        await reply('❌ Não foi possível buscar a letra.')
    }
}

async function cep(ctx) {
    const { reply, react, text } = ctx
    const cepNum = text?.replace(/[^0-9]/g, '')
    if (!cepNum || cepNum.length !== 8) return reply('❌ Informe um CEP válido!\nExemplo: *!cep 01310100*')
    await react('📍')
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`)
        const data = await res.json()
        if (data.erro) return reply('❌ CEP não encontrado.')
        await reply(
            `📍 *CEP ${data.cep}*\n\n` +
            `🏘 *Logradouro:* ${data.logradouro || '-'}\n` +
            `🏙 *Bairro:* ${data.bairro || '-'}\n` +
            `🌆 *Cidade:* ${data.localidade}\n` +
            `🗺 *Estado:* ${data.estado || ''} (${data.uf})\n` +
            `📡 *DDD:* ${data.ddd}`
        )
        await react('✅')
    } catch {
        await reply('❌ Erro ao buscar o CEP.')
    }
}

async function stealsticker(ctx) {
    const { sock, from, msg, reply, react } = ctx
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted?.stickerMessage) return reply('❌ Responda a uma *figurinha* com esse comando para roubá-la!')
    await react('🎨')
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys')
    const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker')
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    await sock.sendMessage(from, { sticker: Buffer.concat(chunks) }, { quoted: msg })
    await react('✅')
}

module.exports = { ping, menu, dono, uptime, anime, letra, cep, stealsticker }
