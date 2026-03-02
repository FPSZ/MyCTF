# AI 工作文档（接班手册）

本文档给下一个 AI/开发者快速上手本项目使用。  
目标是 10 分钟内看懂项目、跑起来、知道下一步改哪里。

## 1. 项目目标

这是一个 CTF 题库协作仓库，核心能力：

1. 统一归档题目、WP、脚本、附件。
2. 提供网页可视化管理（分类、筛选、编辑、保存）。
3. 支持团队协作，便于上传 GitHub。

## 2. 当前项目结构（重点）

仓库根目录关键路径：

```text
dashboard/
  index.html              # 主面板
  workflow.html           # 一键流程页
  css/styles.css          # 主样式
  js/main.js              # 主交互逻辑（筛选、详情、保存、标签页、MD预览）
  js/ui.js                # 视图渲染
  js/api.js               # 前端 API 调用
  catalog.json            # 题库索引（自动生成）

tools/
  ctf_bank.py             # 后端 + CLI 主程序（最重要）
  serve_dashboard.cmd     # 启动服务
  open_dashboard.cmd      # 启动并打开页面
  pre_share.cmd           # 清理+重建（提交前）

<category>/<subcategory>/<case-slug>/
  metadata.json
  challenge/
  wp/
  scripts/
  files/
  notes/
  patches/
```

## 3. 当前功能状态（截至本次）

已完成：

1. 题目详情支持单按钮保存（含 `Ctrl+S`）。
2. 未保存改动离开提醒。
3. 题解/脚本标签页支持：
   - 新建 `WP`、新建 `脚本`
   - 内联重命名
   - 删除标签
   - 分组展示（WP 一组、脚本一组）
4. WP 支持 Markdown 预览与编辑切换（默认预览）。
5. 左侧支持难度筛选和难度排序。
6. 列表支持“打开题目目录”按钮。

后端接口现状：

1. `POST /api/intake-upload`：新题入库。
2. `POST /api/add-upload`：追加上传单个产物文件。
3. `POST /api/case-update`：更新 metadata。
4. `POST /api/artifact-save`：保存 WP/脚本文本内容。
5. `POST /api/open-case`：打开题目目录。

## 4. 本地启动与验证

在仓库根目录执行：

```bat
tools\serve_dashboard.cmd 8090
```

打开：

- `http://127.0.0.1:8090/dashboard/index.html`

建议每次改前端后做：

```bat
node --check dashboard/js/main.js
node --check dashboard/js/ui.js
python -m py_compile tools/ctf_bank.py
```

## 5. 快速定位（下一个 AI 常用）

1. 筛选与排序逻辑：`dashboard/js/main.js` 的 `applyFilters`。
2. 题目详情渲染：`dashboard/js/ui.js` 的 `renderCaseDetail`。
3. 标签页逻辑：`dashboard/js/main.js` 的 `rebuildArtifactTabButtons` / `bindArtifactPager`。
4. Markdown 预览渲染：`dashboard/js/main.js` 的 `renderMarkdownToHtml`。
5. 上传接口处理：`tools/ctf_bank.py` 的 `_handle_add_upload` 与 `add_artifact`。

## 6. 约束与注意事项

1. 该仓库用于共享，禁止写入本机绝对路径到 metadata（提交前执行 `tools\pre_share.cmd`）。
2. 前端资源有缓存，改动 JS/CSS 后要同步更新 `index.html/workflow.html` 版本号参数。
3. 目前附件上传是“单文件”，这是下一任务要扩展的点。

## 7. 下一任务（必须做）

任务名称：**增加添加文件夹附件功能**

目标：

1. 在“添加题目/WP”区域支持选择并上传整个文件夹作为附件。
2. 上传后在题目目录内保持相对路径结构（不能把所有文件拍平）。
3. 与现有“单文件上传”兼容，不破坏已有流程。

建议实现方案（推荐）：

1. 前端（`dashboard/index.html` + `dashboard/js/main.js`）：
   - 增加“上传文件夹”入口（可使用 `input type=file` + `webkitdirectory` + `multiple`）。
   - 构建 `FormData` 时循环 append 多个文件，字段名建议统一为 `artifact`。
   - 每个文件 append 时传入相对路径文件名（优先 `file.webkitRelativePath`）。
2. 后端（`tools/ctf_bank.py`）：
   - `_handle_add_upload` 从“单个文件”扩展到“多个文件”。
   - 将每个上传文件按传入的相对路径写入 case 对应目录（例如 `files/<folder>/...`）。
   - 增加路径安全校验，禁止 `..` 路径穿越。
   - 完成后更新 metadata 的 `updated_at` 并触发 `rebuild_catalog`。
3. 类型映射：
   - `kind=file` 时建议落到 `files/` 下。
   - `kind=note/wp/script` 可保留当前行为，文件夹模式优先用于 `file`。

验收标准：

1. 从网页选择一个包含子目录的文件夹上传成功。
2. 实际落盘后目录层级与源文件夹一致。
3. 上传后页面刷新，题目可正常打开，其他功能不回归。
4. 单文件上传仍可用。
5. `python -m py_compile tools/ctf_bank.py` 与 `node --check dashboard/js/main.js` 通过。

## 8. 建议提交信息（给下一位）

可用提交信息模板：

```text
feat(upload): support folder attachments with relative-path preserve
```

