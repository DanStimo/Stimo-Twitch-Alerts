@echo off

cd /d "D:\Stimo Stream Alerts\Server"

taskkill /F /IM node.exe >nul 2>&1

start cmd /k node server.js

exit