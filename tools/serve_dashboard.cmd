@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8090"
python "%~dp0ctf_bank.py" serve --host 127.0.0.1 --port %PORT%
