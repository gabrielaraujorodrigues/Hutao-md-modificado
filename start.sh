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

echo "[INFO] Node.js: $(node -v)"

# Verifica se ffmpeg está instalado (necessário para sticker e áudio)
if ! command -v ffmpeg &> /dev/null; then
    echo "[AVISO] ffmpeg não encontrado. Stickers de vídeo podem não funcionar."
    echo "Para instalar: pkg install ffmpeg  (Termux) | apt install ffmpeg  (Ubuntu)"
else
    echo "[INFO] ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
fi

# Instala dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "[INFO] Instalando dependências..."
    npm install
fi

# Cria pasta de sessão se não existir
mkdir -p session/auth

echo "[INFO] Iniciando o bot..."
echo ""

# Tenta usar PM2 se disponível (mantém o bot rodando em background)
if command -v pm2 &> /dev/null; then
    echo "[INFO] PM2 encontrado — iniciando com PM2..."
    pm2 delete hutao-bot 2>/dev/null
    pm2 start index.js --name hutao-bot --restart-delay=5000 --max-restarts=50
    pm2 logs hutao-bot
else
    # Sem PM2: roda direto com loop de reinício automático
    while true; do
        node index.js
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ]; then
            echo "[INFO] Bot encerrado normalmente."
            break
        fi
        echo "[AVISO] Bot encerrado com código $EXIT_CODE. Reiniciando em 5s..."
        sleep 5
    done
fi
