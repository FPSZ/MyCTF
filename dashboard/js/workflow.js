const els = {
  intakeUploadForm: document.getElementById("intake-upload-form"),
  intakePathForm: document.getElementById("intake-path-form"),
  addArtifactForm: document.getElementById("add-artifact-form"),
  refreshCurrentBtn: document.getElementById("refresh-current-btn"),
  rebuildBtn: document.getElementById("rebuild-btn"),
  currentBox: document.getElementById("current-box"),
  logBox: document.getElementById("log-box"),
};

function nowTime() {
  return new Date().toLocaleTimeString();
}

function appendLog(message, isError = false) {
  const prefix = isError ? "[ERROR]" : "[OK]";
  els.logBox.textContent += `\n${nowTime()} ${prefix} ${message}`;
  els.logBox.scrollTop = els.logBox.scrollHeight;
}

async function parseJsonResponse(resp) {
  let data = {};
  try {
    data = await resp.json();
  } catch {
    data = {};
  }
  if (!resp.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return data;
}

function renderCurrent(current) {
  if (!current || !current.id) {
    els.currentBox.textContent = "当前题目：未设置";
    return;
  }
  els.currentBox.textContent = [
    `id: ${current.id}`,
    `name: ${current.name || "-"}`,
    `category: ${current.category || "-"}/${current.subcategory || "-"}`,
    `status: ${current.status || "-"}`,
    `path: ${current.path || "-"}`,
  ].join("\n");
}

async function refreshCurrent() {
  const resp = await fetch("/api/current", { cache: "no-store" });
  const data = await parseJsonResponse(resp);
  renderCurrent(data.current);
}

async function submitIntakeUpload(event) {
  event.preventDefault();
  const formData = new FormData(els.intakeUploadForm);
  const file = formData.get("challenge");
  if (!(file instanceof File) || !file.name) {
    appendLog("请选择题目文件", true);
    return;
  }

  const resp = await fetch("/api/intake-upload", {
    method: "POST",
    body: formData,
  });
  const data = await parseJsonResponse(resp);
  renderCurrent(data.current);
  appendLog(`入库成功: ${data.current.id}`);
}

async function submitIntakePath(event) {
  event.preventDefault();
  const fd = new FormData(els.intakePathForm);
  const payload = {
    source: String(fd.get("source") || "").trim(),
    event: String(fd.get("event") || "").trim(),
    year: String(fd.get("year") || "").trim(),
  };
  const resp = await fetch("/api/intake-path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(resp);
  renderCurrent(data.current);
  appendLog(`路径入库成功: ${data.current.id}`);
}

async function submitAddArtifact(event) {
  event.preventDefault();
  const formData = new FormData(els.addArtifactForm);
  const file = formData.get("artifact");
  if (!(file instanceof File) || !file.name) {
    appendLog("请选择要追加的文件", true);
    return;
  }
  const resp = await fetch("/api/add-upload", {
    method: "POST",
    body: formData,
  });
  const data = await parseJsonResponse(resp);
  renderCurrent(data.current);
  appendLog(`追加成功: ${String(formData.get("kind"))} -> ${data.current.id}`);
}

async function rebuildCatalog() {
  const resp = await fetch("/api/rebuild", { method: "POST" });
  await parseJsonResponse(resp);
  appendLog("索引重建完成");
}

function wireEvents() {
  els.intakeUploadForm.addEventListener("submit", async (event) => {
    try {
      await submitIntakeUpload(event);
    } catch (err) {
      appendLog(`入库失败: ${err.message}`, true);
    }
  });

  els.intakePathForm.addEventListener("submit", async (event) => {
    try {
      await submitIntakePath(event);
    } catch (err) {
      appendLog(`路径入库失败: ${err.message}`, true);
    }
  });

  els.addArtifactForm.addEventListener("submit", async (event) => {
    try {
      await submitAddArtifact(event);
    } catch (err) {
      appendLog(`追加失败: ${err.message}`, true);
    }
  });

  els.refreshCurrentBtn.addEventListener("click", async () => {
    try {
      await refreshCurrent();
      appendLog("已刷新当前题");
    } catch (err) {
      appendLog(`刷新失败: ${err.message}`, true);
    }
  });

  els.rebuildBtn.addEventListener("click", async () => {
    try {
      await rebuildCatalog();
    } catch (err) {
      appendLog(`重建失败: ${err.message}`, true);
    }
  });
}

async function bootstrap() {
  wireEvents();
  try {
    await refreshCurrent();
    appendLog("页面已就绪");
  } catch (err) {
    appendLog(`初始化失败: ${err.message}`, true);
  }
}

bootstrap();
