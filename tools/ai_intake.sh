#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ai_intake.sh <challenge_path> [event] [year]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="${SCRIPT_DIR}/ctf_bank.py"

SRC="$1"
EVENT="${2:-}"
YEAR="${3:-}"

if [[ -z "${YEAR}" ]]; then
  python "${PY_SCRIPT}" create --source "${SRC}" --category auto --event "${EVENT}"
else
  python "${PY_SCRIPT}" create --source "${SRC}" --category auto --event "${EVENT}" --year "${YEAR}"
fi
