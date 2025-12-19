# Architecture (as-built)

> **Gerado em:** 2025-12-19T04:07:59.921Z

## Organização de pastas (esperada)
- `src/domain/`: tipos e contratos de dados
- `src/storage/`: persistência em localStorage, regras e eventos
- `src/pages/`: telas (UI)
- `src/auth/`: guards e AuthContext
- `src/routes/`: rotas
- `docs/`: documentação as-built

## Contratos do localStorage (chaves encontradas)
- `mvp_adopters_v1`
- `mvp_areas_v1`
- `mvp_audit_v1`
- `mvp_events_v1`
- `mvp_proposals_v1`
- `mvp_role`

### Observações importantes
- Chaves com template (ex.: `mvp_protocolo_seq_${year}`) são dinâmicas.
- Payloads podem conter dados sensíveis (e-mail/telefone). Use sempre snapshot **sanitizado**.

## Schema (alto nível)
### Áreas
- Key típica: `mvp_areas_v1`
- Tipo: `AreaPublica[]`
- Campos relevantes: id, codigo, nome, tipo, bairro, logradouro, metragem_m2, status, ativo, restricoes, geo_arquivo, created_at, updated_at

### Propostas
- Key típica: `mvp_proposals_v1`
- Tipo: `PropostaAdocao[]`
- Campos críticos:
  - `codigo_protocolo` (imutável após create)
  - `kanban_coluna` (estado atual)
  - `history[]` (event log: create/move/request_adjustments/decision)
  - `closed_status/closed_at` (quando encerrada)

## Invariantes (devem sempre ser verdade)
1) **Nunca** existir mais de 1 proposta aberta por `area_id`.
2) Ao criar proposta: área muda para **em_adocao**.
3) Ao assinar termo: área muda para **adotada**.
4) Ao indeferir: área volta para **disponivel**.
5) Mover para **ajustes** exige `note` não-vazia (motivo).
6) Somente o **dono** (adotante) pode editar e reenviar quando em ajustes.

## Snapshot sanitizado do localStorage (browser)
Cole este snippet no DevTools Console e cole o resultado em `docs/AS_BUILT.md`.

```js
(() => {
  const REDACT = [
    { name: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { name: "phone", re: /\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}-?\d{4}\b/g },
    { name: "cpf", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
    { name: "cnpj", re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g }
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
`### localStorage snapshot (sanitizado)
\`\`\`json
${JSON.stringify(dump, null, 2)}
\`\`\``;

  console.log(md);

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(md).then(
      () => console.log("✅ Copiado para a área de transferência."),
      () => console.log("⚠️ Não foi possível copiar automaticamente; copie do console.")
    );
  }
})();
```

## Notas de migração/normalização
- Se versões antigas existirem sem `history`, o storage normaliza criando um evento `create` mínimo para suportar relatórios/SLA.
