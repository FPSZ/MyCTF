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

export function renderStats(node, stats) {
  node.textContent = `总题数: ${stats.total_cases} | 分类数: ${Object.keys(stats.by_category || {}).length} | 更新时间: ${stats.updated_at || "-"}`;
}

export function renderCategoryList(node, counts, activeCategory, onClick) {
  const categories = Object.keys(counts).sort();
  node.innerHTML = "";

  const makeBtn = (name, count) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = `${name} (${count})`;
    if (name !== "all") {
      btn.classList.add(catClass(name));
    }
    if (activeCategory === name) btn.classList.add("active");
    btn.addEventListener("click", () => onClick(name));
    li.appendChild(btn);
    return li;
  };

  const allCount = categories.reduce((n, c) => n + counts[c], 0);
  node.appendChild(makeBtn("all", allCount));
  categories.forEach((cat) => node.appendChild(makeBtn(cat, counts[cat])));
}

export function renderCaseList(node, cases, onSelect) {
  node.innerHTML = "";
  if (!cases.length) {
    node.innerHTML = `<li><button disabled>无匹配题目</button></li>`;
    return;
  }

  for (const item of cases) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    const catCls = catClass(item.category);
    btn.innerHTML = `
      <div class="case-name">${esc(item.name)}</div>
      <div class="case-meta">
        <span class="cat-badge ${catCls}">${esc(item.category)}</span>
        ${esc(item.subcategory)} | ${esc(item.event || "-")} | ${esc(item.status || "todo")}
      </div>
    `;
    btn.addEventListener("click", () => onSelect(item));
    li.appendChild(btn);
    node.appendChild(li);
  }
}

export function renderCaseDetail(node, item, wpText) {
  if (!item) {
    node.innerHTML = "<p>点左侧题目可预览内容。</p>";
    return;
  }

  const tags = (item.tags || []).slice(0, 6).map((t) => `<span class="chip">${esc(t)}</span>`).join("");
  const statusClass = `status-${(item.status || "todo").replace(/\s+/g, "_")}`;
  const categoryClass = catClass(item.category);
  const wpCount = (item.wp_files || []).length;
  const scriptCount = (item.script_files || []).length;
  const challengeCount = (item.challenge_files || []).length;

  node.innerHTML = `
    <h3>${esc(item.name)}</h3>
    <p>
      <span class="chip ${categoryClass}">${esc(item.category)}/${esc(item.subcategory)}</span>
      <span class="chip ${statusClass}">${esc(item.status || "todo")}</span>
      ${tags}
    </p>
    <p><b>Event:</b> ${esc(item.event || "-")} | <b>Year:</b> ${esc(item.year || "-")} | <b>Difficulty:</b> ${esc(item.difficulty || "-")}</p>
    <p><b>文件统计:</b> Challenge ${challengeCount} / Script ${scriptCount} / WP ${wpCount}</p>
    <p><b>Case:</b> <code>${esc(item.id || item.path || "-")}</code></p>

    <div class="wp-viewer">
      <div class="wp-viewer-header">WP 预览</div>
      <pre class="wp-viewer-content">${esc(wpText || item.wp_preview || "暂无 WP 内容")}</pre>
    </div>
  `;
}
