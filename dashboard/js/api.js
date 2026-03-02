export async function fetchCatalog() {
  const resp = await fetch("./catalog.json", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`读取 catalog.json 失败: ${resp.status}`);
  }
  return resp.json();
}

export async function fetchWpText(relativePathFromRoot) {
  const safePath = encodeURI(`../${relativePathFromRoot}`);
  const resp = await fetch(safePath, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`读取 WP 文件失败: ${resp.status}`);
  }
  return resp.text();
}

async function parseJson(resp) {
  let data = {};
  try {
    data = await resp.json();
  } catch {
    data = {};
  }
  if (!resp.ok || data.ok === false) {
    throw new Error(data.error || `请求失败: ${resp.status}`);
  }
  return data;
}

export async function fetchCurrentCase() {
  const resp = await fetch("/api/current", { cache: "no-store" });
  return parseJson(resp);
}

export async function intakeChallengeUpload(formData) {
  const resp = await fetch("/api/intake-upload", {
    method: "POST",
    body: formData,
  });
  return parseJson(resp);
}

export async function addArtifactUpload(formData) {
  const resp = await fetch("/api/add-upload", {
    method: "POST",
    body: formData,
  });
  return parseJson(resp);
}

export async function rebuildCatalogIndex() {
  const resp = await fetch("/api/rebuild", {
    method: "POST",
  });
  return parseJson(resp);
}
