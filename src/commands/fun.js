const { cantadas, curiosidades, conselhos, piadas } = require('../data/exports')

function aleatorio(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

async function cantada(ctx) {
    await ctx.reply(`💌 *Cantada do dia:*\n\n_${aleatorio(cantadas)}_`)
    await ctx.react('💕')
}

async function curiosidade(ctx) {
    await ctx.reply(`🧠 *Curiosidade:*\n\n_${aleatorio(curiosidades)}_`)
    await ctx.react('💡')
}

async function conselho(ctx) {
    await ctx.reply(`💭 *Conselho:*\n\n_${aleatorio(conselhos)}_`)
    await ctx.react('✨')
}

async function piada(ctx) {
    await ctx.reply(`😂 *Piada:*\n\n_${aleatorio(piadas)}_`)
    await ctx.react('😂')
}

async function vdd(ctx) {
    const frases = [
        'Você é a pessoa mais incrível que já conheci! 🥰',
        'Sabia que você é especial? Porque é! ✨',
        'O mundo é melhor com você nele! 🌍',
        'Você tem um sorriso que ilumina qualquer lugar! ☀️',
        'Nunca duvide do seu potencial, você é capaz! 💪',
        'Você merece tudo de melhor nessa vida! 💖',
        'Sua presença faz diferença na vida das pessoas! 🌷',
        'Acredite em si mesmo, você é mais forte do que imagina! 🦋',
    ]
    await ctx.reply(`💝 *Verdade do dia:*\n\n_${aleatorio(frases)}_`)
    await ctx.react('💝')
}

async function pergunta(ctx) {
    const perguntas = [
        'Se você pudesse morar em qualquer lugar do mundo, onde seria?',
        'Qual seria sua habilidade de superpoder ideal?',
        'Se você pudesse jantar com qualquer pessoa da história, quem seria?',
        'O que você faria se soubesse que não poderia falhar?',
        'Qual é a coisa mais corajosa que você já fez?',
        'Se você pudesse aprender qualquer habilidade instantaneamente, qual seria?',
        'Qual é o melhor conselho que você já recebeu?',
        'Se você pudesse mudar uma coisa no mundo, o que seria?',
    ]
    await ctx.reply(`🤔 *Pergunta do momento:*\n\n_${aleatorio(perguntas)}_`)
    await ctx.react('🤔')
}

async function ship(ctx) {
    const { text, reply, react } = ctx
    const partes = text.split('x').map(s => s.trim())
    if (partes.length < 2 || !partes[0] || !partes[1]) {
        return reply('❌ Formato: *!ship Nome1 x Nome2*\nExemplo: *!ship João x Maria*')
    }
    const porcentagem = Math.floor(Math.random() * 101)
    const barra = '█'.repeat(Math.floor(porcentagem / 10)) + '░'.repeat(10 - Math.floor(porcentagem / 10))
    const emoji = porcentagem >= 80 ? '💞' : porcentagem >= 50 ? '💛' : porcentagem >= 30 ? '🤔' : '💔'

    await reply(
        `${emoji} *Compatibilidade*\n\n` +
        `👤 ${partes[0]} ❤️ ${partes[1]}\n\n` +
        `[${barra}] *${porcentagem}%*\n\n` +
        (porcentagem >= 80 ? 'Combinam muito! 💕' :
         porcentagem >= 50 ? 'Têm potencial! 😊' :
         porcentagem >= 30 ? 'É complicado... 😅' : 'Hmm, talvez não seja a hora... 💔')
    )
    await react(emoji)
}

async function sorte(ctx) {
    const numeros = Array.from({ length: 6 }, () => Math.floor(Math.random() * 60) + 1)
    numeros.sort((a, b) => a - b)
    await ctx.reply(
        `🍀 *Seus números da sorte:*\n\n` +
        `🎰 ${numeros.join(' • ')}\n\n` +
        `_Boa sorte na Mega-Sena! 🤞_`
    )
    await ctx.react('🍀')
}

async function dado(ctx) {
    const resultado = Math.floor(Math.random() * 6) + 1
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣']
    await ctx.reply(`🎲 *Dado:* ${emojis[resultado - 1]} (${resultado})`)
    await ctx.react('🎲')
}

async function coinflip(ctx) {
    const resultado = Math.random() > 0.5 ? '🪙 Cara!' : '🪙 Coroa!'
    await ctx.reply(`*Cara ou Coroa:* ${resultado}`)
    await ctx.react('🪙')
}

async function escolher(ctx) {
    const { text, reply } = ctx
    if (!text) return reply('❌ Formato: *!escolher opção1 | opção2 | opção3*')
    const opcoes = text.split('|').map(s => s.trim()).filter(Boolean)
    if (opcoes.length < 2) return reply('❌ Separe as opções com *|*\nExemplo: *!escolher pizza | hambúrguer | sushi*')
    const escolha = aleatorio(opcoes)
    await reply(`🎯 *Eu escolho:* ${escolha}`)
    await ctx.react('🎯')
}

async function simsim(ctx) {
    const { text, reply, react } = ctx
    if (!text) return reply('❌ Faça uma pergunta!\nExemplo: *!simsim Vou passar na prova?*')
    const respostas = [
        '✅ Sim, com certeza!', '❌ Não, nem pensar!',
        '🤔 Talvez...', '💯 Com certeza absoluta!',
        '😅 Provavelmente não...', '🌟 Sim, acredite!',
        '😬 Prefiro não responder...', '🎯 Definitivamente sim!',
        '💭 Os sinais apontam que não...', '✨ Com toda certeza, sim!',
    ]
    await reply(`🔮 *Pergunta:* ${text}\n\n*Resposta:* ${aleatorio(respostas)}`)
    await react('🔮')
}

module.exports = {
    cantada, curiosidade, conselho, piada,
    vdd, pergunta, ship, sorte, dado,
    coinflip, escolher, simsim,
}
