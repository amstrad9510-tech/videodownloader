@echo off
title YOUTUBEDownloader
color 0A
cls
echo ========================================================
echo             YOUTUBEDownloader 
echo       Fast, Free & HD Video Saver Desktop App
echo ========================================================
echo.
echo [1/2] Starting local backend server on http://localhost:8000 ...
echo [2/2] Opening browser interface ...
echo.
echo App is running! Keep this window open while using the app.
echo Press Ctrl+C or close this window to stop the server.
echo.

cd /d "%~dp0"
start "" "http://localhost:8000"
python server.py

pause
