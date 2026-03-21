import path from "node:path";
import { getGitContext } from "./git-utils.mjs";
import {
  extractRoutes,
  extractLocalStorageKeys,
  inventoryPages,
  readKeyFiles,
} from "./extractors.mjs";
import { mdList } from "./markdown-utils.mjs";

export function buildDocContext(root = process.cwd()) {
  const srcDir = path.join(root, "src");
  const now = new Date().toISOString();

  const { routesTsx, allText } = readKeyFiles(srcDir);

  const routes = extractRoutes(routesTsx);
  const pages = inventoryPages(root, srcDir);
  const storageKeys = extractLocalStorageKeys(allText);
  const git = getGitContext(root);

  return {
    root,
    srcDir,
    now,
    git,
    routes,
    pages,
    storageKeys,
    routesList: mdList(
      routes,
      (r) => `- \`${r.path}\` → **${r.element}**`,
      "(não foi possível extrair rotas automaticamente)"
    ),
    pagesList: mdList(
      pages,
      (p) => `- \`${p.file}\` (**${p.name}**)`,
      "(não foi possível listar pages/)"
    ),
    keysList: mdList(
      storageKeys,
      (k) => `- \`${k}\``,
      "(nenhuma chave identificada)"
    ),
  };
}
