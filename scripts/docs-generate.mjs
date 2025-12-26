// scripts/docs-generate.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");

function sh(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function isoNow() {
  return new Date().toISOString();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(fp, content) {
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, "utf8");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // ignora build e deps
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

/**
 * Extrai strings do tipo "mvp_*" de:
 * - const KEY = "mvp_xxx"
 * - localStorage.getItem("mvp_xxx"), setItem, removeItem
 * Também tenta detectar templates com ${...}
 */
function extractLocalStorageKeys() {
  const storageDir = path.join(ROOT, "src", "storage");
  const files = walk(storageDir).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));

  const keys = [];
  const templates = [];

  const reKeyConst = /const\s+KEY\s*=\s*([`'"])(.*?)\1/g;
  const reLS = /localStorage\.(getItem|setItem|removeItem)\(\s*([`'"])(.*?)\2\s*[,)]/g;

  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8");

    for (const m of txt.matchAll(reKeyConst)) {
      const v = String(m[2] ?? "");
      if (!v.includes("mvp_")) continue;
      if (v.includes("${")) templates.push(v);
      else keys.push(v);
    }

    for (const m of txt.matchAll(reLS)) {
      const v = String(m[3] ?? "");
      if (!v.includes("mvp_")) continue;
      if (v.includes("${")) templates.push(v);
      else keys.push(v);
    }
  }

  return {
    keys: uniqSorted(keys),
    templates: uniqSorted(templates),
  };
}

function extractRoles() {
  const authFile = path.join(ROOT, "src", "auth", "AuthContext.tsx");
  if (!fs.existsSync(authFile)) return [];

  const txt = fs.readFileSync(authFile, "utf8");

  // captura strings em quotes que pareçam roles
  const candidates = [];
  for (const m of txt.matchAll(/["'`](adotante_[a-z]+|gestor_[a-z]+|administrador)["'`]/g)) {
    candidates.push(m[1]);
  }
  return uniqSorted(candidates);
}

function extractRoutes() {
  const routesFile = path.join(ROOT, "src", "routes", "AppRoutes.tsx");
  if (!fs.existsSync(routesFile)) return [];

  const txt = fs.readFileSync(routesFile, "utf8");

  // tenta pegar "path="..." ou path: "..."
  const routes = [];
  for (const m of txt.matchAll(/path\s*=\s*["'`]([^"'`]+)["'`]/g)) routes.push(m[1]);
  for (const m of txt.matchAll(/path\s*:\s*["'`]([^"'`]+)["'`]/g)) routes.push(m[1]);

  return uniqSorted(routes);
}

function gitMeta() {
  const branch = sh("git branch --show-current");
  const sha = sh("git rev-parse HEAD");
  const shaShort = sh("git rev-parse --short HEAD");
  const remote = sh("git remote get-url origin");
  const tag = sh("git describe --tags --abbrev=0") || "sem-tag";
  return { branch, sha, shaShort, remote, tag };
}

const SANITIZE_SNIPPET = `\`\`\`js
(() => {
  const REDACT = [
    { name: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi },
    { name: "phone", re: /\\b(?:\\+?55\\s*)?(?:\\(?\\d{2}\\)?\\s*)?\\d{4,5}-?\\d{4}\\b/g },
    { name: "cpf", re: /\\b\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}\\b/g },
    { name: "cnpj", re: /\\b\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}\\b/g }
  ];

  const sanitizeString = (s) => {
    let out = String(s ?? "");
    for (const r of REDACT) out = out.replace(r.re, "[REDACTED]");
    return out;
  };

  const sanitize = (v) => {
    if (v == null) return v;
    if (typeof v === "string") return sanitizeString(v);
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.map(sanitize);
    if (typeof v === "object") {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = sanitize(val);
      return o;
    }
    return sanitizeString(v);
  };

  const keys = Object.keys(localStorage).sort();
  const dump = {};
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw == null) continue;

    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch {}

    dump[k] = sanitize(parsed);
  }

  const md =
\`### localStorage snapshot (sanitizado)
\\\`\\\`\\\`json
\${JSON.stringify(dump, null, 2)}
\\\`\\\`\\\`\`;

  console.log(md);

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(md).then(
      () => console.log("✅ Copiado para a área de transferência."),
      () => console.log("⚠️ Não foi possível copiar automaticamente; copie do console.")
    );
  }
})();
\`\`\``;

function genArchitecture() {
  const { branch, shaShort } = gitMeta();
  const { keys, templates } = extractLocalStorageKeys();

  return `# Architecture (as-built)

> **Gerado em:** ${isoNow()}
> **Branch/commit:** ${branch || "—"} · ${shaShort || "—"}

## Organização de pastas (esperada)
- \`src/domain/\`: tipos e contratos de dados
- \`src/storage/\`: persistência em localStorage, regras e eventos
- \`src/pages/\`: telas (UI)
- \`src/auth/\`: guards e AuthContext
- \`src/routes/\`: rotas
- \`docs/\`: documentação as-built

## Contratos do localStorage (chaves encontradas)
${keys.length ? keys.map((k) => `- \`${k}\``).join("\n") : "- (nenhuma detectada)"}

${templates.length ? `### Observações importantes
- Chaves com template (dinâmicas) detectadas:
${templates.map((k) => `  - \`${k}\``).join("\n")}
- Payloads podem conter dados sensíveis (e-mail/telefone). Use sempre snapshot **sanitizado**.` : `### Observações importantes
- Chaves com template (ex.: \`mvp_protocolo_seq_\${year}\`) são dinâmicas.
- Payloads podem conter dados sensíveis (e-mail/telefone). Use sempre snapshot **sanitizado**.`}

## Schema (alto nível)
### Áreas
- Key típica: \`mvp_areas_v1\`
- Tipo: \`AreaPublica[]\`
- Campos relevantes: id, codigo, nome, tipo, bairro, logradouro, metragem_m2, status, ativo, restricoes, geo_arquivo, created_at, updated_at

### Propostas
- Key típica: \`mvp_proposals_v1\`
- Tipo: \`PropostaAdocao[]\`
- Campos críticos:
  - \`codigo_protocolo\` (imutável após create)
  - \`kanban_coluna\` (estado atual)
  - \`history[]\` (event log: create/move/request_adjustments/decision/override_no_vistoria)
  - \`closed_status/closed_at\` (quando encerrada)

### Vistorias
- Key típica: \`mvp_vistorias_v1\` (se existir no projeto)
- Tipo: \`Vistoria[]\`
- Campos: status, checklist, anexos (metadados), laudo (conclusão/emitido_em/recomendações), history[] (create/status_change/emit_laudo)

## Invariantes (devem sempre ser verdade)
1) **Nunca** existir mais de 1 proposta aberta por \`area_id\`.
2) Ao criar proposta: área muda para **em_adocao**.
3) Ao assinar termo: área muda para **adotada**.
4) Ao indeferir: área volta para **disponivel**.
5) Mover para **ajustes** exige \`note\` não-vazia (motivo).
6) Somente o **dono** (adotante) pode editar e reenviar quando em ajustes.

## Snapshot sanitizado do localStorage (browser)
Cole este snippet no DevTools Console e cole o resultado em \`docs/AS_BUILT.md\`.

${SANITIZE_SNIPPET}

## Notas de migração/normalização
- Se versões antigas existirem sem \`history\`, o storage pode normalizar criando um evento \`create\` mínimo para suportar relatórios/SLA.
`;
}

function genHandoff() {
  const roles = extractRoles();
  const routes = extractRoutes();

  return `# HANDOFF (contexto mínimo para novo chat)

> **Gerado em:** ${isoNow()}

## Objetivo
Portal de adoção de áreas (adotante / gestores / admin), com Kanban + relatórios + fluxo de ajustes + vistorias.

## Perfis (detectados)
${roles.length ? roles.map((r) => `- ${r}`).join("\n") : "- (não foi possível detectar automaticamente)"}

## Regras críticas (validar no storage)
- Bloqueio: 1 proposta aberta por área (sem concorrência)
- Status da área:
  - Protocolo/criação => em_adoção
  - Termo assinado => adotada
  - Indeferida => disponível
- Ajustes: órgão solicita com motivo obrigatório; adotante atende e reenvia; protocolo permanece o mesmo.
- Vistoria/laudo: laudo só pode ser emitido se vistoria estiver “realizada” (ou equivalente) e gera event-log.

## Onde olhar
- Rotas: \`src/routes/AppRoutes.tsx\`
- Kanban: \`src/pages/ManagerKanbanPage.tsx\` + \`src/storage/proposals.ts\`
- Ajustes: MyProposalDetailPage + MyProposalEditPage + \`src/storage/proposals.ts\`
- Relatórios: \`src/pages/reports/ReportsPage.tsx\`
- Vistorias: páginas \`src/pages/ManagerVistorias*\` + \`src/storage/vistorias.ts\`

## Rotas (detectadas)
${routes.length ? routes.map((p) => `- \`${p}\``).join("\n") : "- (não foi possível detectar automaticamente)"}

## Próximos passos (placeholder)
- Export/Import melhorado (com validação e templates).
- Relatórios por período baseados em eventos + SLA por coluna (P50/P80/P95 + violações).
- Laudo “pré-preenchido” editável com template institucional e evidências.
`;
}

function genValidation() {
  const { branch, sha, remote, tag } = gitMeta();
  const status = sh("git status --porcelain=v1");
  const clean = status ? "NÃO (há alterações locais)" : "SIM (working tree clean)";

  return `# VALIDATION — Evidências e reprodução

> **Gerado em:** ${isoNow()}
> **Branch:** ${branch || "—"}
> **Commit:** ${sha || "—"}
> **Tag base:** ${tag || "—"}
> **Remote:** ${remote || "—"}
> **Working tree clean:** ${clean}

## A) Rodar local (dev)
1) \`npm install\`
2) \`npm run dev\`
3) Acesse o app e use o **DevToolbar** (se disponível) para reset/import/export.

## B) Build e lint
- \`npm run build\`
- \`npm run lint\` (se existir no projeto)

## C) Evidências via localStorage (manual, via DevTools)
1) Abrir o portal no navegador.
2) DevTools → Console.
3) Rodar o snapshot sanitizado (recomendado) — ver \`docs/ARCHITECTURE.md\`.

## D) Sanity checks (aceite rápido)
- Criar proposta:
  - item em \`mvp_proposals_v1\`
  - \`history[]\` contém \`create\`
- Fluxo de ajustes:
  - mover para \`ajustes\` exige motivo (note)
  - adotante reenvia e volta para \`protocolo\` mantendo \`codigo_protocolo\`
- Vistoria:
  - emitir laudo só com status “realizada”
  - \`history[]\` registra \`emit_laudo\` / \`status_change\`
- Override sem vistoria:
  - ao avançar SEMAD → ECOS sem laudo, exige motivo e grava \`override_no_vistoria\` no event-log

## E) Estado do Git (resumo)
\`\`\`
${sh("git log -1 --oneline") || "(sem git)"}
\`\`\`
`;
}

function main() {
  ensureDir(DOCS_DIR);

  writeFile(path.join(DOCS_DIR, "ARCHITECTURE.md"), genArchitecture());
  writeFile(path.join(DOCS_DIR, "HANDOFF.md"), genHandoff());
  writeFile(path.join(DOCS_DIR, "VALIDATION.md"), genValidation());

  console.log("✅ docs gerados/atualizados:");
  console.log(" - docs/ARCHITECTURE.md");
  console.log(" - docs/HANDOFF.md");
  console.log(" - docs/VALIDATION.md");
}

main();