#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8090}"

python "${SCRIPT_DIR}/ctf_bank.py" serve --port "${PORT}"
