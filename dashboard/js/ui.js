function esc(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function catClass(category = "") {
  const normalized = String(category).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";
  return `cat-${normalized}`;
}

function normalizeStatus(status = "") {
  const raw = String(status).trim().toLowerCase();
  if (raw === "done" || raw === "已解决") return "done";
  if (raw === "in_progress" || raw === "in-progress" || raw === "进行中") return "in_progress";
  return "todo";
}

function statusClass(status = "") {
  const normalized = normalizeStatus(status);
  if (normalized === "done") return "status-done";
  if (normalized === "in_progress") return "status-in-progress";
  return "status-todo";
}

export function statusLabel(status = "") {
  const normalized = normalizeStatus(status);
  if (normalized === "done") return "已解决";
  if (normalized === "in_progress") return "进行中";
  return "待做";
}

function parseDifficultyLevel(value = "") {
  const raw = String(value).trim().toLowerCase();
  if (!raw) return 0;

  const textMap = {
    beginner: 1,
    easy: 2,
    normal: 3,
    medium: 3,
    hard: 4,
    insane: 5,
  };
  if (textMap[raw]) return textMap[raw];

  const matched = raw.match(/(\d+(?:\.\d+)?)(?:\s*\/\s*(10|5))?/);
  if (!matched) return 0;

  const number = Number.parseFloat(matched[1]);
  if (!Number.isFinite(number)) return 0;

  const denominator = matched[2] ? Number.parseInt(matched[2], 10) : (number > 5 ? 10 : 5);
  const stars = denominator === 10 ? number / 2 : number;
  const clipped = Math.max(0, Math.min(5, stars));
  return Math.round(clipped);
}

function difficultyStars(level) {
  if (!level) return "未评星";
  const full = Math.max(0, Math.min(5, Math.round(level)));
  const empty = 5 - full;
  return `${"⭐".repeat(full)}${"✩".repeat(empty)}`;
}

function difficultyClass(level) {
  const clipped = Math.round(Math.max(0, Math.min(5, Number(level) || 0)));
  return `diff-${clipped}`;
}

function difficultyValueFromRaw(value = "") {
  const level = parseDifficultyLevel(value);
  if (!level) return "";
  return String(level);
}

function difficultyOptionHtml(selectedValue = "") {
  const options = [
    ["", "未设置"],
    ["1", "⭐✩✩✩✩（1 星）"],
    ["2", "⭐⭐✩✩✩（2 星）"],
    ["3", "⭐⭐⭐✩✩（3 星）"],
    ["4", "⭐⭐⭐⭐✩（4 星）"],
    ["5", "⭐⭐⭐⭐⭐（5 星）"],
  ];
  return options
    .map(([value, label]) => `<option value="${value}"${value === selectedValue ? " selected" : ""}>${label}</option>`)
    .join("");
}

function displayText(value = "") {
  const text = String(value || "").trim();
  return text || "未设置";
}

function fileNameFromPath(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  const parts = raw.split("/");
  return parts[parts.length - 1] || raw;
}

export function renderStats(node, stats) {
  node.textContent = `总题数: ${stats.total_cases} | 分类数: ${Object.keys(stats.by_category || {}).length} | 更新时间: ${stats.updated_at || "-"}`;
}

export function renderCategoryList(node, counts, activeCategory, onClick) {
  const categories = Object.keys(counts).sort();
  node.innerHTML = "";

  const makeBtn = (value, label, count) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = `${label} (${count})`;
    if (value !== "all") {
      btn.classList.add(catClass(value));
    }
    if (activeCategory === value) btn.classList.add("active");
    btn.addEventListener("click", () => onClick(value));
    li.appendChild(btn);
    return li;
  };

  const allCount = categories.reduce((n, c) => n + counts[c], 0);
  node.appendChild(makeBtn("all", "全部", allCount));
  categories.forEach((cat) => node.appendChild(makeBtn(cat, cat, counts[cat])));
}

export function renderCaseList(node, cases, onSelect, onOpenFolder = () => {}) {
  node.innerHTML = "";
  if (!cases.length) {
    node.innerHTML = `<li><button disabled>无匹配题目</button></li>`;
    return;
  }

  for (const item of cases) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "case-item-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "case-select-btn";
    const catCls = catClass(item.category);
    const statusCls = statusClass(item.status);
    const level = parseDifficultyLevel(item.difficulty);
    const diffCls = difficultyClass(level);
    btn.innerHTML = `
      <div class="case-main">
        <div class="case-name">${esc(item.name)}</div>
        <div class="case-meta">
          <span class="cat-badge ${catCls}">${esc(item.category)}</span>
          <span class="status-pill ${statusCls}">${esc(statusLabel(item.status))}</span>
          <span class="difficulty-pill ${diffCls}" title="${esc(String(item.difficulty || "-"))}"><span class="difficulty-stars">${esc(difficultyStars(level))}</span></span>
          <span>${esc(item.subcategory)} | ${esc(item.event || "-")}</span>
        </div>
      </div>
    `;
    btn.addEventListener("click", () => onSelect(item));

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "case-open-folder-btn";
    openBtn.title = "打开题目目录";
    openBtn.setAttribute("aria-label", "打开题目目录");
    openBtn.textContent = "📁";
    openBtn.addEventListener("click", () => onOpenFolder(item));

    row.appendChild(btn);
    row.appendChild(openBtn);
    li.appendChild(row);
    node.appendChild(li);
  }
}

export function renderCaseDetail(node, item, detail = {}) {
  if (!item) {
    node.innerHTML = "<p>点左侧题目可预览内容。</p>";
    return;
  }

  const tags = (item.tags || []).slice(0, 6).map((t) => `<span class="chip">${esc(t)}</span>`).join("");
  const statusCls = statusClass(item.status);
  const categoryClass = catClass(item.category);
  const level = parseDifficultyLevel(item.difficulty);
  const diffCls = difficultyClass(level);
  const tabs = Array.isArray(detail.tabs) ? detail.tabs : [];
  const activeTabId = String(detail.activeTabId || "");
  const activeTab = tabs.find((tab) => String(tab?.id || "") === activeTabId) || tabs[0] || null;
  const wpCount = tabs.filter((tab) => tab?.kind === "wp").length;
  const scriptCount = tabs.filter((tab) => tab?.kind === "script").length;
  const challengeCount = (item.challenge_files || []).length;
  const activeEditable = true;
  const activeFilename = String(activeTab?.filename || fileNameFromPath(activeTab?.path || "") || "WP.md");
  const activeTitle = String(activeTab?.title || "未命名");
  const activeContent = String(activeTab?.content || "");
  const activeKind = activeTab?.kind === "script" ? "script" : "wp";
  const activeModeText = activeKind === "script" ? `脚本文档 · ${activeFilename}` : `WP文档 · ${activeFilename}`;
  const difficultyValue = difficultyValueFromRaw(item.difficulty);
  const statusValue = normalizeStatus(item.status);
  const tagsText = (item.tags || []).join(", ");
  const caseRef = item.id || item.path || "";
  const difficultyText = difficultyValue
    ? `${difficultyStars(parseDifficultyLevel(difficultyValue))} (${difficultyValue} 星)`
    : "未设置";

  node.innerHTML = `
    <p>
      <span class="chip ${categoryClass}">${esc(item.category)}/${esc(item.subcategory)}</span>
      <span class="status-pill ${statusCls}">${esc(statusLabel(item.status))}</span>
      <span class="difficulty-pill ${diffCls}" title="${esc(String(item.difficulty || "-"))}"><span class="difficulty-stars">${esc(difficultyStars(level))}</span></span>
      ${tags}
    </p>
    <div class="meta-editor is-collapsed" data-role="meta-editor">
      <div class="meta-editor-title-row">
        <div class="meta-editor-title">题目信息（题目名请在上方修改）</div>
        <button type="button" class="meta-editor-toggle" data-role="meta-toggle" aria-expanded="false">展开</button>
      </div>
      <form
        class="meta-editor-form"
        data-role="meta-form"
        hidden
        data-case-id="${esc(caseRef)}"
        data-name="${esc(item.name || "")}"
        data-event="${esc(item.event || "")}"
        data-year="${esc(item.year || "")}"
        data-difficulty="${esc(difficultyValue)}"
        data-status="${esc(statusValue)}"
        data-tags="${esc(tagsText)}"
      >
        <div class="meta-editor-grid">
          <div class="meta-item">
            <div class="meta-item-label">比赛名</div>
            <div class="meta-value editable" tabindex="0" data-role="meta-value" data-field="event" data-type="text">${esc(displayText(item.event))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">年份</div>
            <div class="meta-value editable" tabindex="0" data-role="meta-value" data-field="year" data-type="text">${esc(displayText(item.year))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">难度</div>
            <div class="meta-value editable" tabindex="0" data-role="meta-value" data-field="difficulty" data-type="difficulty">${esc(difficultyText)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">状态</div>
            <div class="meta-value editable" tabindex="0" data-role="meta-value" data-field="status" data-type="status">${esc(statusLabel(statusValue))}</div>
          </div>
          <div class="meta-item meta-tags-row">
            <div class="meta-item-label">标签（逗号分隔）</div>
            <div class="meta-value editable" tabindex="0" data-role="meta-value" data-field="tags" data-type="text">${esc(displayText(tagsText))}</div>
          </div>
        </div>
      </form>
    </div>

    <div class="wp-viewer">
      <div class="wp-viewer-header artifact-header">
        <div class="artifact-header-row">
          <span class="artifact-title">题解与脚本</span>
          <span class="artifact-stats">
            <span class="artifact-stat-chip" data-role="artifact-count-challenge">Challenge ${challengeCount}</span>
            <span class="artifact-stat-chip" data-role="artifact-count-wp">WP ${wpCount}</span>
            <span class="artifact-stat-chip" data-role="artifact-count-script">脚本 ${scriptCount}</span>
          </span>
        </div>
        <div class="artifact-tabbar">
          <div class="artifact-tab-scroll" data-role="artifact-tab-scroll" role="tablist" aria-label="文件标签"></div>
          <div class="artifact-tab-actions">
            <button type="button" class="artifact-tab-add" data-role="artifact-add-wp" title="新建WP">新建 WP</button>
            <button type="button" class="artifact-tab-add script" data-role="artifact-add-script" title="新建脚本">新建脚本</button>
          </div>
        </div>
      </div>

      <div class="artifact-toolbar">
        <span class="artifact-current-name" data-role="artifact-current-name">${esc(activeTitle)}</span>
        <div class="artifact-toolbar-right">
          <span class="artifact-current-mode" data-role="artifact-current-mode">${esc(activeModeText)}</span>
          <div class="artifact-view-toggle" data-role="artifact-view-toggle">
            <button type="button" class="artifact-view-btn active" data-role="artifact-mode-preview">预览</button>
            <button type="button" class="artifact-view-btn" data-role="artifact-mode-edit">编辑</button>
          </div>
        </div>
      </div>

      <div class="artifact-markdown" data-role="artifact-preview"></div>

      <textarea
        class="${activeEditable ? "wp-editor-input" : "script-viewer-input"}"
        data-role="artifact-editor"
        data-case-id="${esc(item.id || item.path || "")}"
        data-kind="${esc(activeKind)}"
        data-tab-id="${esc(String(activeTab?.id || ""))}"
        data-filename="${esc(activeFilename)}"
        data-source-path="${esc(String(activeTab?.path || ""))}"
        data-original-text="${esc(String(activeTab?.originalText || ""))}"
        ${activeEditable ? "" : "readonly"}
      >${esc(activeContent)}</textarea>
    </div>
  `;
}
