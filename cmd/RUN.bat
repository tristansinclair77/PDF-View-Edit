@echo off
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
call npx electron-vite dev
pause
