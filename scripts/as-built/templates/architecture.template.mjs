import { mdCodeBlock } from "../lib/markdown-utils.mjs";

const SANITIZE_SNIPPET = `(() => {
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

  const md = \`### localStorage snapshot (sanitizado)
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
})();`;

export function renderArchitecture(ctx) {
  return `# ARCHITECTURE (as-built)

> **Gerado em:** ${ctx.now}

## Visão geral
A aplicação está organizada como front-end React/Vite com persistência local em \`localStorage\`, separando domínio, storage, páginas, autenticação e rotas.

## Organização de pastas
- \`src/domain/\`: tipos e contratos de dados
- \`src/storage/\`: persistência local, regras e eventos
- \`src/pages/\`: telas
- \`src/auth/\`: guards e AuthContext
- \`src/routes/\`: rotas
- \`docs/\`: documentação as-built

## Contratos do localStorage
${ctx.keysList}

### Observações
- Chaves com template, como \`mvp_protocolo_seq_\${year}\`, são dinâmicas.
- Payloads podem conter dados sensíveis; use sempre snapshot sanitizado.

## Modelo de dados em alto nível

### Áreas
- Key típica: \`mvp_areas_v1\`
- Tipo: \`AreaPublica[]\`
- Campos relevantes:
  - id
  - codigo
  - nome
  - tipo
  - bairro
  - logradouro
  - metragem_m2
  - status
  - ativo
  - restricoes
  - geo_arquivo
  - created_at
  - updated_at

### Propostas
- Key típica: \`mvp_proposals_v1\`
- Tipo: \`PropostaAdocao[]\`
- Campos críticos:
  - \`codigo_protocolo\`
  - \`kanban_coluna\`
  - \`history[]\`
  - \`closed_status\`
  - \`closed_at\`

## Invariantes de domínio
1. Nunca existir mais de 1 proposta aberta por \`area_id\`.
2. Ao criar proposta, a área muda para **em_adocao**.
3. Ao assinar termo, a área muda para **adotada**.
4. Ao indeferir, a área volta para **disponivel**.
5. Mover para **ajustes** exige \`note\` não vazia.
6. Somente o dono pode editar e reenviar quando em ajustes.

## Segurança e sanitização
Cole o snippet abaixo no DevTools Console e depois cole a saída em \`docs/AS_BUILT.md\`.

${mdCodeBlock(SANITIZE_SNIPPET, "js")}

## Notas de migração e normalização
- Se existirem versões antigas sem \`history\`, o storage pode normalizar criando um evento \`create\` mínimo.
- A migração futura para backend deve preservar o event-log como fonte de verdade.
`;
}