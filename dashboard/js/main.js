import {
  addArtifactUpload,
  fetchCatalog,
  fetchCategoryTree,
  fetchCurrentCase,
  fetchWpText,
  intakeChallengeUpload,
  openCaseFolder,
  rebuildCatalogIndex,
  saveArtifactText,
  saveCaseMeta,
} from "./api.js?v=20260302z3";
import {
  renderStats,
  renderCategoryList,
  renderCaseDetail,
  renderCaseList,
  statusLabel,
} from "./ui.js?v=20260302z3";

const els = {
  stats: document.getElementById("stats"),
  categoryList: document.getElementById("category-list"),
  caseList: document.getElementById("case-list"),
  caseDetail: document.getElementById("case-detail"),
  detailTitleName: document.getElementById("detail-title-name"),
  detailSaveBtn: document.getElementById("detail-save-btn"),
  searchInput: document.getElementById("search-input"),
  statusFilter: document.getElementById("status-filter"),
  difficultyFilter: document.getElementById("difficulty-filter"),
  sortFilter: document.getElementById("sort-filter"),
  intakeForm: document.getElementById("intake-form"),
  intakeCategory: document.getElementById("intake-category"),
  intakeSubcategory: document.getElementById("intake-subcategory"),
  artifactForm: document.getElementById("artifact-form"),
  artifactCase: document.getElementById("artifact-case"),
  refreshCurrentBtn: document.getElementById("refresh-current-btn"),
  rebuildBtn: document.getElementById("rebuild-btn"),
  currentBox: document.getElementById("current-box"),
  logBox: document.getElementById("log-box"),
};

const state = {
  catalog: { stats: { total_cases: 0, by_category: {} }, cases: [] },
  activeCategory: "all",
  activeCase: null,
  currentCase: null,
  categoryTree: {},
  hasUnsavedChanges: false,
  detailArtifacts: null,
  wpViewMode: "preview",
};

function nowTime() {
  return new Date().toLocaleTimeString();
}

function appendLog(message, isError = false) {
  const level = isError ? "ERROR" : "OK";
  els.logBox.textContent += `\n${nowTime()} [${level}] ${message}`;
  els.logBox.scrollTop = els.logBox.scrollHeight;
}

function buildCategoryCounts(cases) {
  const counts = {};
  for (const item of cases) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}

function normalizeStatusValue(status = "") {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "done" || raw === "已解决") return "done";
  if (raw === "in_progress" || raw === "in-progress" || raw === "进行中") return "in_progress";
  return "todo";
}

function difficultyLevelFromValue(value = "") {
  const raw = String(value || "").trim().toLowerCase();
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

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(text = "") {
  return escapeHtml(String(text || "")).replaceAll("'", "&#39;");
}

function sanitizeLinkUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(raw)) {
    return raw;
  }
  return "";
}

function renderMarkdownInline(text = "") {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = sanitizeLinkUrl(url);
    if (!safeUrl) {
      return escapeHtml(label);
    }
    return `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function renderMarkdownToHtml(markdown = "") {
  const src = String(markdown || "").replace(/\r\n?/g, "\n");
  if (!src.trim()) {
    return '<p class="artifact-markdown-empty">暂无 WP 内容</p>';
  }

  const lines = src.split("\n");
  const out = [];
  let i = 0;

  const isListLine = (line) => /^(\s*)([-*+]|\d+\.)\s+/.test(line);
  const isBlockStart = (line) =>
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^(\s*)([-*+]|\d+\.)\s+/.test(line) ||
    /^(\*\s*\*\s*\*|-{3,}|_{3,})\s*$/.test(line);

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const lang = trimmed.replace(/^```/, "").trim();
      i += 1;
      const codeLines = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push(`<pre class="md-code"><code class="lang-${escapeAttr(lang || "plain")}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^(\*\s*\*\s*\*|-{3,}|_{3,})\s*$/.test(trimmed)) {
      out.push("<hr>");
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote>${quoteLines.map((t) => renderMarkdownInline(t)).join("<br>")}</blockquote>`);
      continue;
    }

    if (isListLine(rawLine)) {
      const isOrdered = /^(\s*)\d+\.\s+/.test(rawLine);
      const tag = isOrdered ? "ol" : "ul";
      const items = [];
      while (i < lines.length && isListLine(lines[i])) {
        const listLine = lines[i].trim();
        const text = listLine.replace(/^([-*+]|\d+\.)\s+/, "");
        items.push(`<li>${renderMarkdownInline(text)}</li>`);
        i += 1;
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length) {
      const look = lines[i].trim();
      if (!look) break;
      if (isBlockStart(lines[i])) break;
      para.push(lines[i].trim());
      i += 1;
    }
    if (!para.length) {
      para.push(trimmed);
      i += 1;
    }
    out.push(`<p>${para.map((t) => renderMarkdownInline(t)).join("<br>")}</p>`);
  }

  return out.join("\n");
}

function applyFilters(cases) {
  const kw = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const difficulty = els.difficultyFilter?.value || "";
  const sortBy = els.sortFilter?.value || "default";

  const filtered = cases.filter((item) => {
    if (state.activeCategory !== "all" && item.category !== state.activeCategory) {
      return false;
    }
    const normalizedStatus = normalizeStatusValue(item.status);
    if (status && normalizedStatus !== status) {
      return false;
    }
    const level = difficultyLevelFromValue(item.difficulty);
    if (difficulty && level !== Number.parseInt(difficulty, 10)) {
      return false;
    }
    if (!kw) {
      return true;
    }
    const blob = [
      item.name,
      item.event,
      item.category,
      item.subcategory,
      ...(item.tags || []),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(kw);
  });

  if (sortBy === "default") {
    return filtered;
  }

  const sorted = [...filtered];
  if (sortBy === "difficulty_desc") {
    sorted.sort((a, b) => {
      const da = difficultyLevelFromValue(a.difficulty);
      const db = difficultyLevelFromValue(b.difficulty);
      if (!da && db) return 1;
      if (da && !db) return -1;
      if (db !== da) return db - da;
      return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN");
    });
    return sorted;
  }
  if (sortBy === "difficulty_asc") {
    sorted.sort((a, b) => {
      const da = difficultyLevelFromValue(a.difficulty);
      const db = difficultyLevelFromValue(b.difficulty);
      if (!da && db) return 1;
      if (da && !db) return -1;
      if (da !== db) return da - db;
      return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN");
    });
    return sorted;
  }
  if (sortBy === "name_asc") {
    sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN"));
  }
  return sorted;
}

function renderCurrentCase(current) {
  state.currentCase = current || null;
  if (!current || !current.id) {
    els.currentBox.textContent = "当前题目：未设置";
    return;
  }
  els.currentBox.textContent = [
    `当前题目: ${current.id}`,
    `名称: ${current.name || "-"}`,
    `分类: ${current.category || "-"}/${current.subcategory || "-"}`,
    `状态: ${statusLabel(current.status || "")}`,
  ].join("\n");
}

async function openCaseLocation(item) {
  const caseRef = String(item?.id || item?.path || "").trim();
  if (!caseRef) {
    appendLog("打开目录失败：缺少 case 标识", true);
    return;
  }
  try {
    await openCaseFolder({ case: caseRef });
    appendLog(`已打开目录：${caseRef}`);
  } catch (err) {
    const raw = String(err?.message || err || "未知错误");
    const normalized = raw.toLowerCase();
    const isEndpointMissing = normalized.includes("404") || normalized.includes("unknown api endpoint");
    if (isEndpointMissing) {
      window.alert("打开目录失败：服务端接口不可用，请重启面板服务后重试。\n\n建议执行：tools\\serve_dashboard.cmd 18100");
    } else {
      window.alert(`打开目录失败：${raw}`);
    }
    appendLog(`打开目录失败: ${raw}`, true);
  }
}

function getMetaForm() {
  return els.caseDetail.querySelector('[data-role="meta-form"]');
}

function fileNameFromPath(path = "") {
  const raw = String(path || "").trim();
  if (!raw) return "";
  const parts = raw.split("/");
  return parts[parts.length - 1] || raw;
}

function normalizeFileList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function stripFileExt(name = "") {
  return String(name || "").replace(/\.[^.]+$/, "");
}

function defaultExtByKind(kind = "wp") {
  return kind === "script" ? ".py" : ".md";
}

function sanitizeTabFileName(title = "", kind = "wp") {
  const cleaned = String(title || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  const fallback = kind === "script" ? "script.py" : "WP.md";
  if (!cleaned) return fallback;
  if (/\.[a-z0-9]{1,10}$/i.test(cleaned)) return cleaned;
  return `${cleaned}${defaultExtByKind(kind)}`;
}

function ensureUniqueFilename(rawFilename, tabs, kind = "wp", excludeId = "") {
  const fallback = kind === "script" ? "script.py" : "WP.md";
  const requested = String(rawFilename || fallback).trim() || fallback;
  const dotIdx = requested.lastIndexOf(".");
  const base = dotIdx > 0 ? requested.slice(0, dotIdx) : requested;
  const ext = dotIdx > 0 ? requested.slice(dotIdx) : defaultExtByKind(kind);
  const used = new Set(
    (tabs || [])
      .filter((tab) => tab?.kind === kind && String(tab?.id || "") !== String(excludeId || ""))
      .map((tab) => String(tab.filename || "").toLowerCase()),
  );
  let candidate = `${base}${ext}`;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}${ext}`;
    suffix += 1;
  }
  return candidate;
}

function makeArtifactTab(data) {
  const kind = data?.kind === "script" ? "script" : "wp";
  const filename = String(data?.filename || fileNameFromPath(data?.path || "") || (kind === "script" ? "script.py" : "WP.md"));
  const defaultTitle = stripFileExt(filename) || (kind === "script" ? "脚本" : "WP");
  return {
    id: String(data?.id || `${kind}:${data?.path || filename}`),
    kind,
    path: String(data?.path || ""),
    filename,
    title: String(data?.title || defaultTitle),
    editable: true,
    loaded: Boolean(data?.loaded),
    content: String(data?.content || ""),
    originalText: String(data?.originalText || ""),
    isNew: Boolean(data?.isNew),
  };
}

function artifactTabKey(tab) {
  const kind = tab?.kind === "script" ? "script" : "wp";
  const anchor = String(tab?.path || tab?.filename || "").toLowerCase();
  return `${kind}:${anchor}`;
}

function getActiveArtifactTab(detailArtifacts = state.detailArtifacts) {
  if (!detailArtifacts || !Array.isArray(detailArtifacts.tabs) || !detailArtifacts.tabs.length) {
    return null;
  }
  const activeId = String(detailArtifacts.activeTabId || "");
  return detailArtifacts.tabs.find((tab) => String(tab.id || "") === activeId) || detailArtifacts.tabs[0] || null;
}

function buildDetailArtifactsState(item, preserve = false) {
  const wpFiles = normalizeFileList(item?.wp_files);
  const scriptFiles = normalizeFileList(item?.script_files);
  const prev = preserve ? state.detailArtifacts : null;
  const prevByKey = new Map();
  const prevById = new Map();
  const prevByKindFilename = new Map();
  if (prev?.tabs) {
    for (const tab of prev.tabs) {
      prevByKey.set(artifactTabKey(tab), tab);
      prevById.set(String(tab.id || ""), tab);
      if (tab?.filename) {
        prevByKindFilename.set(`${tab.kind}:${String(tab.filename).toLowerCase()}`, tab);
      }
    }
  }

  const tabs = [];
  for (const path of wpFiles) {
    const filename = fileNameFromPath(path) || "WP.md";
    const prevTab = prevByKey.get(`wp:${path.toLowerCase()}`) || prevByKindFilename.get(`wp:${filename.toLowerCase()}`);
    tabs.push(
      makeArtifactTab({
        id: `wp:${path}`,
        kind: "wp",
        path,
        filename,
        title: prevTab?.title || stripFileExt(filename) || "WP",
        loaded: Boolean(prevTab?.loaded),
        content: prevTab?.content || "",
        originalText: prevTab?.originalText || "",
        isNew: false,
      }),
    );
  }
  for (const path of scriptFiles) {
    const filename = fileNameFromPath(path) || "script.py";
    const prevTab = prevByKey.get(`script:${path.toLowerCase()}`) || prevByKindFilename.get(`script:${filename.toLowerCase()}`);
    tabs.push(
      makeArtifactTab({
        id: `script:${path}`,
        kind: "script",
        path,
        filename,
        title: prevTab?.title || filename,
        loaded: Boolean(prevTab?.loaded),
        content: prevTab?.content || "",
        originalText: prevTab?.originalText || "",
        isNew: false,
      }),
    );
  }

  if (prev?.tabs?.length) {
    for (const oldTab of prev.tabs) {
      if (!oldTab?.isNew || !oldTab?.kind) continue;
      const oldKind = oldTab.kind === "script" ? "script" : "wp";
      const oldFilename = String(oldTab.filename || "").toLowerCase();
      const exists = tabs.some((tab) => {
        if (artifactTabKey(tab) === artifactTabKey(oldTab)) return true;
        if (tab.kind !== oldKind || !oldFilename) return false;
        return String(tab.filename || "").toLowerCase() === oldFilename;
      });
      if (exists) continue;
      tabs.push(makeArtifactTab(oldTab));
    }
  }

  if (!tabs.length) {
    tabs.push(
      makeArtifactTab({
        id: "wp:new:default",
        kind: "wp",
        filename: "WP.md",
        title: "WP",
        loaded: true,
        content: "",
        originalText: "",
        isNew: true,
      }),
    );
  }

  let activeTabId = String(tabs[0].id || "");
  const prevActiveId = String(prev?.activeTabId || "");
  if (prevActiveId) {
    if (tabs.some((tab) => String(tab.id || "") === prevActiveId)) {
      activeTabId = prevActiveId;
    } else {
      const oldActive = prevById.get(prevActiveId);
      if (oldActive) {
        const oldFilename = String(oldActive.filename || "").toLowerCase();
        const matched = tabs.find((tab) => {
          if (artifactTabKey(tab) === artifactTabKey(oldActive)) return true;
          if (tab.kind !== oldActive.kind || !oldFilename) return false;
          return String(tab.filename || "").toLowerCase() === oldFilename;
        });
        if (matched) {
          activeTabId = String(matched.id || "");
        }
      }
    }
  }

  return {
    tabs,
    activeTabId,
  };
}

async function readCaseFileText(path, fallback = "") {
  if (!path) return fallback;
  try {
    return await fetchWpText(path);
  } catch (err) {
    return `读取文件失败: ${err.message}`;
  }
}

async function ensureArtifactTabLoaded(tab) {
  if (!tab || tab.loaded) {
    return;
  }
  const fallback = tab.kind === "script" ? "暂无脚本文件" : "";
  const text = await readCaseFileText(tab.path, fallback);
  tab.content = text;
  tab.originalText = text;
  tab.loaded = true;
}

async function hydrateDetailArtifactsText(detailArtifacts) {
  const active = getActiveArtifactTab(detailArtifacts);
  if (!active) return;
  await ensureArtifactTabLoaded(active);
}

function setDetailTitleName(item) {
  if (!els.detailTitleName) return;
  const hasCase = Boolean(item?.id || item?.path);
  const name = String(item?.name || "").trim();
  els.detailTitleName.classList.remove("editing");
  if (!hasCase) {
    els.detailTitleName.classList.remove("editable");
    els.detailTitleName.removeAttribute("tabindex");
    els.detailTitleName.removeAttribute("title");
    els.detailTitleName.textContent = "未选择题目";
    delete els.detailTitleName._commitInline;
    return;
  }
  els.detailTitleName.classList.add("editable");
  els.detailTitleName.setAttribute("tabindex", "0");
  els.detailTitleName.setAttribute("title", "点击修改题目名");
  els.detailTitleName.textContent = name || "未命名题目";
}

function openDetailTitleEditor() {
  const titleNode = els.detailTitleName;
  if (!titleNode || !state.activeCase) {
    return;
  }
  if (titleNode.classList.contains("editing")) {
    return;
  }

  const form = getMetaForm();
  if (!form) {
    return;
  }

  const original = String(form.dataset.name || state.activeCase?.name || "").trim();
  const input = document.createElement("input");
  input.type = "text";
  input.className = "detail-title-input";
  input.value = original;

  titleNode.classList.add("editing");
  titleNode.textContent = "";
  titleNode.appendChild(input);

  const commit = (save = true) => {
    if (!titleNode.classList.contains("editing")) {
      return;
    }
    let next = save ? String(input.value || "").trim() : original;
    if (save && !next) {
      next = original;
    }
    titleNode.classList.remove("editing");
    titleNode.textContent = next || "未命名题目";
    if (save && next !== original) {
      form.dataset.name = next;
      if (state.activeCase) {
        state.activeCase.name = next;
      }
      setUnsavedChanges(true);
    }
    delete titleNode._commitInline;
  };

  titleNode._commitInline = commit;
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      commit(false);
    }
  });
  input.addEventListener("blur", () => commit(true));
  input.focus();
  input.select();
}

function flushDetailTitleEditor(save = true) {
  if (!els.detailTitleName || typeof els.detailTitleName._commitInline !== "function") {
    return;
  }
  els.detailTitleName._commitInline(save);
}

function setDetailSaveState(enabled, text = "保存") {
  if (!els.detailSaveBtn) return;
  els.detailSaveBtn.disabled = !enabled;
  if (text === "保存") {
    els.detailSaveBtn.textContent = state.hasUnsavedChanges ? "保存*" : "保存";
    return;
  }
  els.detailSaveBtn.textContent = text;
}

function setUnsavedChanges(flag) {
  state.hasUnsavedChanges = Boolean(flag);
  if (els.detailSaveBtn && !els.detailSaveBtn.disabled && els.detailSaveBtn.textContent !== "保存中") {
    els.detailSaveBtn.textContent = state.hasUnsavedChanges ? "保存*" : "保存";
  }
}

function difficultyText(value = "") {
  const parsed = Number.parseFloat(String(value || "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "未设置";
  }
  const full = Math.round(Math.max(0, Math.min(5, parsed)));
  const empty = 5 - full;
  const stars = `${"⭐".repeat(full)}${"✩".repeat(empty)}`;
  return `${stars} (${full} 星)`;
}

function metaDisplayText(field, value) {
  const text = String(value || "").trim();
  if (field === "status") {
    return statusLabel(text || "todo");
  }
  if (field === "difficulty") {
    return difficultyText(text);
  }
  return text || "未设置";
}

function createInlineEditor(field, value) {
  if (field === "status") {
    const select = document.createElement("select");
    select.className = "meta-inline-editor";
    select.setAttribute("data-role", "meta-inline-editor");
    const options = [
      ["todo", "待做"],
      ["in_progress", "进行中"],
      ["done", "已解决"],
    ];
    for (const [v, label] of options) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = label;
      if (String(value || "") === v) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
    return select;
  }
  if (field === "difficulty") {
    const select = document.createElement("select");
    select.className = "meta-inline-editor";
    select.setAttribute("data-role", "meta-inline-editor");
    const options = [
      ["", "未设置"],
      ["1", "1 星"],
      ["2", "2 星"],
      ["3", "3 星"],
      ["4", "4 星"],
      ["5", "5 星"],
    ];
    for (const [v, label] of options) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = label;
      if (String(value || "") === v) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
    return select;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.className = "meta-inline-editor";
  input.setAttribute("data-role", "meta-inline-editor");
  input.value = String(value || "");
  return input;
}

function openInlineEditor(valueNode) {
  if (!valueNode || valueNode.classList.contains("editing")) {
    return;
  }
  const form = valueNode.closest('[data-role="meta-form"]');
  if (!form) {
    return;
  }
  const field = String(valueNode.dataset.field || "").trim();
  if (!field) {
    return;
  }

  const original = String(form.dataset[field] || "").trim();
  const editor = createInlineEditor(field, original);
  valueNode.classList.add("editing");
  valueNode.textContent = "";
  valueNode.appendChild(editor);

  const commit = (save = true) => {
    if (!valueNode.classList.contains("editing")) {
      return;
    }
    const next = save ? String(editor.value || "").trim() : original;
    valueNode.classList.remove("editing");
    valueNode.textContent = metaDisplayText(field, next);
    if (save && next !== original) {
      form.dataset[field] = next;
      setUnsavedChanges(true);
    }
    delete valueNode._commitInline;
  };

  valueNode._commitInline = commit;

  if (editor.tagName === "SELECT") {
    editor.addEventListener("change", () => commit(true));
    editor.addEventListener("blur", () => commit(true));
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        commit(false);
      }
    });
  } else {
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        commit(false);
      }
    });
    editor.addEventListener("blur", () => commit(true));
  }

  editor.focus();
  if (editor.select) {
    editor.select();
  }
}

function flushInlineEditors(form) {
  if (!form) {
    return;
  }
  const editing = form.querySelectorAll('[data-role="meta-value"].editing');
  for (const node of editing) {
    if (typeof node._commitInline === "function") {
      node._commitInline(true);
    }
  }
}

function bindMetaInlineEditor() {
  const values = els.caseDetail.querySelectorAll('[data-role="meta-value"]');
  for (const node of values) {
    node.addEventListener("click", () => openInlineEditor(node));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openInlineEditor(node);
      }
    });
  }
}

function bindMetaCollapseToggle() {
  const wrap = els.caseDetail.querySelector('[data-role="meta-editor"]');
  const form = els.caseDetail.querySelector('[data-role="meta-form"]');
  const toggleBtn = els.caseDetail.querySelector('[data-role="meta-toggle"]');
  if (!wrap || !form || !toggleBtn) {
    return;
  }

  const setCollapsed = (collapsed) => {
    wrap.classList.toggle("is-collapsed", collapsed);
    form.hidden = collapsed;
    toggleBtn.textContent = collapsed ? "展开" : "收起";
    toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  };

  setCollapsed(true);
  toggleBtn.addEventListener("click", () => {
    const collapsed = wrap.classList.contains("is-collapsed");
    setCollapsed(!collapsed);
  });
}

function bindDetailDirtyTracking() {
  // 由 bindArtifactPager 统一处理产物编辑器的脏标记。
}

function applyArtifactEditorToState() {
  const editor = els.caseDetail.querySelector('[data-role="artifact-editor"]');
  const active = getActiveArtifactTab();
  if (!editor || !active) {
    return;
  }
  active.content = editor.value;
}

function rebuildArtifactTabButtons() {
  const artifacts = state.detailArtifacts;
  const wrap = els.caseDetail.querySelector('[data-role="artifact-tab-scroll"], .artifact-tab-scroll');
  if (!artifacts || !wrap) {
    return;
  }
  wrap.textContent = "";
  const tabs = artifacts.tabs || [];
  const wpTabs = tabs.filter((tab) => tab.kind === "wp");
  const scriptTabs = tabs.filter((tab) => tab.kind === "script");
  const renderOne = (tab, group, isFirstInGroup) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `artifact-tab kind-${tab.kind}`;
    btn.setAttribute("data-role", "artifact-tab");
    btn.dataset.tabId = String(tab.id || "");
    btn.dataset.kind = tab.kind;
    btn.dataset.group = group;
    btn.setAttribute("aria-selected", "false");
    btn.title = "点击切换，双击标签名可重命名";
    if (isFirstInGroup) {
      btn.classList.add("group-start");
    }

    const titleNode = document.createElement("span");
    titleNode.className = "artifact-tab-title";
    titleNode.setAttribute("data-role", "artifact-tab-title");
    titleNode.textContent = String(tab.title || tab.filename || "未命名");

    const kindNode = document.createElement("span");
    kindNode.className = "artifact-tab-kind";
    kindNode.textContent = tab.kind === "script" ? "脚本" : "WP";

    const closeNode = document.createElement("button");
    closeNode.type = "button";
    closeNode.className = "artifact-tab-close";
    closeNode.setAttribute("data-role", "artifact-tab-close");
    closeNode.title = "关闭标签";
    closeNode.setAttribute("aria-label", "关闭标签");
    closeNode.textContent = "×";

    btn.appendChild(titleNode);
    btn.appendChild(kindNode);
    btn.appendChild(closeNode);
    btn.addEventListener("click", async () => {
      await switchArtifactTab(String(tab.id || ""));
    });

    closeNode.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeArtifactTab(String(tab.id || ""));
    });

    titleNode.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startArtifactTabRename(String(tab.id || ""));
    });

    wrap.appendChild(btn);
  };

  wpTabs.forEach((tab, idx) => renderOne(tab, "wp", idx === 0));
  if (wpTabs.length && scriptTabs.length) {
    const divider = document.createElement("span");
    divider.className = "artifact-tab-divider";
    divider.setAttribute("aria-hidden", "true");
    wrap.appendChild(divider);
  }
  scriptTabs.forEach((tab, idx) => renderOne(tab, "script", idx === 0));
}

function refreshArtifactTabUi() {
  const artifacts = state.detailArtifacts;
  if (!artifacts) {
    return;
  }
  const wpCount = artifacts.tabs.filter((tab) => tab.kind === "wp").length;
  const scriptCount = artifacts.tabs.filter((tab) => tab.kind === "script").length;
  const wpCountNode = els.caseDetail.querySelector('[data-role="artifact-count-wp"]');
  const scriptCountNode = els.caseDetail.querySelector('[data-role="artifact-count-script"]');
  if (wpCountNode) wpCountNode.textContent = `WP ${wpCount}`;
  if (scriptCountNode) scriptCountNode.textContent = `脚本 ${scriptCount}`;

  const active = getActiveArtifactTab(artifacts);
  const allTabs = els.caseDetail.querySelectorAll('[data-role="artifact-tab"]');
  allTabs.forEach((node) => {
    const selected = String(node.dataset.tabId || "") === String(active?.id || "");
    node.classList.toggle("active", selected);
    node.setAttribute("aria-selected", selected ? "true" : "false");
  });

  const nameNode = els.caseDetail.querySelector('[data-role="artifact-current-name"]');
  const modeNode = els.caseDetail.querySelector('[data-role="artifact-current-mode"]');
  const viewToggle = els.caseDetail.querySelector('[data-role="artifact-view-toggle"]');
  const previewBtn = els.caseDetail.querySelector('[data-role="artifact-mode-preview"]');
  const editBtn = els.caseDetail.querySelector('[data-role="artifact-mode-edit"]');
  const previewNode = els.caseDetail.querySelector('[data-role="artifact-preview"]');
  const editor = els.caseDetail.querySelector('[data-role="artifact-editor"]');
  if (!active || !editor) {
    if (nameNode) nameNode.textContent = "未选择标签";
    if (modeNode) modeNode.textContent = "无内容";
    if (previewNode) previewNode.hidden = true;
    return;
  }

  if (nameNode) {
    nameNode.textContent = String(active.title || active.filename || "未命名");
  }
  if (modeNode) {
    const fallbackName = active.kind === "script" ? "script.py" : "WP.md";
    const filename = String(active.filename || fallbackName);
    modeNode.textContent = active.kind === "script" ? `脚本文档 · ${filename}` : `WP文档 · ${filename}`;
  }

  editor.classList.toggle("wp-editor-input", active.kind !== "script");
  editor.classList.toggle("script-viewer-input", active.kind === "script");
  editor.readOnly = false;
  editor.value = String(active.content || "");
  editor.dataset.tabId = String(active.id || "");
  editor.dataset.kind = String(active.kind || "wp");
  editor.dataset.filename = String(active.filename || "WP.md");
  editor.dataset.sourcePath = String(active.path || "");
  editor.dataset.originalText = String(active.originalText || "");

  if (active.kind === "script") {
    if (viewToggle) viewToggle.hidden = true;
    if (previewNode) previewNode.hidden = true;
    editor.hidden = false;
    return;
  }

  const previewMode = state.wpViewMode !== "edit";
  if (viewToggle) viewToggle.hidden = false;
  if (previewBtn) previewBtn.classList.toggle("active", previewMode);
  if (editBtn) editBtn.classList.toggle("active", !previewMode);

  if (previewNode) {
    previewNode.hidden = !previewMode;
    if (previewMode) {
      previewNode.innerHTML = renderMarkdownToHtml(String(active.content || ""));
    }
  }
  editor.hidden = previewMode;
  if (!previewMode) {
    editor.focus();
  }
}

async function switchArtifactTab(tabId) {
  const artifacts = state.detailArtifacts;
  if (!artifacts?.tabs?.length) {
    return;
  }
  applyArtifactEditorToState();
  const next = artifacts.tabs.find((tab) => String(tab.id || "") === String(tabId || ""));
  if (!next) {
    return;
  }
  artifacts.activeTabId = String(next.id || "");
  await ensureArtifactTabLoaded(next);
  refreshArtifactTabUi();
}

function startArtifactTabRename(tabId) {
  const artifacts = state.detailArtifacts;
  if (!artifacts) {
    return;
  }
  const tab = artifacts.tabs.find((x) => String(x.id || "") === String(tabId || ""));
  if (!tab) return;
  const tabBtn = Array.from(els.caseDetail.querySelectorAll('[data-role="artifact-tab"]'))
    .find((node) => String(node.dataset.tabId || "") === String(tab.id || ""));
  const titleNode = tabBtn?.querySelector('[data-role="artifact-tab-title"]');
  if (!titleNode || titleNode.querySelector("input")) {
    return;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "artifact-tab-title-editor";
  input.value = String(tab.title || "");
  titleNode.textContent = "";
  titleNode.appendChild(input);

  const commit = (save = true) => {
    const raw = save ? String(input.value || "").trim() : String(tab.title || "");
    const title = raw || "未命名";
    tab.title = title;
    if (tab.isNew) {
      const fileRaw = sanitizeTabFileName(title, tab.kind);
      tab.filename = ensureUniqueFilename(fileRaw, artifacts.tabs, tab.kind, tab.id);
    }
    titleNode.textContent = tab.title;
    refreshArtifactTabUi();
    if (save) {
      setUnsavedChanges(true);
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      commit(false);
    }
  });
  input.addEventListener("blur", () => commit(true));
  input.focus();
  input.select();
}

function removeArtifactTab(tabId) {
  const artifacts = state.detailArtifacts;
  if (!artifacts?.tabs?.length) return;
  const idx = artifacts.tabs.findIndex((tab) => String(tab.id || "") === String(tabId || ""));
  if (idx < 0) return;
  const tab = artifacts.tabs[idx];
  const dirty = tab.isNew || String(tab.content || "") !== String(tab.originalText || "");
  if (dirty) {
    const ok = window.confirm(`标签“${tab.title || tab.filename || "未命名"}”有未保存修改，确定关闭？`);
    if (!ok) return;
  }
  artifacts.tabs.splice(idx, 1);
  if (!artifacts.tabs.length) {
    const fallback = makeArtifactTab({
      id: `wp:new:${Date.now()}`,
      kind: "wp",
      filename: "WP.md",
      title: "WP",
      loaded: true,
      content: "",
      originalText: "",
      isNew: true,
    });
    artifacts.tabs.push(fallback);
    artifacts.activeTabId = String(fallback.id || "");
  } else if (String(artifacts.activeTabId || "") === String(tabId || "")) {
    const next = artifacts.tabs[Math.max(0, idx - 1)] || artifacts.tabs[0];
    artifacts.activeTabId = String(next.id || "");
  }
  rebuildArtifactTabButtons();
  refreshArtifactTabUi();
}

function addArtifactTab(kind = "wp") {
  const artifacts = state.detailArtifacts;
  if (!artifacts || !state.activeCase) return;
  const normalizedKind = kind === "script" ? "script" : "wp";
  const count = artifacts.tabs.filter((tab) => tab.kind === normalizedKind).length + 1;
  const title = normalizedKind === "script" ? `脚本${count}` : `WP${count}`;
  const fileRaw = sanitizeTabFileName(title, normalizedKind);
  const filename = ensureUniqueFilename(fileRaw, artifacts.tabs, normalizedKind);

  const tab = makeArtifactTab({
    id: `${normalizedKind}:new:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    kind: normalizedKind,
    path: "",
    filename,
    title,
    loaded: true,
    content: "",
    originalText: "",
    isNew: true,
  });
  artifacts.tabs.push(tab);
  artifacts.activeTabId = String(tab.id || "");
  rebuildArtifactTabButtons();
  refreshArtifactTabUi();
  const wrap = els.caseDetail.querySelector('[data-role="artifact-tab-scroll"], .artifact-tab-scroll');
  if (wrap) {
    wrap.scrollLeft = wrap.scrollWidth;
  }
  setUnsavedChanges(true);
  startArtifactTabRename(String(tab.id || ""));
}

function bindArtifactPager() {
  rebuildArtifactTabButtons();
  refreshArtifactTabUi();

  const addWpBtn = els.caseDetail.querySelector('[data-role="artifact-add-wp"]');
  const addScriptBtn = els.caseDetail.querySelector('[data-role="artifact-add-script"]');
  if (addWpBtn) {
    addWpBtn.onclick = () => {
      addArtifactTab("wp");
    };
  }
  if (addScriptBtn) {
    addScriptBtn.onclick = () => {
      addArtifactTab("script");
    };
  }

  const editor = els.caseDetail.querySelector('[data-role="artifact-editor"]');
  const previewBtn = els.caseDetail.querySelector('[data-role="artifact-mode-preview"]');
  const editBtn = els.caseDetail.querySelector('[data-role="artifact-mode-edit"]');
  const previewNode = els.caseDetail.querySelector('[data-role="artifact-preview"]');
  if (previewBtn) {
    previewBtn.onclick = () => {
      applyArtifactEditorToState();
      state.wpViewMode = "preview";
      refreshArtifactTabUi();
    };
  }
  if (editBtn) {
    editBtn.onclick = () => {
      state.wpViewMode = "edit";
      refreshArtifactTabUi();
    };
  }
  if (previewNode) {
    previewNode.ondblclick = () => {
      state.wpViewMode = "edit";
      refreshArtifactTabUi();
    };
  }
  if (editor) {
    editor.oninput = () => {
      const active = getActiveArtifactTab();
      if (!active) return;
      active.content = editor.value;
      setUnsavedChanges(true);
      if (active.kind === "wp" && state.wpViewMode === "preview") {
        const preview = els.caseDetail.querySelector('[data-role="artifact-preview"]');
        if (preview) {
          preview.innerHTML = renderMarkdownToHtml(String(active.content || ""));
        }
      }
    };
  }
}

function collectDetailPayload(item) {
  const caseId = String(item?.id || item?.path || "").trim();
  if (!caseId) {
    throw new Error("缺少 case 标识");
  }

  flushDetailTitleEditor(true);
  const form = getMetaForm();
  const editor = els.caseDetail.querySelector('[data-role="artifact-editor"]');
  if (!form || !editor) {
    throw new Error("详情编辑器未加载完成");
  }
  flushInlineEditors(form);
  applyArtifactEditorToState();

  const metaPayload = {
    case: caseId,
    name: String(form.dataset.name || "").trim(),
    event: String(form.dataset.event || "").trim(),
    year: String(form.dataset.year || "").trim(),
    difficulty: String(form.dataset.difficulty || "").trim(),
    status: String(form.dataset.status || "todo").trim() || "todo",
    tags: String(form.dataset.tags || "").trim(),
  };
  if (!metaPayload.name) {
    throw new Error("题目名不能为空");
  }

  const artifactPayloads = [];
  const tabs = state.detailArtifacts?.tabs || [];
  for (const tab of tabs) {
    if (tab.kind !== "wp" && tab.kind !== "script") continue;
    const dirty = tab.isNew || String(tab.content || "") !== String(tab.originalText || "");
    if (!dirty) continue;
    artifactPayloads.push({
      case: caseId,
      kind: tab.kind,
      filename: String(tab.filename || "WP.md"),
      text: String(tab.content || ""),
    });
  }

  return { caseId, metaPayload, artifactPayloads };
}

async function saveActiveCaseAll() {
  const item = state.activeCase;
  if (!item) {
    appendLog("请先从左侧选择一个题目", true);
    return;
  }

  let caseId = "";
  try {
    const payload = collectDetailPayload(item);
    caseId = payload.caseId;
    setDetailSaveState(false, "保存中");
    const metaResult = await saveCaseMeta(payload.metaPayload);
    for (const artifactPayload of payload.artifactPayloads) {
      await saveArtifactText(artifactPayload);
    }
    renderCurrentCase(metaResult.current);
    setUnsavedChanges(false);
    const savedCount = payload.artifactPayloads.length;
    const summary = savedCount > 0 ? `题目信息 + ${savedCount} 个标签` : "题目信息";
    appendLog(`已保存：${summary} (${caseId})`);
    await reloadCatalog();
    const refreshed = state.catalog.cases.find((x) => x.id === caseId || x.path === caseId);
    if (refreshed) {
      await onSelectCase(refreshed, { preserveArtifacts: true });
    }
  } catch (err) {
    showSaveError(err);
  } finally {
    const hasActiveCase = Boolean(state.activeCase?.id || state.activeCase?.path);
    setDetailSaveState(hasActiveCase);
  }
}

function handleSaveShortcut(event) {
  const key = String(event.key || "").toLowerCase();
  const withCtrl = event.ctrlKey || event.metaKey;
  if (!withCtrl || key !== "s") {
    return;
  }
  event.preventDefault();
  void saveActiveCaseAll();
}

function handleBeforeUnload(event) {
  if (!state.hasUnsavedChanges) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
}

function showSaveError(err) {
  const raw = String(err?.message || err || "未知错误");
  const normalized = raw.toLowerCase();
  const isEndpointMissing = normalized.includes("404") || normalized.includes("unknown api endpoint");
  const message = isEndpointMissing
    ? "保存失败：服务端接口不可用（可能是旧进程），请重启面板服务。"
    : `保存失败：${raw}`;
  appendLog(message, true);
  // 避免用户漏看底部日志，保存失败时给出显式弹窗。
  window.alert(`${message}\n\n建议执行：tools\\serve_dashboard.cmd 18100`);
}

async function checkSaveApiReady() {
  // 发送空请求：接口存在会返回 400；不存在会返回 404。
  const resp = await fetch("/api/case-update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (resp.status !== 404) {
    return;
  }
  const message = "检测到当前服务进程过旧，不支持保存接口。请重启面板服务后再保存。";
  appendLog(message, true);
  window.alert(`${message}\n\n建议执行：tools\\serve_dashboard.cmd 18100`);
}

async function loadCurrentCase() {
  try {
    const data = await fetchCurrentCase();
    renderCurrentCase(data.current);
  } catch (err) {
    renderCurrentCase(null);
    appendLog(`读取当前题失败: ${err.message}`, true);
  }
}

function renderIntakeCategorySelect() {
  if (!els.intakeCategory) return;
  const categories = Object.keys(state.categoryTree || {}).sort();
  const current = els.intakeCategory.value || "auto";
  els.intakeCategory.innerHTML = `<option value="auto">auto（自动识别）</option>`;
  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    els.intakeCategory.appendChild(opt);
  }
  els.intakeCategory.value = categories.includes(current) ? current : "auto";
}

function renderIntakeSubcategorySelect() {
  if (!els.intakeSubcategory || !els.intakeCategory) return;
  const category = els.intakeCategory.value;
  const options = state.categoryTree?.[category] || [];
  const old = els.intakeSubcategory.value || "";
  els.intakeSubcategory.innerHTML = `<option value="">自动选择</option>`;
  for (const sub of options) {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    els.intakeSubcategory.appendChild(opt);
  }
  els.intakeSubcategory.disabled = category === "auto";
  if (options.includes(old)) {
    els.intakeSubcategory.value = old;
  } else {
    els.intakeSubcategory.value = "";
  }
}

async function loadCategoryTree() {
  try {
    const data = await fetchCategoryTree();
    state.categoryTree = data.categories || {};
    renderIntakeCategorySelect();
    renderIntakeSubcategorySelect();
  } catch (err) {
    appendLog(`加载分类树失败: ${err.message}`, true);
  }
}

async function onSelectCase(item, options = {}) {
  const preserveArtifacts = Boolean(options.preserveArtifacts);
  state.activeCase = item;
  state.wpViewMode = "preview";
  setDetailTitleName(item);
  if (els.artifactCase) {
    els.artifactCase.value = item.id || "";
  }

  const detailArtifacts = buildDetailArtifactsState(item, preserveArtifacts);
  await hydrateDetailArtifactsText(detailArtifacts);
  state.detailArtifacts = detailArtifacts;
  renderCaseDetail(els.caseDetail, item, detailArtifacts);
  setUnsavedChanges(false);
  bindMetaCollapseToggle();
  bindMetaInlineEditor();
  bindDetailDirtyTracking();
  bindArtifactPager();
  setDetailSaveState(true);
}

function renderCategories() {
  const counts = buildCategoryCounts(state.catalog.cases);
  renderCategoryList(els.categoryList, counts, state.activeCategory, (cat) => {
    state.activeCategory = cat;
    renderCategories();
    refreshCaseList();
  });
}

function refreshCaseList() {
  const filtered = applyFilters(state.catalog.cases);
  renderCaseList(els.caseList, filtered, onSelectCase, openCaseLocation);
}

async function reloadCatalog() {
  const data = await fetchCatalog();
  state.catalog = data;
  renderStats(els.stats, data.stats);
  renderCategories();
  refreshCaseList();
}

async function submitIntake(event) {
  event.preventDefault();
  const formData = new FormData(els.intakeForm);
  const file = formData.get("challenge");
  if (!(file instanceof File) || !file.name) {
    appendLog("请先选择题目文件", true);
    return;
  }

  const category = String(formData.get("category") || "auto");
  const subcategory = String(formData.get("subcategory") || "");
  if (category === "auto" || !subcategory) {
    formData.delete("subcategory");
  }

  const data = await intakeChallengeUpload(formData);
  renderCurrentCase(data.current);
  appendLog(`题目已添加: ${data.current?.id || "-"}`);
  els.intakeForm.reset();
  renderIntakeSubcategorySelect();
  await reloadCatalog();
}

async function submitArtifact(event) {
  event.preventDefault();
  const formData = new FormData(els.artifactForm);
  const file = formData.get("artifact");
  if (!(file instanceof File) || !file.name) {
    appendLog("请先选择要追加的文件", true);
    return;
  }

  if (!String(formData.get("case") || "").trim() && state.activeCase?.id) {
    formData.set("case", state.activeCase.id);
  }

  const data = await addArtifactUpload(formData);
  renderCurrentCase(data.current);
  appendLog(`产物已添加: ${String(formData.get("kind"))}`);
  els.artifactForm.reset();
  if (els.artifactCase && data.current?.id) {
    els.artifactCase.value = data.current.id;
  }
  await reloadCatalog();
}

function wireEvents() {
  els.searchInput.addEventListener("input", refreshCaseList);
  els.statusFilter.addEventListener("change", refreshCaseList);
  els.difficultyFilter?.addEventListener("change", refreshCaseList);
  els.sortFilter?.addEventListener("change", refreshCaseList);
  els.intakeCategory?.addEventListener("change", renderIntakeSubcategorySelect);

  els.intakeForm.addEventListener("submit", async (event) => {
    try {
      await submitIntake(event);
    } catch (err) {
      appendLog(`添加题目失败: ${err.message}`, true);
    }
  });

  els.artifactForm.addEventListener("submit", async (event) => {
    try {
      await submitArtifact(event);
    } catch (err) {
      appendLog(`添加产物失败: ${err.message}`, true);
    }
  });

  els.refreshCurrentBtn.addEventListener("click", async () => {
    await loadCurrentCase();
    appendLog("当前题已刷新");
  });

  els.rebuildBtn.addEventListener("click", async () => {
    try {
      await rebuildCatalogIndex();
      await reloadCatalog();
      appendLog("索引重建完成");
    } catch (err) {
      appendLog(`重建索引失败: ${err.message}`, true);
    }
  });

  els.detailSaveBtn?.addEventListener("click", async () => {
    await saveActiveCaseAll();
  });
  els.detailTitleName?.addEventListener("click", () => {
    openDetailTitleEditor();
  });
  els.detailTitleName?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetailTitleEditor();
    }
  });

  document.addEventListener("keydown", handleSaveShortcut);
  window.addEventListener("beforeunload", handleBeforeUnload);
}

async function bootstrap() {
  try {
    setDetailTitleName(null);
    setDetailSaveState(false, "保存");
    wireEvents();
    await checkSaveApiReady();
    await loadCategoryTree();
    await reloadCatalog();
    await loadCurrentCase();
    appendLog("页面已就绪");
  } catch (err) {
    els.stats.textContent = `加载失败: ${err.message}`;
    appendLog(`初始化失败: ${err.message}`, true);
  }
}

bootstrap();
