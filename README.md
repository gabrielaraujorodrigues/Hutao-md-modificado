# 🌸 HutaoBot-MD Modificado

Bot WhatsApp Multi-Device feito com [Baileys](https://github.com/WhiskeySockets/Baileys) — **sem restrições de licença ou key**.

---

## ✅ Requisitos

- Node.js 18+ (recomendado: **NodeJS LTS**)
- ffmpeg (para figurinhas de vídeo e áudio)
- Git

---

## 📲 Instalação no Termux

```bash
# 1. Permitir acesso ao armazenamento
termux-setup-storage

# 2. Atualizar pacotes
pkg upgrade -y && pkg update -y

# 3. Instalar dependências do sistema
pkg install -y ffmpeg nodejs-lts git wget

# 4. Clonar o repositório
git clone https://github.com/SEU_USUARIO/Hutao-md-modificado
cd Hutao-md-modificado

# 5. Instalar dependências Node
npm install

# 6. Iniciar o bot
npm start
# ou
node connect.js
# ou
bash start.sh
```

---

## ⚙️ Configuração

Edite o arquivo **`config.js`** antes de iniciar:

```js
module.exports = {
    prefix: '!',               // Prefixo dos comandos
    ownerNumber: '5511999999999', // Seu número (só números)
    botName: 'HutaoBot-MD',
    ownerName: 'Seu Nome',
}
```

---

## 📋 Comandos

| Categoria | Comandos |
|-----------|----------|
| 🎵 Músicas | `!play`, `!ytmp3`, `!ytmp4`, `!video` |
| 📥 Downloads | `!tiktok`, `!instagram`, `!twitter`, `!threads`, `!pinterest` |
| 🎨 Figurinhas | `!sticker`, `!figurinha`, `!s`, `!stealsticker` |
| 🤖 IA | `!ia`, `!gpt`, `!gemini`, `!traduzir` |
| 🔍 Busca | `!anime`, `!letra`, `!cep`, `!clima`, `!noticias` |
| 🧮 Utils | `!calc`, `!ping`, `!uptime`, `!dono` |
| 😂 Diversão | `!cantada`, `!curiosidade`, `!conselho`, `!piada`, `!ship`, `!simsim`, `!dado`, `!sorte`, `!coinflip`, `!escolher` |
| 👥 Grupos | `!ban`, `!add`, `!promote`, `!demote`, `!everyone`, `!link`, `!ginfo`, `!fechar`, `!abrir` |

Use `!menu` para ver todos os comandos no bot.

---

## 📝 Notas

- **Play/YouTube**: usa `yt-dlp` internamente — atualizado regularmente e não bloqueado pelo YouTube.
- **Figurinha**: requer `ffmpeg` instalado no sistema.
- A sessão fica salva na pasta `session/` — não delete para não precisar escanear o QR novamente.

---

## 📄 Licença

MIT — livre para usar, modificar e distribuir.
