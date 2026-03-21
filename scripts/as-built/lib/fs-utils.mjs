import fs from "node:fs";
import path from "node:path";

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

export function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

export function listFilesRecursive(dir, opts = {}) {
  const {
    exts = [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    ignore = ["node_modules", "dist", "build", ".git", "coverage"],
  } = opts;

  const out = [];
  const stack = [dir];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const full = path.join(cur, e.name);

      if (ignore.some((ig) => full.includes(path.sep + ig + path.sep) || full.endsWith(path.sep + ig))) {
        continue;
      }

      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && exts.includes(path.extname(e.name))) {
        out.push(full);
      }
    }
  }

  return out;
}