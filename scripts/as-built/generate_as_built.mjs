// scripts/as-built/generate_as_built.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const SRC_DIR = path.join(ROOT, "src");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function listFilesRecursive(dir, opts = {}) {
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
      } else if (e.isFile()) {
        if (exts.includes(path.extname(e.name))) out.push(full);
      }
    }
  }

  return out;
}

function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
  } catch {
    return "—";
  }
}

function extractRoutes(appRoutesText) {
  // Captura <Route path="..." element={<Component />} />
  // Não tenta resolver wrappers (RequireManager/RequireAdmin), apenas coleta path->element
  const routes = [];
  const re = /<Route\s+[^>]*path="([^"]+)"[^>]*element=\{<([A-Za-z0-9_]+)[^>]*\/>\}[^>]*\/>/g;

  let m;
  while ((m = re.exec(appRoutesText))) {
    routes.push({ path: m[1], element: m[2] });
  }

  // Captura <Route path="..." element={<div>... (fallback) ...</div>} />
  const reFallback = /<Route\s+[^>]*path="([^"]+)"[^>]*element=\{<([A-Za-z0-9_]+|div)[^>]*>/g;
  while ((m = reFallback.exec(appRoutesText))) {
    const p = m[1];
    const el = m[2];
    if (!routes.some((r) => r.path === p)) routes.push({ path: p, element: el });
  }

  // Captura <Route path="/" element={<Navigate ... />} />
  const reNavigate = /<Route\s+[^>]*path="([^"]+)"[^>]*element=\{<Navigate\b/g;
  while ((m = reNavigate.exec(appRoutesText))) {
    const p = m[1];
    if (!routes.some((r) => r.path === p)) routes.push({ path: p, element: "Navigate" });
  }

  routes.sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));
  return routes;
}

function extractLocalStorageKeys(allSourceText) {
  const keys = new Set();

  // localStorage.getItem("X") / setItem("X") / removeItem("X")
  const reCalls = /localStorage\.(getItem|setItem|removeItem)\(\s*["'`](.+?)["'`]\s*/g;
  let m;
  while ((m = reCalls.exec(allSourceText))) keys.add(m[2]);

  // const KEY = "X"
  const reConst = /\bconst\s+([A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*["'`](.+?)["'`]/g;
  while ((m = reConst.exec(allSourceText))) keys.add(m[2]);

  // padrões dinâmicos (ex.: mvp_protocolo_seq_${year})
  const reTpl = /localStorage\.(getItem|setItem)\(\s*`([^`]+)`\s*/g;
  while ((m = reTpl.exec(allSourceText))) keys.add("`" + m[2] + "`");

  return Array.from(keys).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function inventoryPages() {
  const pagesDir = path.join(SRC_DIR, "pages");
  const files = listFilesRecursive(pagesDir, { exts: [".tsx"] });
  return files
    .map((f) => ({
      file: path.relative(ROOT, f).replaceAll("\\", "/"),
      name: path.basename(f).replace(".tsx", ""),
    }))
    .sort((a, b) => a.file.localeCompare(b.file, "pt-BR"));
}

function readKeyFiles() {
  const appTsx = readFileSafe(path.join(SRC_DIR, "App.tsx"));
  const routesTsx = readFileSafe(path.join(SRC_DIR, "routes", "AppRoutes.tsx"));

  const storageFiles = listFilesRecursive(path.join(SRC_DIR, "storage"), { exts: [".ts"] });
  const domainFiles = listFilesRecursive(path.join(SRC_DIR, "domain"), { exts: [".ts"] });
  const authFiles = listFilesRecursive(path.join(SRC_DIR, "auth"), { exts: [".ts", ".tsx"] });

  const allText =
    [appTsx, routesTsx]
      .concat(storageFiles.map(readFileSafe))
      .concat(domainFiles.map(readFileSafe))
      .concat(authFiles.map(readFileSafe))
      .join("\n\n");

  return { appTsx, routesTsx, allText, storageFiles, domainFiles, authFiles };
}

function mdBlock(title, body) {
  return `\n## ${title}\n\n${body}\n`;
}

function generateDocs() {
  ensureDir(DOCS_DIR);

  const { routesTsx, allText } = readKeyFiles();
  const routes = extractRoutes(routesTsx);
  const pages = inventoryPages();
  const keys = extractLocalStorageKeys(allText);

  const now = new Date().toISOString();

  const gitHead = runGit("git rev-parse HEAD");
  const gitBranch = runGit("git rev-parse --abbrev-ref HEAD");
  const gitStatus = runGit("git status --porcelain");
  const gitLog = runGit("git log -n 20 --oneline");
  const gitDiffStat = runGit("git diff --stat");

  const routesList = routes.length
    ? routes.map((r) => `- \`${r.path}\` → **${r.element}**`).join("\n")
    : "- (não foi possível extrair rotas automaticamente)";

  const pagesList = pages.length
    ? pages.map((p) => `- \`${p.file}\` (**${p.name}**)`).join("\n")
    : "- (não foi possível listar pages/)";

  const keysList = keys.length
    ? keys.map((k) => `- \`${k}\``).join("\n")
    : "- (nenhuma chave identificada)";

  // ---------------- AS_BUILT ----------------
  const AS_BUILT =
`# AS-BUILT (estado atual do sistema)

> **Gerado em:** ${now}

## Como rodar
\`\`\`bash
npm install
npm run dev
\`\`\`

## Mapa de rotas (extraído de src/routes/AppRoutes.tsx)
${routesList}

## Inventário de telas (src/pages/**/*.tsx)
${pagesList}

## Fluxo por perfil (resumo)
- **Público (sem login):** Início, Áreas, Login
- **Adotante (PF/PJ):** Nova Proposta, Minhas Propostas, Detalhe, Atender Ajustes (quando em AJUSTES)
- **Gestores:** Kanban, Detalhe da Proposta (gestor), movimentações por órgão
- **Admin:** CRUD Áreas, Importação CSV, (Relatórios se habilitado)
- **Relatórios:** visível para **gestor_semad** e **administrador**

## Regras de negócio implementadas (pontos críticos)
- **Protocolo único:** \`codigo_protocolo\` é gerado na criação e **não muda** em reenvios.
- **Ajustes com motivo obrigatório:** qualquer órgão ao mover para AJUSTES exige \`note\`.
- **Reenvio após ajustes:** adotante pode editar plano/anexos e reenviar; o fluxo volta para análise conforme regra do storage.
- **Concorrência por área:** **1 proposta aberta por área** (bloqueia concorrentes).
- **Status da área (automático):**
  - Proposta criada (Protocolo) → área **em_adocao**
  - Termo assinado → área **adotada**
  - Indeferida → área **disponivel**

## Evidências (colar aqui)
### Snapshot sanitizado do localStorage
> Cole aqui o snapshot gerado pelo script do browser (ver seção “Snapshot sanitizado” em ARCHITECTURE.md).

### Checklist de reprodução mínima
1) Admin: importar áreas via CSV (ou “zerar áreas (teste CSV)” e importar)
2) Adotante: criar proposta para uma área **disponível**
3) Gestor SEMAD: mover Protocolo → Análise SEMAD
4) Gestor: solicitar AJUSTES **com motivo**
5) Adotante: abrir detalhe → “Atender ajustes” → substituir anexos/editar plano → reenviar
6) Gestor: avançar no Kanban até Termo assinado ou Indeferida
7) Relatórios: validar período e produtividade (SEMAD) com base em eventos

### Checklist de validação (por tela)
- Áreas: exibe áreas ativas; não permite iniciar proposta quando área não está disponível
- Nova Proposta: lista todas as áreas **disponíveis** e ativas
- Minhas Propostas: aparece imediatamente após criar (via subscribe)
- Detalhe do Adotante: mostra motivo de AJUSTES no topo; botão “Atender ajustes” só quando aplicável e dono
- Kanban: movimentações registram eventos; AJUSTES exige motivo
- Relatórios: contagens por período devem bater com eventos (create/move/request_adjustments/decision)

## Versão (git)
- **Branch:** ${gitBranch}
- **Commit:** ${gitHead}

### git status (porcelain)
\`\`\`
${gitStatus || "(limpo)"}
\`\`\`

### git diff --stat
\`\`\`
${gitDiffStat}
\`\`\`

### git log -n 20 --oneline
\`\`\`
${gitLog}
\`\`\`
`;

  // ---------------- ARCHITECTURE ----------------
  const ARCH =
`# Architecture (as-built)

> **Gerado em:** ${now}

## Organização de pastas (esperada)
- \`src/domain/\`: tipos e contratos de dados
- \`src/storage/\`: persistência em localStorage, regras e eventos
- \`src/pages/\`: telas (UI)
- \`src/auth/\`: guards e AuthContext
- \`src/routes/\`: rotas
- \`docs/\`: documentação as-built

## Contratos do localStorage (chaves encontradas)
${keysList}

### Observações importantes
- Chaves com template (ex.: \`mvp_protocolo_seq_\${year}\`) são dinâmicas.
- Payloads podem conter dados sensíveis (e-mail/telefone). Use sempre snapshot **sanitizado**.

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
  - \`history[]\` (event log: create/move/request_adjustments/decision)
  - \`closed_status/closed_at\` (quando encerrada)

## Invariantes (devem sempre ser verdade)
1) **Nunca** existir mais de 1 proposta aberta por \`area_id\`.
2) Ao criar proposta: área muda para **em_adocao**.
3) Ao assinar termo: área muda para **adotada**.
4) Ao indeferir: área volta para **disponivel**.
5) Mover para **ajustes** exige \`note\` não-vazia (motivo).
6) Somente o **dono** (adotante) pode editar e reenviar quando em ajustes.

## Snapshot sanitizado do localStorage (browser)
Cole este snippet no DevTools Console e cole o resultado em \`docs/AS_BUILT.md\`.

\`\`\`js
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
\`\`\`

## Notas de migração/normalização
- Se versões antigas existirem sem \`history\`, o storage normaliza criando um evento \`create\` mínimo para suportar relatórios/SLA.
`;

  // ---------------- CHANGELOG ----------------
  const CHANGELOG =
`# Changelog (as-built)

> **Gerado em:** ${now}

## Estado atual (o que funciona)
- Portal com perfis: público, adotante (PF/PJ), gestores (SEMAD/ECOS/Governo), administrador.
- Áreas:
  - CRUD admin + importação CSV + modo de teste (“zerar áreas”).
  - Listagem pública filtrando ativas e disponíveis.
- Propostas:
  - Criação via wizard com protocolo.
  - Bloqueio de proposta concorrente por área.
  - Kanban com transições por perfil e exigência de motivo em AJUSTES.
  - Tela do adotante mostra motivo/orientações no topo e permite atender ajustes.
- Eventos:
  - \`history\` com eventos para relatórios por período e produtividade.
- Relatórios:
  - Base preparada para cálculo por período (eventos) e SLA (permanência por coluna).

## Lacunas / riscos conhecidos
- Persistência é localStorage (MVP): sem backend, sem autenticação real.
- Sanitização de dados para evidências deve ser sempre aplicada ao exportar snapshots.
- SLA: requer validação estatística e critérios de censura por período bem definidos em UI (metas por coluna).

## Próximos passos (priorizados) + DoD
1) **Relatórios por período 100% por eventos (não estado)**  
   - DoD: selecionar período e obter contagens idempotentes via \`history\`; testes com replay.
2) **SLA por coluna com metas configuráveis**  
   - DoD: P50/P80/P95 por coluna, violações por meta, itens abertos censurados no fim do período.
3) **Cadastro mínimo real de adotante PF/PJ**  
   - DoD: nome/email/celular/whatsapp persistidos e exibidos em relatórios e detalhes, com sanitização.
4) **Exportações (CSV) com filtros por período/eventos**  
   - DoD: exportar listas e consolidado com rastreabilidade (protocolo, timestamps, ator).
`;

  writeFile(path.join(DOCS_DIR, "AS_BUILT.md"), AS_BUILT);
  writeFile(path.join(DOCS_DIR, "ARCHITECTURE.md"), ARCH);
  writeFile(path.join(DOCS_DIR, "CHANGELOG.md"), CHANGELOG);

  console.log("✅ docs/AS_BUILT.md gerado");
  console.log("✅ docs/ARCHITECTURE.md gerado");
  console.log("✅ docs/CHANGELOG.md gerado");
}

generateDocs();