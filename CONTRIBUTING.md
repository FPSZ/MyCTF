# Contributing Guide

## Scope

This repository stores CTF challenge knowledge in a structured way:

- challenge files
- writeups (WP)
- solve scripts
- patches
- notes

## First-Time Setup

1. Install Python 3.10+.
2. Clone the repository.
3. Run:

```bash
python tools/ctf_bank.py rebuild
```

4. Optional web UI preview:

```bash
python tools/ctf_bank.py serve --port 8090
```

## Team Workflow

1. Start a challenge:

```bash
python tools/ctf_bank.py create --source <challenge_path> --category auto --event <event> --year <year>
```

2. Add artifacts:

```bash
python tools/ctf_bank.py add --kind wp --input <wp_file> --status done
python tools/ctf_bank.py add --kind script --input <script_file>
```

3. Before pushing:

```bash
python tools/ctf_bank.py sanitize
python tools/ctf_bank.py rebuild
```

## Naming Conventions

- Case slug: lowercase words with `-`.
- Scripts: `<case>_solve.py` or clear equivalent.
- WP: `wp.md` or `<case>.md`.

## Review Checklist

- `metadata.json` exists and fields are correct.
- At least one WP or note explains the solve path.
- Added scripts are reproducible and have required dependencies documented.
- `dashboard/catalog.json` was rebuilt.

## Security / Privacy

- Do not commit private VPN files, tokens, credentials, or paid platform artifacts.
- Only include challenge files that are legally shareable.
