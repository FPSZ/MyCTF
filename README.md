# CTF 题库（协作版）

这个仓库就做一件事：  
把题目、WP、脚本统一归档，并用网页可视化查看。

## 1. 新人只看这 6 步（Windows）

先进入仓库根目录后执行：

```bat
tools\ai_intake.cmd "D:\CTF\题目\sample.exe" "MyCTF" 2026
tools\ai_current.cmd
tools\ai_add.cmd wp "D:\CTF\wp\sample.md" done
tools\ai_add.cmd script "D:\CTF\tool\solve.py"
tools\rebuild_dashboard.cmd
tools\serve_dashboard.cmd 8090
```

浏览器打开：`http://127.0.0.1:8090/dashboard/index.html`

## 2. 每条命令是干什么的

- `ai_intake.cmd`：新题入库（自动分类），并设为“当前题目”
- `ai_current.cmd`：查看当前题目是谁
- `ai_add.cmd wp ...`：给当前题加 WP
- `ai_add.cmd script ...`：给当前题加解题脚本
- `rebuild_dashboard.cmd`：重建网页索引
- `serve_dashboard.cmd`：启动本地网页

## 3. 团队协作提交前必须做

```bat
tools\pre_share.cmd
```

它会自动执行：

1. `sanitize`：清理可能泄露本机路径的元数据  
2. `rebuild`：重建 `dashboard/catalog.json`

## 4. Linux/macOS 用法

```bash
chmod +x tools/*.sh
./tools/ai_intake.sh "/path/to/sample" "MyCTF" 2026
./tools/ai_current.sh
./tools/ai_add.sh wp "/path/to/sample.md" done
./tools/ai_add.sh script "/path/to/solve.py"
./tools/pre_share.sh
./tools/serve_dashboard.sh 8090
```

## 5. 目录结构（了解即可）

每题会被放到：

```text
<category>/<subcategory>/<case-slug>/
  metadata.json
  challenge/
  wp/
  scripts/
  patches/
  files/
  notes/
```

## 6. 常见问题

1. 题目分类不准怎么办？  
用 `python tools/ctf_bank.py create --source <path> --category <cat> --subcategory <subcat>` 手动指定。

2. 不想依赖“当前题目”怎么办？  
用 `python tools/ctf_bank.py add --case "<id>" --kind wp --input "<file>"`。

3. 哪些东西不能提交？  
任何 token、私钥、VPN、付费平台文件、不可公开题目资源。
