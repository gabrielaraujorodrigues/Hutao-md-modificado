const fetch = require('node-fetch')
const { translate } = require('@vitalets/google-translate-api')

async function ia(ctx) {
    const { reply, react, text } = ctx
    if (!text) return reply('❌ Informe a pergunta!\nExemplo: *!ia Qual a capital do Brasil?*')

    await react('🤖')

    try {
        const res = await fetch('https://api.paxsenix.biz.id/ai/gpt4o', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            timeout: 30000,
        })
        const data = await res.json()
        const resp = data?.result || data?.response || data?.message || data?.text || 'Sem resposta.'
        await reply(`🤖 *IA:*\n\n${resp}`)
        await react('✅')
    } catch (err) {
        // Fallback para API alternativa
        try {
            const res2 = await fetch(`https://api.siputzx.my.id/api/ai/llama3?prompt=${encodeURIComponent(text)}`)
            const data2 = await res2.json()
            const resp2 = data2?.data || data2?.result || 'Sem resposta.'
            await reply(`🤖 *IA:*\n\n${resp2}`)
            await react('✅')
        } catch {
            await reply('❌ A IA está indisponível no momento. Tente novamente.')
        }
    }
}

async function gpt(ctx) {
    return ia(ctx)
}

async function gemini(ctx) {
    const { reply, react, text } = ctx
    if (!text) return reply('❌ Informe a pergunta!\nExemplo: *!gemini Quanto é 2+2?*')

    await react('🤖')

    try {
        const res = await fetch(`https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(text)}`)
        const data = await res.json()
        const resp = data?.data || data?.result || 'Sem resposta.'
        await reply(`✨ *Gemini:*\n\n${resp}`)
        await react('✅')
    } catch {
        await reply('❌ Gemini indisponível. Use *!ia* como alternativa.')
    }
}

async function traduzir(ctx) {
    const { reply, react, text, args } = ctx
    if (!text) return reply('❌ Informe o texto e o idioma de destino!\nExemplo: *!traduzir en Olá mundo*\nIdiomas: pt, en, es, fr, de, it, ja, ko, zh...')

    await react('🌐')

    const lang = args[0] || 'en'
    const textToTranslate = args.slice(1).join(' ')

    if (!textToTranslate) return reply('❌ Formato: *!traduzir [idioma] [texto]*\nExemplo: *!traduzir en Olá mundo*')

    try {
        const result = await translate(textToTranslate, { to: lang })
        await reply(
            `🌐 *Tradução*\n\n` +
            `🔤 *Original:* ${textToTranslate}\n` +
            `📝 *Traduzido (${lang}):* ${result.text}`
        )
        await react('✅')
    } catch (err) {
        await reply(`❌ Erro ao traduzir: ${err.message}`)
    }
}

async function clima(ctx) {
    const { reply, react, text } = ctx
    const cidade = text || 'São Paulo'

    await react('⛅')

    try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(cidade)}?format=j1`)
        const data = await res.json()
        const current = data.current_condition[0]
        const area = data.nearest_area[0]

        const nome = area.areaName[0].value + ', ' + area.country[0].value
        const temp = current.temp_C
        const sensacao = current.FeelsLikeC
        const umidade = current.humidity
        const descricao = current.lang_pt?.[0]?.value || current.weatherDesc[0].value
        const vento = current.windspeedKmph

        await reply(
            `⛅ *Clima em ${nome}*\n\n` +
            `🌡️ *Temperatura:* ${temp}°C\n` +
            `🤔 *Sensação:* ${sensacao}°C\n` +
            `💧 *Umidade:* ${umidade}%\n` +
            `💨 *Vento:* ${vento} km/h\n` +
            `📋 *Condição:* ${descricao}`
        )
        await react('✅')
    } catch {
        await reply('❌ Não foi possível obter o clima. Verifique o nome da cidade.')
    }
}

async function calc(ctx) {
    const { reply, react, text } = ctx
    if (!text) return reply('❌ Informe a expressão!\nExemplo: *!calc 2 + 2 * 10*')

    await react('🧮')

    try {
        // Remove caracteres perigosos, permite apenas operações matemáticas
        const expr = text.replace(/[^0-9+\-*/().\s%^]/g, '').trim()
        if (!expr) return reply('❌ Expressão inválida.')
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr})`)()
        await reply(`🧮 *Calculadora*\n\n${text} = *${result}*`)
        await react('✅')
    } catch {
        await reply('❌ Expressão matemática inválida.')
    }
}

async function noticias(ctx) {
    const { reply, react } = ctx
    await react('📰')

    try {
        const res = await fetch('https://api.siputzx.my.id/api/n/news-indonesia', { timeout: 15000 })
        const data = await res.json()
        const items = data?.data?.slice(0, 5) || []

        if (!items.length) throw new Error('Sem notícias')

        let text = '📰 *Últimas Notícias*\n\n'
        items.forEach((item, i) => {
            text += `*${i + 1}. ${item.title}*\n${item.description || ''}\n🔗 ${item.url || ''}\n\n`
        })

        await reply(text.trim())
        await react('✅')
    } catch {
        // Fallback para API de notícias BR
        try {
            const res2 = await fetch('https://newsapi.org/v2/top-headlines?country=br&pageSize=5&apiKey=demo', { timeout: 10000 })
            await reply('❌ API de notícias indisponível no momento. Tente novamente mais tarde.')
        } catch {
            await reply('❌ Não foi possível buscar notícias.')
        }
    }
}

module.exports = { ia, gpt, gemini, traduzir, clima, calc, noticias }
