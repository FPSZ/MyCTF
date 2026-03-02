@echo off
setlocal
if "%~2"=="" (
  echo Usage: ai_add.cmd ^<wp^|script^|patch^|note^|file^> ^<artifact_path^> [status]
  exit /b 1
)
set "SCRIPT=%~dp0ctf_bank.py"
set "KIND=%~1"
set "INPUT=%~2"
set "STATUS=%~3"

if "%STATUS%"=="" (
  python "%SCRIPT%" add --kind "%KIND%" --input "%INPUT%"
) else (
  python "%SCRIPT%" add --kind "%KIND%" --input "%INPUT%" --status "%STATUS%"
)
