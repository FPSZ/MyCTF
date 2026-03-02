#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: ai_add.sh <wp|script|patch|note|file> <artifact_path> [status]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="${SCRIPT_DIR}/ctf_bank.py"

KIND="$1"
INPUT="$2"
STATUS="${3:-}"

if [[ -z "${STATUS}" ]]; then
  python "${PY_SCRIPT}" add --kind "${KIND}" --input "${INPUT}"
else
  python "${PY_SCRIPT}" add --kind "${KIND}" --input "${INPUT}" --status "${STATUS}"
fi
