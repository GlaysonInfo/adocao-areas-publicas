// src/pages/admin/AdminAreasImportPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AreaStatus } from "../../domain/area";
import { importAreasFromCSV, listAreas, type ImportReport } from "../../storage/areas";

type ParseResult = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

type PreviewRow = {
  rowNumber: number; // linha real do CSV (começa em 2)
  action: "criar" | "atualizar" | "pular";
  errors: string[];
  values: Record<string, string>;
};

function stripAccents(s: string) {
  try {
    // @ts-expect-error unicode property escapes ok em ambiente moderno
    return String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  } catch {
    return String(s);
  }
}

function normalizeKey(s: string) {
  return stripAccents(String(s ?? ""))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseNumberBR(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(raw: string): AreaStatus | null {
  const s = stripAccents(String(raw ?? ""))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (s === "disponivel" || s === "disponivel_para_adocao") return "disponivel";
  if (s === "em_adocao" || s === "em_adoção" || s === "em_adoacao") return "em_adocao";
  if (s === "adotada" || s === "adotado") return "adotada";

  return null;
}

function parseBool(raw: string | undefined, fallback: boolean) {
  if (raw == null) return fallback;
  const s = stripAccents(String(raw)).toLowerCase().trim();
  if (["1", "true", "sim", "s", "ativo", "ativa", "yes", "y"].includes(s)) return true;
  if (["0", "false", "nao", "não", "n", "inativo", "inativa", "no"].includes(s)) return false;
  return fallback;
}

function guessDelimiter(headerLine: string) {
  const semicol = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semicol >= comma ? ";" : ",";
}

/** Parser simples com suporte a aspas ("") */
function parseCSV(text: string): ParseResult {
  const cleaned = text.replace(/^\uFEFF/, ""); // remove BOM
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], delimiter: ";" };

  const delim = guessDelimiter(lines[0]);

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delim) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur.trim());
    return out;
  };

  const headersRaw = parseLine(lines[0]);
  const headers = headersRaw.map(normalizeKey);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows, delimiter: delim };
}

function buildTemplateCSV() {
  // mínimo + recomendados
  const headers = [
    "codigo",
    "nome",
    "tipo",
    "bairro",
    "logradouro",
    "metragem_m2",
    "status",
    "restricoes",
    "ativo",
    "latitude_centro",
    "longitude_centro",
  ];
  const sample = [
    [
      "BETIM-AREA-0001",
      "Praça da Matriz",
      "Praça",
      "Centro",
      "Av. Principal, s/n",
      "850",
      "disponivel",
      "Não permite estruturas permanentes.",
      "sim",
      "-19,965",
      "-44,199",
    ],
    [
      "BETIM-AREA-0002",
      "Canteiro Av. das Palmeiras",
      "Canteiro",
      "Jardim",
      "Av. das Palmeiras, 1200",
      "420",
      "em_adocao",
      "Manter visibilidade de sinalização viária.",
      "sim",
      "",
      "",
    ],
  ];

  const sep = ";";
  const esc = (v: string) => {
    const s = String(v ?? "");
    // aspas se tiver separador/aspas/quebra de linha
    if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(sep), ...sample.map((r) => r.map(esc).join(sep))];
  return lines.join("\n");
}

export function AdminAreasImportPage() {
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => (csvText ? parseCSV(csvText) : null), [csvText]);
  const existingCodes = useMemo(() => new Set(listAreas().map((a) => a.codigo)), []);

  const requiredHeaders = ["codigo", "nome", "tipo", "bairro", "logradouro", "metragem_m2", "status"];

  const headerErrors = useMemo(() => {
    if (!parsed) return [];
    const missing = requiredHeaders.filter((h) => !parsed.headers.includes(h));
    return missing.map((h) => `Cabeçalho obrigatório ausente: "${h}".`);
  }, [parsed]);

  const preview = useMemo(() => {
    if (!parsed) return { rows: [] as PreviewRow[], counts: { criar: 0, atualizar: 0, pular: 0 } };

    const idx = (name: string) => parsed.headers.indexOf(name);

    const rows: PreviewRow[] = [];
    let criar = 0;
    let atualizar = 0;
    let pular = 0;

    for (let r = 0; r < parsed.rows.length; r++) {
      const rowNum = r + 2;
      const row = parsed.rows[r];

      const values: Record<string, string> = {};
      for (let c = 0; c < parsed.headers.length; c++) {
        const key = parsed.headers[c];
        values[key] = String(row[c] ?? "").trim();
      }

      const errors: string[] = [];

      const codigo = String(row[idx("codigo")] ?? "").trim();
      const nome = String(row[idx("nome")] ?? "").trim();
      const tipo = String(row[idx("tipo")] ?? "").trim();
      const bairro = String(row[idx("bairro")] ?? "").trim();
      const logradouro = String(row[idx("logradouro")] ?? "").trim();

      const metr = parseNumberBR(String(row[idx("metragem_m2")] ?? ""));
      const st = normalizeStatus(String(row[idx("status")] ?? ""));

      if (!codigo) errors.push("Sem 'codigo' (chave de upsert).");
      if (!nome) errors.push("Sem 'nome'.");
      if (!tipo) errors.push("Sem 'tipo'.");
      if (!bairro) errors.push("Sem 'bairro'.");
      if (!logradouro) errors.push("Sem 'logradouro'.");
      if (metr == null) errors.push("metragem_m2 inválida (use número; aceita vírgula).");
      if (!st) errors.push('status inválido (use: "disponivel" | "em_adocao" | "adotada").');

      // campos opcionais
      if (values.latitude_centro) {
        const lat = parseNumberBR(values.latitude_centro);
        if (lat == null) errors.push("latitude_centro inválida.");
      }
      if (values.longitude_centro) {
        const lon = parseNumberBR(values.longitude_centro);
        if (lon == null) errors.push("longitude_centro inválida.");
      }

      if (values.ativo) {
        // só valida “se parece boolean”
        parseBool(values.ativo, true); // não gera erro, mas “normaliza”
      }

      let action: PreviewRow["action"] = "pular";
      if (errors.length > 0 || !codigo) {
        action = "pular";
      } else if (existingCodes.has(codigo)) {
        action = "atualizar";
      } else {
        action = "criar";
      }

      if (action === "criar") criar++;
      else if (action === "atualizar") atualizar++;
      else pular++;

      rows.push({ rowNumber: rowNum, action, errors, values });
    }

    return { rows, counts: { criar, atualizar, pular } };
  }, [parsed, existingCodes]);

  const canApply = !!csvText && headerErrors.length === 0;

  const onPickFile = (file: File | null) => {
    setReport(null);
    setCsvText("");
    setFileName("");

    if (!file) return;

    setFileName(`${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`);

    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
    };
    reader.readAsText(file, "utf-8");
  };

  const downloadTemplate = () => {
    const content = buildTemplateCSV();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_areas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const applyImport = async () => {
    if (!canApply || !csvText) return;

    const hasAnyValid = preview.rows.some((r) => r.action === "criar" || r.action === "atualizar");
    if (!hasAnyValid) {
      alert("Não há linhas válidas para aplicar (todas estão como 'Pular'). Ajuste o CSV e tente novamente.");
      return;
    }

    const ok = confirm(
      `Aplicar importação?\n\nCriar: ${preview.counts.criar}\nAtualizar: ${preview.counts.atualizar}\nPular: ${preview.counts.pular}\n\nIsso atualizará o armazenamento local (MVP).`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const rep = importAreasFromCSV(csvText);
      setReport(rep);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="card pad">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Admin · Importar Áreas (CSV)</h2>
            <p style={{ marginTop: 6 }}>
              Faça upload do CSV, valide no preview e aplique para criar/atualizar áreas (chave: <strong>codigo</strong>).
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={downloadTemplate}>
              Baixar modelo CSV
            </button>
            <Link className="btn" to="/admin/areas">
              Voltar
            </Link>
          </div>
        </div>

        <hr className="hr" />

        <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <strong>Arquivo CSV</strong>
              <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => onPickFile(e.target.files?.item(0) ?? null)}
                />
                {fileName ? <span style={{ opacity: 0.85 }}>{fileName}</span> : null}
              </div>
            </div>

            <div style={{ opacity: 0.85, lineHeight: 1.5 }}>
              <div>
                <strong>Obrigatórios:</strong> {requiredHeaders.join(", ")}
              </div>
              <div>
                <strong>Status aceitos:</strong> disponivel | em_adocao | adotada
              </div>
              <div>
                <strong>Opcional:</strong> restricoes, ativo (sim/não), latitude_centro, longitude_centro
              </div>
            </div>
          </div>
        </div>

        {parsed ? (
          <>
            <div style={{ marginTop: 14 }}>
              <strong>Detectado:</strong> delimitador <code>{parsed.delimiter}</code> · colunas{" "}
              <strong>{parsed.headers.length}</strong> · linhas <strong>{parsed.rows.length}</strong>
            </div>

            {headerErrors.length > 0 ? (
              <div className="card pad" style={{ marginTop: 12, background: "rgba(255,255,255,.72)" }}>
                <h3 style={{ marginTop: 0 }}>Problemas no cabeçalho</h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {headerErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="card pad" style={{ marginTop: 12, background: "rgba(255,255,255,.72)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ marginTop: 0 }}>Preview (validação)</h3>
                    <p style={{ marginTop: 6 }}>
                      Ações previstas: <strong>Criar</strong> ({preview.counts.criar}) ·{" "}
                      <strong>Atualizar</strong> ({preview.counts.atualizar}) · <strong>Pular</strong> ({preview.counts.pular})
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!canApply || busy}
                      onClick={applyImport}
                      title={!canApply ? "Corrija o cabeçalho antes de aplicar." : "Aplicar importação"}
                    >
                      {busy ? "Aplicando..." : "Aplicar importação"}
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: "auto", marginTop: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                    <thead>
                      <tr>
                        {["Linha", "Ação", "Código", "Nome", "Tipo", "Bairro", "Logradouro", "Metragem", "Status", "Ativo", "Erros"].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: "10px 10px",
                                borderBottom: "1px solid var(--border)",
                                fontSize: 13,
                              }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 25).map((r) => {
                        const v = r.values;
                        const actionLabel =
                          r.action === "criar" ? "Criar" : r.action === "atualizar" ? "Atualizar" : "Pular";

                        return (
                          <tr key={r.rowNumber} style={{ verticalAlign: "top" }}>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {r.rowNumber}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              <strong>{actionLabel}</strong>
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.codigo || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.nome || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.tipo || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.bairro || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.logradouro || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.metragem_m2 || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.status || <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {v.ativo ? String(parseBool(v.ativo, true) ? "Sim" : "Não") : <span style={{ opacity: 0.6 }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                              {r.errors.length === 0 ? (
                                <span style={{ opacity: 0.75 }}>OK</span>
                              ) : (
                                <ul style={{ margin: 0, paddingLeft: 16 }}>
                                  {r.errors.slice(0, 3).map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                  {r.errors.length > 3 ? <li>+{r.errors.length - 3}…</li> : null}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {preview.rows.length > 25 ? (
                    <div style={{ marginTop: 10, opacity: 0.8 }}>
                      Mostrando 25 de {preview.rows.length} linhas no preview.
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {report ? (
              <div className="card pad" style={{ marginTop: 12, background: "rgba(255,255,255,.72)" }}>
                <h3 style={{ marginTop: 0 }}>Relatório final</h3>
                <p style={{ marginTop: 6 }}>
                  <strong>Criadas:</strong> {report.created} · <strong>Atualizadas:</strong> {report.updated} ·{" "}
                  <strong>Puladas:</strong> {report.skipped}
                </p>

                {report.errors.length > 0 ? (
                  <>
                    <div style={{ marginTop: 10, fontWeight: 800 }}>Erros / avisos</div>
                    <div style={{ overflowX: "auto", marginTop: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                              Linha
                            </th>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                              Mensagem
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.errors.slice(0, 50).map((e, i) => (
                            <tr key={i}>
                              <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{e.row}</td>
                              <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {report.errors.length > 50 ? (
                      <div style={{ marginTop: 8, opacity: 0.8 }}>
                        Mostrando 50 de {report.errors.length} mensagens.
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p style={{ marginTop: 10, opacity: 0.85 }}>Importação concluída sem erros.</p>
                )}

                <div style={{ marginTop: 12 }}>
                  <Link className="btn btn--primary" to="/admin/areas">
                    Voltar para Admin · Áreas
                  </Link>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}