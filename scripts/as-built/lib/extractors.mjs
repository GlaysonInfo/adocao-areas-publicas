import path from "node:path";
import { listFilesRecursive, readFileSafe } from "./fs-utils.mjs";

export function extractRoutes(appRoutesText) {
  const routes = [];

  const re = /<Route\s+[^>]*path="([^"]+)"[^>]*element=\{<([A-Za-z0-9_]+)[^>]*\/>\}[^>]*\/>/g;
  let m;

  while ((m = re.exec(appRoutesText))) {
    routes.push({ path: m[1], element: m[2] });
  }

  const reFallback = /<Route\s+[^>]*path="([^"]+)"[^>]*element=\{<([A-Za-z0-9_]+|div)[^>]*>/g;
  while ((m = reFallback.exec(appRoutesText))) {
    const pathValue = m[1];
    const elementValue = m[2];
    if (!routes.some((r) => r.path === pathValue)) {
      routes.push({ path: pathValue, element: elementValue });
    }
  }

  const reNavigate = /<Route\s+[^>]*path="([^"]+)"[^>]*element=\{<Navigate\b/g;
  while ((m = reNavigate.exec(appRoutesText))) {
    const pathValue = m[1];
    if (!routes.some((r) => r.path === pathValue)) {
      routes.push({ path: pathValue, element: "Navigate" });
    }
  }

  routes.sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));
  return routes;
}

export function extractLocalStorageKeys(allSourceText) {
  const keys = new Set();

  const reCalls = /localStorage\.(getItem|setItem|removeItem)\(\s*["'`](.+?)["'`]\s*/g;
  let m;
  while ((m = reCalls.exec(allSourceText))) {
    keys.add(m[2]);
  }

  const reConst = /\bconst\s+([A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*["'`](.+?)["'`]/g;
  while ((m = reConst.exec(allSourceText))) {
    keys.add(m[2]);
  }

  const reTpl = /localStorage\.(getItem|setItem)\(\s*`([^`]+)`\s*/g;
  while ((m = reTpl.exec(allSourceText))) {
    keys.add("`" + m[2] + "`");
  }

  return Array.from(keys).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function inventoryPages(root, srcDir) {
  const pagesDir = path.join(srcDir, "pages");
  const files = listFilesRecursive(pagesDir, { exts: [".tsx"] });

  return files
    .map((f) => ({
      file: path.relative(root, f).replaceAll("\\", "/"),
      name: path.basename(f).replace(".tsx", ""),
    }))
    .sort((a, b) => a.file.localeCompare(b.file, "pt-BR"));
}

export function readKeyFiles(srcDir) {
  const appTsx = readFileSafe(path.join(srcDir, "App.tsx"));
  const routesTsx = readFileSafe(path.join(srcDir, "routes", "AppRoutes.tsx"));

  const storageFiles = listFilesRecursive(path.join(srcDir, "storage"), { exts: [".ts"] });
  const domainFiles = listFilesRecursive(path.join(srcDir, "domain"), { exts: [".ts"] });
  const authFiles = listFilesRecursive(path.join(srcDir, "auth"), { exts: [".ts", ".tsx"] });

  const allText = [appTsx, routesTsx]
    .concat(storageFiles.map(readFileSafe))
    .concat(domainFiles.map(readFileSafe))
    .concat(authFiles.map(readFileSafe))
    .join("\n\n");

  return {
    appTsx,
    routesTsx,
    allText,
    storageFiles,
    domainFiles,
    authFiles,
  };
}