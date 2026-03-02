# CTF Challenge Bank

结构化管理 CTF 题目、WP、脚本与附件，并提供网页可视化检索。

## Features

- 全题型目录树（web/re/pwn/misc/ai/crypto/forensics/mobile/blockchain/hardware）
- 自动分类入库（按扩展名 + 关键词）
- 当前题目上下文（追加 WP/脚本时可免写 `--case`）
- Dashboard 可视化查看分类、状态、WP 预览
- 支持协作前脱敏（`sanitize`）

## Repository Layout

```text
<repo-root>/
  web/ re/ pwn/ misc/ ai/ crypto/ forensics/ mobile/ blockchain/ hardware/
  dashboard/
    index.html
    catalog.json
    css/
    js/
  tools/
    ctf_bank.py
    ai_intake.(cmd|sh)
    ai_add.(cmd|sh)
    ai_current.(cmd|sh)
    rebuild_dashboard.(cmd|sh)
    serve_dashboard.(cmd|sh)
    pre_share.(cmd|sh)
```

每道题目录约定：

```text
<category>/<subcategory>/<case-slug>/
  metadata.json
  README.md
  challenge/
  wp/
  scripts/
  patches/
  files/
  notes/
```

## Quick Start

要求：Python 3.10+

### Windows

```bat
tools\ai_intake.cmd "D:\CTF\题目\sample.exe" "MyCTF" 2026
tools\ai_current.cmd
tools\ai_add.cmd wp "D:\CTF\wp\sample.md" done
tools\ai_add.cmd script "D:\CTF\tool\solve.py"
tools\rebuild_dashboard.cmd
tools\serve_dashboard.cmd 8090
```

### Linux / macOS

```bash
chmod +x tools/*.sh
./tools/ai_intake.sh "/path/to/sample" "MyCTF" 2026
./tools/ai_current.sh
./tools/ai_add.sh wp "/path/to/sample.md" done
./tools/ai_add.sh script "/path/to/solve.py"
./tools/rebuild_dashboard.sh
./tools/serve_dashboard.sh 8090
```

打开：`http://127.0.0.1:8090/dashboard/index.html`

## CLI Commands

```bash
python tools/ctf_bank.py create --source <path> --category auto --event <event> --year <year>
python tools/ctf_bank.py add --kind <wp|script|patch|note|file> --input <path> [--status done]
python tools/ctf_bank.py current
python tools/ctf_bank.py sanitize
python tools/ctf_bank.py rebuild
python tools/ctf_bank.py serve --port 8090
```

说明：

- `create` 默认写入 `source_ref`（相对路径或文件名），避免泄露本机绝对路径。
- 仅在明确需要时使用 `--keep-source-path`。
- `sanitize` 会移除历史 `source_path` 字段，适合 push 前清理。

## GitHub Collaboration Workflow

1. 新题开始时先 `create`（或 `ai_intake`）。
2. 解题中持续 `add` WP/脚本/补丁/附件。
3. 提交前执行：

```bash
python tools/ctf_bank.py sanitize
python tools/ctf_bank.py rebuild
```

4. 提交 PR，评审后合并。

推荐提交粒度：

- 一个 challenge 一个提交，或一个 challenge 的一个里程碑（初始分析 / 完整 WP / 脚本修复）。

## Classification Rules (简版)

- `.apk/.dex` -> `re/android-re`
- `.exe/.dll` -> `re/native-windows`
- `.elf/.so` -> `re/native-linux`
- `.pcap/.pcapng` -> `misc/network-pcap`
- `.sol` 或区块链关键词 -> `blockchain/solidity-evm`
- 关键词 fallback: web/pwn/crypto/forensics/ai
- 默认 -> `misc/programming`

## Notes

- 仅提交可公开分发的题目文件与素材。
- 不要提交 token、私钥、VPN 配置或任何敏感数据。
- 协作细则见 `CONTRIBUTING.md`。
