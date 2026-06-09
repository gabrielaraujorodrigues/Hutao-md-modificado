const config = require('../../config')
const os = require('os')
const fetch = require('node-fetch')

async function ping(ctx) {
    const start = Date.now()
    const sent = await ctx.reply('🏓 *Pong!*')
    const latencia = Date.now() - start
    await ctx.reply(`⚡ *Latência:* ${latencia}ms`)
    await ctx.react('✅')
}

async function menu(ctx) {
    const { reply, react } = ctx
    await react('📋')

    const texto =
        `╭──────────────────╮\n` +
        `│  🌸 *${config.botName}*\n` +
        `│  Prefixo: *${config.prefix}*\n` +
        `╰──────────────────╯\n\n` +

        `╭─── 🎵 *MÚSICAS* ─────╮\n` +
        `│ ${config.prefix}play *[nome/link]*\n` +
        `│ ${config.prefix}ytmp3 *[nome/link]*\n` +
        `│ ${config.prefix}ytmp4 *[nome/link]*\n` +
        `│ ${config.prefix}video *[nome/link]*\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── 📥 *DOWNLOADS* ───╮\n` +
        `│ ${config.prefix}tiktok *[link]*\n` +
        `│ ${config.prefix}instagram *[link]*\n` +
        `│ ${config.prefix}twitter *[link]*\n` +
        `│ ${config.prefix}threads *[link]*\n` +
        `│ ${config.prefix}pinterest *[link]*\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── 🎨 *FIGURINHAS* ──╮\n` +
        `│ ${config.prefix}sticker\n` +
        `│ ${config.prefix}figurinha\n` +
        `│ ${config.prefix}s\n` +
        `│ ${config.prefix}stealsticker\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── 🤖 *IA & BUSCA* ──╮\n` +
        `│ ${config.prefix}ia *[pergunta]*\n` +
        `│ ${config.prefix}gpt *[pergunta]*\n` +
        `│ ${config.prefix}gemini *[pergunta]*\n` +
        `│ ${config.prefix}traduzir *[idioma] [texto]*\n` +
        `│ ${config.prefix}calc *[expressão]*\n` +
        `│ ${config.prefix}clima *[cidade]*\n` +
        `│ ${config.prefix}noticias\n` +
        `│ ${config.prefix}anime *[nome]*\n` +
        `│ ${config.prefix}letra *[música]*\n` +
        `│ ${config.prefix}cep *[número]*\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── 😂 *DIVERSÃO* ────╮\n` +
        `│ ${config.prefix}cantada\n` +
        `│ ${config.prefix}curiosidade\n` +
        `│ ${config.prefix}conselho\n` +
        `│ ${config.prefix}piada\n` +
        `│ ${config.prefix}vdd\n` +
        `│ ${config.prefix}pergunta\n` +
        `│ ${config.prefix}ship *[Nome x Nome]*\n` +
        `│ ${config.prefix}sorte\n` +
        `│ ${config.prefix}dado\n` +
        `│ ${config.prefix}coinflip\n` +
        `│ ${config.prefix}escolher *[op1 | op2]*\n` +
        `│ ${config.prefix}simsim *[pergunta]*\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── 👥 *GRUPOS* ──────╮\n` +
        `│ ${config.prefix}ban *[@membro]*\n` +
        `│ ${config.prefix}add *[número]*\n` +
        `│ ${config.prefix}promote *[@membro]*\n` +
        `│ ${config.prefix}demote *[@membro]*\n` +
        `│ ${config.prefix}everyone *[msg]*\n` +
        `│ ${config.prefix}hidetag *[msg]*\n` +
        `│ ${config.prefix}link\n` +
        `│ ${config.prefix}revoke\n` +
        `│ ${config.prefix}ginfo\n` +
        `│ ${config.prefix}fechar\n` +
        `│ ${config.prefix}abrir\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── 🎉 *BOAS-VINDAS* ─╮\n` +
        `│ ${config.prefix}bemvindo\n` +
        `│ ${config.prefix}bemvindo on/off\n` +
        `│ ${config.prefix}bemvindo msg [texto]\n` +
        `│ ${config.prefix}saida\n` +
        `│ ${config.prefix}saida on/off\n` +
        `│ ${config.prefix}saida msg [texto]\n` +
        `╰──────────────────────╯\n\n` +

        `╭─── ℹ️ *BOT* ──────────╮\n` +
        `│ ${config.prefix}ping\n` +
        `│ ${config.prefix}dono\n` +
        `│ ${config.prefix}uptime\n` +
        `╰──────────────────────╯\n\n` +
        `_🌸 ${config.botName} — Todos os comandos gratuitos_`

    await reply(texto)
}

async function dono(ctx) {
    const { reply, react } = ctx
    await react('👑')
    await reply(
        `👑 *Informações do Dono*\n\n` +
        `📛 *Nome:* ${config.ownerName}\n` +
        `📱 *Contato:* wa.me/${config.ownerNumber}\n` +
        `🌸 *Bot:* ${config.botName}\n\n` +
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
        `⏱ *Status do Bot*\n\n` +
        `🕐 *Online há:* ${horas}h ${minutos}m ${segs}s\n` +
        `💾 *Memória:* ${mbUsado}MB / ${mbTotal}MB\n` +
        `🖥 *Plataforma:* ${os.platform()}\n` +
        `⚡ *Node.js:* ${process.version}`
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
            `📍 *Informações do CEP*\n\n` +
            `📮 *CEP:* ${data.cep}\n` +
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
