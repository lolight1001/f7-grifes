#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "Iniciando o site da F7 Grifes..."
echo ""
if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js nao encontrado neste computador."
  echo "Baixe e instale em https://nodejs.org antes de continuar."
  echo ""
  read -p "Pressione Enter para sair..."
  exit 1
fi
node server.js
echo ""
echo "O servidor foi encerrado."
read -p "Pressione Enter para fechar..."
