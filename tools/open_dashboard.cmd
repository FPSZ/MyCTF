@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8090"
python "%~dp0open_dashboard.py" --host 127.0.0.1 --port %PORT%
