@echo off
setlocal
if "%~1"=="" (
  echo Usage: ai_intake.cmd ^<challenge_path^> [event] [year]
  exit /b 1
)
set "SCRIPT=%~dp0ctf_bank.py"
set "SRC=%~1"
set "EVENT=%~2"
set "YEAR=%~3"

if "%YEAR%"=="" (
  python "%SCRIPT%" create --source "%SRC%" --category auto --event "%EVENT%"
) else (
  python "%SCRIPT%" create --source "%SRC%" --category auto --event "%EVENT%" --year "%YEAR%"
)
