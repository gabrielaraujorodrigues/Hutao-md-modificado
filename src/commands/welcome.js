const fetch = require('node-fetch')
const config = require('../../config')

// Configurações de boas-vindas por grupo (em memória; persiste enquanto o bot estiver rodando)
// Para persistência real, use um arquivo JSON ou banco de dados
const welcomeSettings = new Map()

function getSettings(groupId) {
    if (!welcomeSettings.has(groupId)) {
        welcomeSettings.set(groupId, {
            enabled: true,
            message: 'Seja bem-vindo(a) ao grupo, @user! 🎉\n\nEspero que você aproveite a estadia! 😊',
            farewell: 'Que pena, @user saiu do grupo. 😢',
            farewellEnabled: true,
        })
    }
    return welcomeSettings.get(groupId)
}

/**
 * Chamado pelo handler quando alguém entra ou sai do grupo.
 */
async function handleGroupUpdate(sock, update) {
    const { id, participants, action } = update
    const settings = getSettings(id)

    for (const jid of participants) {
        const numero = jid.replace(/[^0-9]/g, '')
        const mencao = `@${numero}`

        if (action === 'add' && settings.enabled) {
            const mensagem = settings.message
                .replace(/@user/gi, mencao)
                .replace(/@nome/gi, mencao)

            // Tenta buscar foto de perfil do novo membro
            let profilePic = null
            try {
                profilePic = await sock.profilePictureUrl(jid, 'image')
            } catch {
                profilePic = null
            }

            if (profilePic) {
                try {
                    const res = await fetch(profilePic)
                    const buffer = await res.buffer()
                    await sock.sendMessage(id, {
                        image: buffer,
                        caption: mensagem,
                        mentions: [jid],
                    })
                } catch {
                    await sock.sendMessage(id, { text: mensagem, mentions: [jid] })
                }
            } else {
                await sock.sendMessage(id, { text: mensagem, mentions: [jid] })
            }
        }

        if (action === 'remove' && settings.farewellEnabled) {
            const mensagem = settings.farewell
                .replace(/@user/gi, mencao)
                .replace(/@nome/gi, mencao)
            await sock.sendMessage(id, { text: mensagem, mentions: [jid] })
        }
    }
}

// --- Comandos de configuração ---

async function bemvindo(ctx) {
    if (!ctx.isGroup) return ctx.reply('❌ Só funciona em grupos!')
    const { reply, react, text, from } = ctx
    const settings = getSettings(from)

    if (!text) {
        return reply(
            `🎉 *Configuração de Boas-vindas*\n\n` +
            `Status: ${settings.enabled ? '✅ Ativado' : '❌ Desativado'}\n\n` +
            `*Mensagem atual:*\n${settings.message}\n\n` +
            `*Variáveis:* @user = menção do membro\n\n` +
            `*Comandos:*\n` +
            `• *!bemvindo on/off* — ativa/desativa\n` +
            `• *!bemvindo msg [texto]* — define a mensagem\n` +
            `Exemplo: *!bemvindo msg Oi @user, bem-vindo! 🎉*`
        )
    }

    const arg = text.toLowerCase()

    if (arg === 'on') {
        settings.enabled = true
        await react('✅')
        return reply('✅ Boas-vindas *ativadas*!')
    }

    if (arg === 'off') {
        settings.enabled = false
        await react('❌')
        return reply('❌ Boas-vindas *desativadas*.')
    }

    if (arg.startsWith('msg ')) {
        const nova = text.slice(4).trim()
        if (!nova) return reply('❌ Informe a mensagem!\nUse @user para mencionar o novo membro.')
        settings.message = nova
        await react('✅')
        return reply(`✅ Mensagem de boas-vindas atualizada!\n\n*Prévia:*\n${nova.replace(/@user/gi, '@você')}`)
    }

    await reply(
        `❓ Opções: *on*, *off*, *msg [texto]*\n` +
        `Exemplo: *!bemvindo msg Oi @user! 🎉*`
    )
}

async function saida(ctx) {
    if (!ctx.isGroup) return ctx.reply('❌ Só funciona em grupos!')
    const { reply, react, text, from } = ctx
    const settings = getSettings(from)

    if (!text) {
        return reply(
            `👋 *Configuração de Despedida*\n\n` +
            `Status: ${settings.farewellEnabled ? '✅ Ativado' : '❌ Desativado'}\n\n` +
            `*Mensagem atual:*\n${settings.farewell}\n\n` +
            `*Comandos:*\n` +
            `• *!saida on/off* — ativa/desativa\n` +
            `• *!saida msg [texto]* — define a mensagem`
        )
    }

    const arg = text.toLowerCase()

    if (arg === 'on') {
        settings.farewellEnabled = true
        await react('✅')
        return reply('✅ Despedida *ativada*!')
    }

    if (arg === 'off') {
        settings.farewellEnabled = false
        await react('❌')
        return reply('❌ Despedida *desativada*.')
    }

    if (arg.startsWith('msg ')) {
        const nova = text.slice(4).trim()
        if (!nova) return reply('❌ Informe a mensagem!')
        settings.farewell = nova
        await react('✅')
        return reply(`✅ Mensagem de despedida atualizada!\n\n*Prévia:*\n${nova.replace(/@user/gi, '@você')}`)
    }

    await reply(`❓ Opções: *on*, *off*, *msg [texto]*`)
}

module.exports = { bemvindo, saida, handleGroupUpdate }
