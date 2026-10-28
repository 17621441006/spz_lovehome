@echo off
cd /d %~dp0
python restore_assets.py
if errorlevel 1 exit /b 1
start "" http://localhost:8642/
python -m http.server 8642 --directory dist
pause
