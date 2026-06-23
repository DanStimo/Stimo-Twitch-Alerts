@echo off
title Stimo Stream Alerts

echo Starting Alert Server...
start "Alert Server" cmd /k "cd /d D:\Stimo Stream Alerts\Server && node server.js"

timeout /t 3 /nobreak >nul

echo Starting ngrok...
start "ngrok" cmd /k "cd /d D:\Tools\ngrok\ngrok-v3-stable-windows-amd64 && ngrok http 3000"

echo.
echo All services launched.
pause