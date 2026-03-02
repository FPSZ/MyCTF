@echo off
setlocal
python "%~dp0ctf_bank.py" sanitize
if errorlevel 1 exit /b 1
python "%~dp0ctf_bank.py" rebuild
