import { fetchCatalog, fetchWpText } from "./api.js";
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
};

const state = {
  catalog: null,
  activeCategory: "all",
  activeCase: null,
};

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

async function onSelectCase(item) {
  state.activeCase = item;
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

function refreshList() {
  const filtered = applyFilters(state.catalog.cases);
  renderCaseList(els.caseList, filtered, onSelectCase);
}

function wireEvents() {
  els.searchInput.addEventListener("input", refreshList);
  els.statusFilter.addEventListener("change", refreshList);
}

async function bootstrap() {
  try {
    const data = await fetchCatalog();
    state.catalog = data;
    renderStats(els.stats, data.stats);

    const counts = buildCategoryCounts(data.cases);
    renderCategoryList(els.categoryList, counts, state.activeCategory, (cat) => {
      state.activeCategory = cat;
      renderCategoryList(els.categoryList, counts, state.activeCategory, (nextCat) => {
        state.activeCategory = nextCat;
        refreshList();
      });
      refreshList();
    });

    wireEvents();
    refreshList();
  } catch (err) {
    els.stats.textContent = `加载失败: ${err.message}`;
    els.caseDetail.innerHTML = "<p>请先执行 catalog 构建命令。</p>";
  }
}

bootstrap();
