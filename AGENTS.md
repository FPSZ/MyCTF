# Agent Workflow (CTF Bank)

When solving a CTF challenge with AI agents in this repository:

1. Start with intake:

```bash
python tools/ctf_bank.py create --source <challenge_path> --category auto --event <event> --year <year>
```

2. Add artifacts as they are produced:

```bash
python tools/ctf_bank.py add --kind wp --input <wp_file> --status done
python tools/ctf_bank.py add --kind script --input <script_file>
python tools/ctf_bank.py add --kind note --input <note_file>
```

3. Before finalizing a task:

```bash
python tools/ctf_bank.py sanitize
python tools/ctf_bank.py rebuild
```

4. Keep metadata and filenames deterministic and collaboration-friendly.
