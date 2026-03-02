#!/usr/bin/env python3
"""CTF challenge bank manager.

Usage examples:
  python tools/ctf_bank.py create --source D:\\CTF\\题目\\foo.exe --category auto
  python tools/ctf_bank.py add --kind wp --input D:\\tmp\\wp.md
  python tools/ctf_bank.py current
  python tools/ctf_bank.py sanitize
  python tools/ctf_bank.py rebuild
  python tools/ctf_bank.py serve --port 8090
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Iterable


BANK_ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_DIR = BANK_ROOT / "dashboard"
CATALOG_FILE = DASHBOARD_DIR / "catalog.json"
CURRENT_CASE_FILE = BANK_ROOT / "tools" / ".current_case.json"

CATEGORY_TREE: dict[str, list[str]] = {
    "web": [
        "sqli",
        "xss",
        "ssti",
        "rce",
        "file-upload",
        "deserialization",
        "ssrf",
        "jwt-auth",
        "logic-race",
        "xxe",
        "graphql-api",
    ],
    "re": [
        "native-linux",
        "native-windows",
        "android-re",
        "ios-re",
        "dotnet-java",
        "vm-obfuscation",
        "packing-unpacking",
        "symbolic-execution",
    ],
    "pwn": [
        "stack",
        "heap",
        "fmtstr",
        "rop-srop",
        "shellcode",
        "kernel",
        "sandbox-escape",
        "browser-wasm",
    ],
    "misc": ["stego", "network-pcap", "osint", "programming", "iot", "game-hack"],
    "ai": [
        "prompt-injection",
        "jailbreak",
        "agent-abuse",
        "model-extraction",
        "data-poisoning",
        "llm-forensics",
    ],
    "crypto": ["classical", "hash", "block-cipher", "rsa", "ecc", "lattice", "prng"],
    "forensics": ["disk", "memory", "log", "malware", "mobile", "cloud"],
    "mobile": ["android", "ios", "baseband"],
    "blockchain": ["solidity-evm", "defi", "cross-chain", "wallet"],
    "hardware": ["firmware", "uart-jtag", "rf-rfid", "side-channel"],
}

RESERVED_TOPLEVEL = {"tools", "dashboard", ".github", ".git", "docs"}
CASE_SUBDIRS = ("challenge", "wp", "scripts", "patches", "files", "notes")


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^\w\-.\u4e00-\u9fff]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "unnamed"


def ensure_case_structure(case_dir: Path) -> None:
    for name in CASE_SUBDIRS:
        (case_dir / name).mkdir(parents=True, exist_ok=True)


def choose_subcategory(category: str, preferred: str | None) -> str:
    options = CATEGORY_TREE[category]
    if preferred and preferred in options:
        return preferred
    return options[0]


def infer_category_subcategory(source: Path, name_hint: str) -> tuple[str, str]:
    ext = source.suffix.lower()
    joined = f"{source.name} {name_hint}".lower()

    if ext in {".apk", ".dex"} or any(k in joined for k in ("android", "smali", "jadx")):
        return ("re", "android-re")
    if ext in {".exe", ".dll"} or "windows" in joined:
        return ("re", "native-windows")
    if ext in {".elf", ".so"} or any(k in joined for k in ("linux", "glibc", "elf")):
        return ("re", "native-linux")
    if ext in {".pcap", ".pcapng"}:
        return ("misc", "network-pcap")
    if ext in {".sol"} or any(k in joined for k in ("solidity", "evm", "defi", "blockchain")):
        return ("blockchain", "solidity-evm")
    if any(k in joined for k in ("sqli", "xss", "ssti", "ssrf", "web", "jwt", "graphql")):
        return ("web", "sqli")
    if any(k in joined for k in ("heap", "rop", "fmt", "shellcode", "pwn")):
        return ("pwn", "stack")
    if any(k in joined for k in ("rsa", "aes", "crypto", "ecc", "hash", "lattice")):
        return ("crypto", "classical")
    if any(k in joined for k in ("forensics", "memory", "disk", "malware")):
        return ("forensics", "memory")
    if any(k in joined for k in ("ai", "llm", "prompt", "jailbreak", "model")):
        return ("ai", "prompt-injection")
    return ("misc", "programming")


def copy_any(src: Path, dst: Path) -> None:
    if src.is_dir():
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def make_source_ref(source: Path) -> str:
    try:
        return source.relative_to(BANK_ROOT).as_posix()
    except ValueError:
        return source.name


def set_current_case(case_id: str, case_dir: Path) -> None:
    payload = {
        "id": case_id,
        "path": str(case_dir),
        "updated_at": now_iso(),
    }
    write_json(CURRENT_CASE_FILE, payload)


def get_current_case() -> Path | None:
    if not CURRENT_CASE_FILE.exists():
        return None
    try:
        data = read_json(CURRENT_CASE_FILE)
    except Exception:
        return None

    case_path = data.get("path", "")
    if case_path:
        current = Path(case_path)
        if (current / "metadata.json").exists():
            return current

    case_id = data.get("id", "")
    if case_id:
        found = find_case(case_id)
        if found:
            return found

    try:
        CURRENT_CASE_FILE.unlink(missing_ok=True)
    except Exception:
        pass
    return None


def create_case(args: argparse.Namespace) -> int:
    source = Path(args.source).resolve()
    if not source.exists():
        print(f"[ERROR] source not found: {source}")
        return 1

    given_name = args.name or source.stem or source.name
    case_name = slugify(given_name)

    if args.category == "auto":
        category, subcategory = infer_category_subcategory(source, given_name)
    else:
        category = args.category
        subcategory = args.subcategory or choose_subcategory(category, None)

    if category not in CATEGORY_TREE:
        print(f"[ERROR] invalid category: {category}")
        return 1
    if subcategory not in CATEGORY_TREE[category]:
        print(f"[ERROR] invalid subcategory '{subcategory}' for category '{category}'")
        return 1

    case_dir = BANK_ROOT / category / subcategory / case_name
    if case_dir.exists() and not args.force:
        print(f"[ERROR] case already exists: {case_dir}")
        print("Use --force to overwrite.")
        return 1

    if case_dir.exists() and args.force:
        shutil.rmtree(case_dir)

    ensure_case_structure(case_dir)

    challenge_dst = case_dir / "challenge" / source.name
    copy_any(source, challenge_dst)

    metadata = {
        "id": f"{category}/{subcategory}/{case_name}",
        "name": given_name,
        "slug": case_name,
        "category": category,
        "subcategory": subcategory,
        "event": args.event or "",
        "year": args.year or "",
        "difficulty": args.difficulty or "",
        "status": "todo",
        "tags": args.tags or [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "source_ref": args.source_ref or make_source_ref(source),
    }
    if args.keep_source_path:
        metadata["source_path"] = str(source)
    write_json(case_dir / "metadata.json", metadata)
    set_current_case(metadata["id"], case_dir)

    readme = (
        f"# {given_name}\n\n"
        f"- Category: `{category}/{subcategory}`\n"
        f"- Event: `{metadata['event']}`\n"
        f"- Year: `{metadata['year']}`\n"
        f"- Difficulty: `{metadata['difficulty']}`\n"
        f"- Status: `{metadata['status']}`\n\n"
        "## Quick Notes\n\n"
        "- Entry point:\n"
        "- Key checks:\n"
        "- Exploit/solve idea:\n"
    )
    (case_dir / "README.md").write_text(readme, encoding="utf-8")

    print(f"[OK] case created: {case_dir}")
    print(f"[OK] current case: {metadata['id']}")
    rebuild_catalog(verbose=False)
    return 0


def find_case(case_ref: str) -> Path | None:
    ref = Path(case_ref)
    if ref.is_absolute() and (ref / "metadata.json").exists():
        return ref

    rel = BANK_ROOT / case_ref
    if (rel / "metadata.json").exists():
        return rel

    for md in BANK_ROOT.rglob("metadata.json"):
        data = read_json(md)
        if data.get("id") == case_ref or data.get("slug") == case_ref:
            return md.parent
    return None


def add_artifact(args: argparse.Namespace) -> int:
    case_dir = find_case(args.case) if args.case else get_current_case()
    if not case_dir:
        if args.case:
            print(f"[ERROR] case not found: {args.case}")
        else:
            print("[ERROR] no current case set. Run create/ai_intake first or pass --case.")
        return 1

    src = Path(args.input).resolve()
    if not src.exists():
        print(f"[ERROR] artifact not found: {src}")
        return 1

    kind_map = {
        "wp": "wp",
        "script": "scripts",
        "patch": "patches",
        "note": "notes",
        "file": "files",
    }
    dst_root = case_dir / kind_map[args.kind]
    dst = dst_root / src.name
    copy_any(src, dst)

    md_path = case_dir / "metadata.json"
    data = read_json(md_path)
    data["updated_at"] = now_iso()
    if args.status:
        data["status"] = args.status
    write_json(md_path, data)
    set_current_case(data.get("id", case_dir.relative_to(BANK_ROOT).as_posix()), case_dir)

    print(f"[OK] added {args.kind}: {dst}")
    rebuild_catalog(verbose=False)
    return 0


def show_current_case(_args: argparse.Namespace) -> int:
    case_dir = get_current_case()
    if not case_dir:
        print("[ERROR] no current case set")
        return 1
    md = read_json(case_dir / "metadata.json")
    print(f"[OK] current case id: {md.get('id', '-')}")
    print(f"[OK] current case path: {case_dir}")
    return 0


def sanitize_metadata(args: argparse.Namespace) -> int:
    changed = 0
    for case_dir in iter_case_dirs():
        md_path = case_dir / "metadata.json"
        data = read_json(md_path)

        source_path = data.pop("source_path", None)
        if source_path and not data.get("source_ref"):
            data["source_ref"] = Path(source_path).name
        if args.drop_source_ref:
            data.pop("source_ref", None)

        write_json(md_path, data)
        changed += 1

    rebuild_catalog(verbose=False)
    print(f"[OK] sanitized metadata files: {changed}")
    return 0


def safe_read_text(path: Path, limit_chars: int = 12000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    return text[:limit_chars]


def iter_case_dirs() -> Iterable[Path]:
    for cat_dir in BANK_ROOT.iterdir():
        if not cat_dir.is_dir() or cat_dir.name in RESERVED_TOPLEVEL or cat_dir.name.startswith("."):
            continue
        for sub_dir in cat_dir.iterdir():
            if not sub_dir.is_dir():
                continue
            for case_dir in sub_dir.iterdir():
                if case_dir.is_dir() and (case_dir / "metadata.json").exists():
                    yield case_dir


def rebuild_catalog(verbose: bool = True) -> dict:
    cases: list[dict] = []
    stats = {"total_cases": 0, "by_category": {}, "updated_at": now_iso()}

    for case_dir in iter_case_dirs():
        md = read_json(case_dir / "metadata.json")
        rel_case = case_dir.relative_to(BANK_ROOT).as_posix()

        wp_files = sorted((case_dir / "wp").glob("*"))
        wp_rel = [p.relative_to(BANK_ROOT).as_posix() for p in wp_files if p.is_file()]

        wp_preview = ""
        if wp_files:
            wp_preview = safe_read_text(wp_files[0], limit_chars=2000)

        script_files = sorted((case_dir / "scripts").glob("*"))
        challenge_files = sorted((case_dir / "challenge").glob("*"))

        item = {
            "id": md.get("id", rel_case),
            "name": md.get("name", case_dir.name),
            "slug": md.get("slug", case_dir.name),
            "category": md.get("category", "unknown"),
            "subcategory": md.get("subcategory", "unknown"),
            "event": md.get("event", ""),
            "year": md.get("year", ""),
            "difficulty": md.get("difficulty", ""),
            "status": md.get("status", "todo"),
            "tags": md.get("tags", []),
            "path": rel_case,
            "created_at": md.get("created_at", ""),
            "updated_at": md.get("updated_at", ""),
            "wp_files": wp_rel,
            "wp_preview": wp_preview,
            "script_files": [p.relative_to(BANK_ROOT).as_posix() for p in script_files if p.is_file()],
            "challenge_files": [p.relative_to(BANK_ROOT).as_posix() for p in challenge_files if p.is_file()],
        }
        cases.append(item)

        category = item["category"]
        stats["by_category"][category] = stats["by_category"].get(category, 0) + 1

    cases.sort(key=lambda x: (x["category"], x["subcategory"], x["name"].lower()))
    stats["total_cases"] = len(cases)
    payload = {"stats": stats, "cases": cases}
    write_json(CATALOG_FILE, payload)

    if verbose:
        print(f"[OK] catalog rebuilt: {CATALOG_FILE}")
        print(f"     total cases: {stats['total_cases']}")
    return payload


def serve_dashboard(args: argparse.Namespace) -> int:
    rebuild_catalog(verbose=False)
    os.chdir(str(BANK_ROOT))
    host = args.host
    port = args.port
    print(f"[OK] serving: http://{host}:{port}/dashboard/index.html")
    server = ThreadingHTTPServer((host, port), SimpleHTTPRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser("ctf_bank")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create", help="Create a challenge case and auto-place it")
    p_create.add_argument("--source", required=True, help="Path to challenge file or folder")
    p_create.add_argument("--name", help="Display name (default from source)")
    p_create.add_argument(
        "--category",
        default="auto",
        choices=["auto", *CATEGORY_TREE.keys()],
        help="Top-level category or auto",
    )
    p_create.add_argument("--subcategory", help="Subcategory (optional)")
    p_create.add_argument("--event", help="CTF event name")
    p_create.add_argument("--year", help="Event year, e.g. 2026")
    p_create.add_argument("--difficulty", help="Difficulty label, e.g. easy/medium/hard")
    p_create.add_argument("--tags", nargs="*", default=[], help="Optional tags")
    p_create.add_argument("--source-ref", help="Optional source reference shown in metadata")
    p_create.add_argument(
        "--keep-source-path",
        action="store_true",
        help="Store absolute source path in metadata (not recommended for shared repos)",
    )
    p_create.add_argument("--force", action="store_true", help="Overwrite if case exists")
    p_create.set_defaults(func=create_case)

    p_add = sub.add_parser("add", help="Add artifact to an existing case")
    p_add.add_argument("--case", help="Case path/id/slug (optional if current case is set)")
    p_add.add_argument("--kind", required=True, choices=["wp", "script", "patch", "note", "file"])
    p_add.add_argument("--input", required=True, help="Artifact file/folder path")
    p_add.add_argument("--status", help="Optional status update")
    p_add.set_defaults(func=add_artifact)

    p_current = sub.add_parser("current", help="Show current active case")
    p_current.set_defaults(func=show_current_case)

    p_sanitize = sub.add_parser("sanitize", help="Sanitize metadata for sharing")
    p_sanitize.add_argument(
        "--drop-source-ref",
        action="store_true",
        help="Also remove source_ref from metadata",
    )
    p_sanitize.set_defaults(func=sanitize_metadata)

    p_rebuild = sub.add_parser("rebuild", help="Rebuild dashboard catalog index")
    p_rebuild.set_defaults(func=lambda _a: (rebuild_catalog(verbose=True), 0)[1])

    p_serve = sub.add_parser("serve", help="Serve bank root and dashboard locally")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8090)
    p_serve.set_defaults(func=serve_dashboard)

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
