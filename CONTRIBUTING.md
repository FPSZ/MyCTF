# 贡献指南

## 目标

这个仓库用于团队协作沉淀 CTF 题目资产，包含：

- 题目文件
- WP（Writeup）
- 解题脚本
- 补丁
- 备注

## 环境要求

- Python 3.10 及以上
- 可以正常运行 `python` 命令

## 首次使用

1. 克隆仓库。
2. 在仓库根目录执行：

```bash
python tools/ctf_bank.py rebuild
```

3. 可选：启动网页查看

```bash
python tools/ctf_bank.py serve --port 8090
```

## 协作流程

1. 开始做题时先入库：

```bash
python tools/ctf_bank.py create --source <题目路径> --category auto --event <比赛名> --year <年份>
```

2. 产出 WP/脚本后及时追加：

```bash
python tools/ctf_bank.py add --kind wp --input <wp文件> --status done
python tools/ctf_bank.py add --kind script --input <脚本文件>
```

3. 推送前必须执行：

```bash
python tools/ctf_bank.py sanitize
python tools/ctf_bank.py rebuild
```

Windows 也可直接用：

```bat
tools\pre_share.cmd
```

## 命名建议

- 题目目录 slug：小写，单词间用 `-`
- 解题脚本：建议 `<题名>_solve.py`
- WP 文件：建议 `wp.md` 或 `<题名>.md`

## 提交检查清单

- `metadata.json` 字段完整
- 至少有一份 WP 或 note
- 脚本可复现，依赖写清楚
- `dashboard/catalog.json` 已重建

## 安全要求

- 禁止提交任何密钥、Token、VPN、账号密码
- 仅提交可公开分发的题目与附件
- 提交前确认不包含个人本机隐私路径（`sanitize` 会清理历史字段）
