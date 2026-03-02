@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8090"
python "%~dp0ctf_bank.py" serve --port %PORT%
