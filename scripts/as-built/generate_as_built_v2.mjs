import path from "node:path";
import { writeFile, ensureDir } from "./lib/fs-utils.mjs";
import { buildDocContext } from "./lib/context.mjs";
import { renderAsBuilt } from "./templates/as-built.template.mjs";
import { renderArchitecture } from "./templates/architecture.template.mjs";
import { renderRoadmap } from "./templates/roadmap.template.mjs";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");

function generateDocs() {
  ensureDir(DOCS_DIR);

  const ctx = buildDocContext(ROOT);

  writeFile(path.join(DOCS_DIR, "AS_BUILT.md"), renderAsBuilt(ctx));
  writeFile(path.join(DOCS_DIR, "ARCHITECTURE.md"), renderArchitecture(ctx));
  writeFile(path.join(DOCS_DIR, "ROADMAP.md"), renderRoadmap(ctx));

  console.log("✅ docs/AS_BUILT.md gerado");
  console.log("✅ docs/ARCHITECTURE.md gerado");
  console.log("✅ docs/ROADMAP.md gerado");
}

generateDocs();
