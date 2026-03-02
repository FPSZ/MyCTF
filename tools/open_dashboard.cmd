@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8090"
set "URL=http://localhost:%PORT%/dashboard/workflow.html"
echo [INFO] opening: %URL%
start "" "%URL%"
python "%~dp0ctf_bank.py" serve --host 0.0.0.0 --port %PORT%
