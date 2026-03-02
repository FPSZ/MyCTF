import {
  addArtifactUpload,
  fetchCatalog,
  fetchCategoryTree,
  fetchCurrentCase,
  fetchWpText,
  intakeChallengeUpload,
  rebuildCatalogIndex,
} from "./api.js";
import {
  renderStats,
  renderCategoryList,
  renderCaseDetail,
  renderCaseList,
} from "./ui.js";

const els = {
  stats: document.getElementById("stats"),
  categoryList: document.getElementById("category-list"),
  caseList: document.getElementById("case-list"),
  caseDetail: document.getElementById("case-detail"),
  searchInput: document.getElementById("search-input"),
  statusFilter: document.getElementById("status-filter"),
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

function applyFilters(cases) {
  const kw = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;

  return cases.filter((item) => {
    if (state.activeCategory !== "all" && item.category !== state.activeCategory) {
      return false;
    }
    if (status && item.status !== status) {
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
    `状态: ${current.status || "-"}`,
  ].join("\n");
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

async function onSelectCase(item) {
  state.activeCase = item;
  if (els.artifactCase) {
    els.artifactCase.value = item.id || "";
  }

  let wpText = "";
  if (item.wp_files && item.wp_files.length > 0) {
    try {
      wpText = await fetchWpText(item.wp_files[0]);
    } catch (err) {
      wpText = `读取 WP 失败: ${err.message}`;
    }
  }
  renderCaseDetail(els.caseDetail, item, wpText);
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
  renderCaseList(els.caseList, filtered, onSelectCase);
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
}

async function bootstrap() {
  try {
    wireEvents();
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
