@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   松语小屋 · Pinewhisper
echo   正在点亮林间的灯...
echo.
start "" "http://127.0.0.1:8765/"
node server.mjs
pause
