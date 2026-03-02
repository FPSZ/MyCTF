#!/usr/bin/env python3
"""Launch dashboard server and open browser when ready."""

from __future__ import annotations

import argparse
import importlib.util
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path


def load_ctf_bank_module():
    script_path = Path(__file__).resolve().parent / "ctf_bank.py"
    spec = importlib.util.spec_from_file_location("ctf_bank", script_path)
    if not spec or not spec.loader:
        raise RuntimeError("failed to load ctf_bank.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def open_when_ready(url: str, probe_url: str, retries: int = 60, delay: float = 0.25) -> None:
    for _ in range(retries):
        try:
            with urllib.request.urlopen(probe_url, timeout=1.2):
                webbrowser.open(url, new=2)
                return
        except Exception:
            time.sleep(delay)
    # fallback: open anyway, so user can manually refresh
    webbrowser.open(url, new=2)


def main() -> int:
    parser = argparse.ArgumentParser("open_dashboard")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    module = load_ctf_bank_module()
    url = f"http://localhost:{args.port}/dashboard/workflow.html"
    probe = f"http://127.0.0.1:{args.port}/api/current"

    print(f"[INFO] starting server at {args.host}:{args.port}")
    print(f"[INFO] workflow ui: {url}")

    opener = threading.Thread(target=open_when_ready, args=(url, probe), daemon=True)
    opener.start()

    serve_args = argparse.Namespace(host=args.host, port=args.port)
    return module.serve_dashboard(serve_args)


if __name__ == "__main__":
    raise SystemExit(main())
