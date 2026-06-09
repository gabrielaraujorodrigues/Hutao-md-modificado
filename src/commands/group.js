const { jidNormalizedUser } = require('@whiskeysockets/baileys')

function requireGroup(ctx) {
    if (!ctx.isGroup) {
        ctx.reply('❌ Esse comando só funciona em grupos!')
        return false
    }
    return true
}

async function requireAdmin(ctx) {
    const { sock, from, senderNum } = ctx
    const meta = await sock.groupMetadata(from)
    const admins = meta.participants.filter(p => p.admin).map(p => p.id.replace(/[^0-9]/g, ''))
    const isAdmin = admins.includes(senderNum) || ctx.isOwner
    if (!isAdmin) {
        await ctx.reply('❌ Você precisa ser *admin* do grupo para usar esse comando!')
        return false
    }
    return true
}

async function ban(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, msg, reply } = ctx

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        (msg.message?.extendedTextMessage?.contextInfo?.participant ? [msg.message.extendedTextMessage.contextInfo.participant] : [])

    if (!mentioned.length) return reply('❌ Marque o membro que deseja banir!\nExemplo: *!ban @pessoa*')

    for (const jid of mentioned) {
        await sock.groupParticipantsUpdate(from, [jid], 'remove')
    }
    await reply(`✅ ${mentioned.length} membro(s) removido(s) do grupo.`)
}

async function add(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, reply, text } = ctx

    const numero = text.replace(/[^0-9]/g, '')
    if (!numero || numero.length < 8) return reply('❌ Informe o número!\nExemplo: *!add 5511999999999*')

    const jid = `${numero}@s.whatsapp.net`
    const result = await sock.groupParticipantsUpdate(from, [jid], 'add')
    const status = result?.[0]?.status

    if (status === '200') return reply('✅ Membro adicionado com sucesso!')
    if (status === '403') return reply('❌ O número não aceita ser adicionado (privacidade).')
    if (status === '404') return reply('❌ Número não encontrado no WhatsApp.')
    return reply(`ℹ️ Status: ${status}`)
}

async function promote(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, msg, reply } = ctx

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Marque o membro para promover!\nExemplo: *!promote @pessoa*')

    await sock.groupParticipantsUpdate(from, mentioned, 'promote')
    await reply(`✅ Promovido(s) a admin com sucesso!`)
}

async function demote(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, msg, reply } = ctx

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Marque o admin para rebaixar!\nExemplo: *!demote @pessoa*')

    await sock.groupParticipantsUpdate(from, mentioned, 'demote')
    await reply(`✅ Admin(s) rebaixado(s) com sucesso!`)
}

async function everyone(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, text, reply } = ctx

    const meta = await sock.groupMetadata(from)
    const members = meta.participants.map(p => p.id)

    await sock.sendMessage(from, {
        text: text || '📢 Atenção a todos!',
        mentions: members,
    })
}

async function hidetag(ctx) {
    return everyone(ctx)
}

async function link(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, reply } = ctx

    const code = await sock.groupInviteCode(from)
    await reply(`🔗 Link do grupo:\nhttps://chat.whatsapp.com/${code}`)
}

async function revoke(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, reply } = ctx

    await sock.groupRevokeInvite(from)
    const code = await sock.groupInviteCode(from)
    await reply(`✅ Link renovado!\n🔗 Novo link:\nhttps://chat.whatsapp.com/${code}`)
}

async function ginfo(ctx) {
    if (!requireGroup(ctx)) return
    const { sock, from, reply } = ctx

    const meta = await sock.groupMetadata(from)
    const admins = meta.participants.filter(p => p.admin).length
    const total = meta.participants.length

    await reply(
        `📋 *Informações do Grupo*\n\n` +
        `📌 *Nome:* ${meta.subject}\n` +
        `👥 *Membros:* ${total}\n` +
        `👑 *Admins:* ${admins}\n` +
        `📝 *Descrição:* ${meta.desc || 'Sem descrição'}\n` +
        `🕐 *Criado em:* ${new Date(meta.creation * 1000).toLocaleDateString('pt-BR')}`
    )
}

async function fechar(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, reply } = ctx

    await sock.groupSettingUpdate(from, 'announcement')
    await reply('🔒 Grupo fechado! Apenas admins podem enviar mensagens.')
}

async function abrir(ctx) {
    if (!requireGroup(ctx)) return
    if (!await requireAdmin(ctx)) return
    const { sock, from, reply } = ctx

    await sock.groupSettingUpdate(from, 'not_announcement')
    await reply('🔓 Grupo aberto! Todos podem enviar mensagens.')
}

module.exports = {
    ban, add, promote, admim: promote, demote, everyone, hidetag,
    link, revoke, ginfo, fechar, abrir,
}
