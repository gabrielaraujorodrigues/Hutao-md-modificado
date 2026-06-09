#!/bin/bash

echo ""
echo "╔══════════════════════════════╗"
echo "║      HutaoBot-MD — Start     ║"
echo "╚══════════════════════════════╝"
echo ""

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado. Instale com: pkg install nodejs-lts"
    exit 1
fi

# Verifica se ffmpeg está instalado (necessário para sticker e áudio)
if ! command -v ffmpeg &> /dev/null; then
    echo "[AVISO] ffmpeg não encontrado. Stickers de vídeo podem não funcionar."
    echo "Para instalar: pkg install ffmpeg"
fi

# Instala dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "[INFO] Instalando dependências..."
    npm install
fi

# Inicia o bot
echo "[INFO] Iniciando o bot..."
node index.js
