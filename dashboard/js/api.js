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
