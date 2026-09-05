@echo off
title F7 Grifes - servidor local
echo.
echo Iniciando o site da F7 Grifes...
echo.
node --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado neste computador.
  echo Baixe e instale em https://nodejs.org antes de continuar.
  echo.
  pause
  exit /b 1
)
node server.js
echo.
echo O servidor foi encerrado. Feche esta janela ou pressione uma tecla.
pause >nul
