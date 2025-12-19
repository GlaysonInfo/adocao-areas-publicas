// src/pages/reports/ReportsPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { KanbanColuna } from "../../domain/proposal";
import {
  computeConsolidatedByPeriod,
  computeSemadProductivity,
  listProposals,
  subscribeProposals,
} from "../../storage/proposals";
import { useAuth } from "../../auth/AuthContext";

type TabKey =
  | "consolidado"
  | "protocolos"
  | "em_analise_outros"
  | "ajustes"
  | "termos"
  | "produtividade"
  | "sla";

const COL_LABEL: Record<KanbanColuna, string> = {
  protocolo: "Protocolo",
  analise_semad: "Análise SEMAD",
  analise_ecos: "Análise ECOS",
  ajustes: "Ajustes",
  decisao: "Decisão (Governo)",
  termo_assinado: "Termo Assinado",
  indeferida: "Indeferida",
};

const SLA_TARGET_DAYS: Partial<Record<KanbanColuna, number>> = {
  protocolo: 2,
  analise_semad: 10,
  analise_ecos: 10,
  ajustes: 15,
  decisao: 7,
  // termo_assinado/indeferida são terminais; SLA geralmente não se aplica
};

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateStart(s: string | null) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(s: string | null) {
  if (!s) return null;
  const d = new Date(`${s}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtBR(iso?: string) {
  const d = safeDate(iso);
  if (!d) return "—";
  return d.toLocaleString("pt-BR");
}

function inRange(atIso: string | undefined, fromD: Date | null, toD: Date | null) {
  const d = safeDate(atIso);
  if (!d) return false;
  if (fromD && d < fromD) return false;
  if (toD && d > toD) return false;
  return true;
}

function normEventType(h: any) {
  return String(h?.type ?? h?.action ?? h?.tipo ?? "").trim();
}
function normActor(h: any) {
  return String(h?.actor_role ?? h?.actor ?? h?.autor ?? h?.role ?? "—").trim();
}
function normAt(h: any) {
  return String(h?.at ?? h?.quando ?? h?.timestamp ?? "");
}
function normFrom(h: any) {
  return String(h?.from ?? h?.from_coluna ?? h?.fromColuna ?? "");
}
function normTo(h: any) {
  return String(h?.to ?? h?.to_coluna ?? h?.toColuna ?? "");
}
function normNote(h: any) {
  return String(h?.note ?? h?.motivo ?? h?.mensagem ?? h?.decision_note ?? "");
}
function normDecision(h: any) {
  return String(h?.decision ?? h?.decisao ?? "").trim();
}

function getAdopterContact(p: any) {
  const nome = p?.adotante?.nome ?? p?.adotante_nome ?? p?.adotanteName ?? "—";
  const email = p?.adotante?.email ?? p?.adotante_email ?? p?.adotanteEmail ?? "—";
  const cel = p?.adotante?.celular ?? p?.adotante_celular ?? p?.celular ?? "—";
  const wpp = p?.adotante?.whatsapp ?? p?.adotante_whatsapp ?? p?.whatsapp ?? "—";
  return { nome, email, cel, wpp };
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function lastAdjustmentsInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];

  // preferência: request_adjustments (novo)
  const req = hist
    .filter((h) => normEventType(h) === "request_adjustments" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (req.length > 0) {
    const last = req[req.length - 1];
    return { actor: normActor(last), at: normAt(last), note: normNote(last) };
  }

  // fallback: move -> ajustes (antigo)
  const moves = hist
    .filter((h) => normEventType(h) === "move" && normTo(h) === "ajustes" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (moves.length === 0) return null;

  const last = moves[moves.length - 1];
  return { actor: normActor(last), at: normAt(last), note: normNote(last) };
}

function firstCreateInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];
  const created = hist
    .filter((h) => normEventType(h) === "create" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (created.length === 0) return null;
  return { at: normAt(created[0]), actor: normActor(created[0]) };
}

function lastOtherOrgEntryInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];
  const entries = hist
    .filter((h) => normEventType(h) === "move" && ["analise_ecos", "decisao"].includes(normTo(h)) && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return { at: normAt(last), actor: normActor(last), to: normTo(last) as KanbanColuna };
}

function lastTermSignedInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];

  // prefer: decision approved (novo)
  const dec = hist
    .filter(
      (h) =>
        normEventType(h) === "decision" &&
        (normDecision(h) === "approved" || normDecision(h) === "aprovada" || normDecision(h) === "aprovado") &&
        inRange(normAt(h), fromD, toD)
    )
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (dec.length > 0) {
    const last = dec[dec.length - 1];
    return { at: normAt(last), actor: normActor(last) };
  }

  // fallback: move -> termo_assinado
  const moves = hist
    .filter((h) => normEventType(h) === "move" && normTo(h) === "termo_assinado" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1];
  return { at: normAt(last), actor: normActor(last) };
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(s / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return `${s}s`;
}

function computeSlaDetails(all: any[], fromD: Date | null, toD: Date | null) {
  if (!fromD || !toD) return [];

  const fromMs = fromD.getTime();
  const toMs = toD.getTime();

  const cols = Object.keys(SLA_TARGET_DAYS) as KanbanColuna[];
  const bucket: Record<string, number[]> = {};
  for (const c of cols) bucket[c] = [];

  for (const p of all) {
    const createdAt = safeDate(p?.created_at ?? p?.createdAt)?.getTime();
    if (!createdAt) continue;

    const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];
    const moves = hist
      .filter((h) => normEventType(h) === "move" && normAt(h) && normTo(h))
      .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));

    let curCol: KanbanColuna = "protocolo";
    let curAtMs = Math.max(createdAt, fromMs);

    for (const e of moves) {
      const t = safeDate(normAt(e))?.getTime();
      if (!t) continue;

      const endSeg = Math.min(t, toMs);
      const startSeg = Math.max(curAtMs, fromMs);

      if (endSeg > startSeg && bucket[curCol]) {
        bucket[curCol].push(endSeg - startSeg);
      }

      curCol = normTo(e) as KanbanColuna;
      curAtMs = t;
    }

    // censura no fim do período
    const endSeg = toMs;
    const startSeg = Math.max(curAtMs, fromMs);
    if (endSeg > startSeg && bucket[curCol]) {
      bucket[curCol].push(endSeg - startSeg);
    }
  }

  const pct = (arr: number[], p: number) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
    return sorted[idx];
  };

  return cols.map((col) => {
    const arr = bucket[col] ?? [];
    const targetDays = SLA_TARGET_DAYS[col];
    const targetMs = typeof targetDays === "number" ? targetDays * 24 * 60 * 60 * 1000 : null;
    const viol = targetMs == null ? null : arr.filter((d) => d > targetMs).length;
    const rate = targetMs == null || arr.length === 0 ? null : viol! / arr.length;

    return {
      col,
      n: arr.length,
      p50: pct(arr, 0.5),
      p80: pct(arr, 0.8),
      p95: pct(arr, 0.95),
      targetMs,
      violationRate: rate,
    };
  });
}

export function ReportsPage() {
  const { role } = useAuth();

  const [tab, setTab] = useState<TabKey>("consolidado");

  const today = new Date();
  const thirty = new Date();
  thirty.setDate(today.getDate() - 30);

  const [from, setFrom] = useState<string>(toDateInputValue(thirty));
  const [to, setTo] = useState<string>(toDateInputValue(today));

  // força re-render quando proposals mudam (create/move/decision/etc)
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const fromD = useMemo(() => parseDateStart(from), [from]);
  const toD = useMemo(() => parseDateEnd(to), [to]);

  const fromIso = useMemo(() => (fromD ? fromD.toISOString() : ""), [fromD]);
  const toIso = useMemo(() => (toD ? toD.toISOString() : ""), [toD]);

  const all = useMemo(() => listProposals(), [tick]);

  // ======================
  // EVENT-BASED REPORTS
  // ======================

  const consolidated = useMemo(() => {
    if (!fromIso || !toIso) {
      return {
        protocols_created: 0,
        entered_semad: 0,
        entered_ecos: 0,
        entered_gov: 0,
        adjustments_requested: 0,
        terms_signed: 0,
        rejected: 0,
      };
    }
    return computeConsolidatedByPeriod(fromIso, toIso);
  }, [fromIso, toIso, tick]);

  const semadProd = useMemo(() => {
    if (!fromIso || !toIso) return null;
    return computeSemadProductivity(fromIso, toIso);
  }, [fromIso, toIso, tick]);

  const rowsProtocolos = useMemo(() => {
    if (!fromD || !toD) return [];
    const items = all
      .filter((p) => !!firstCreateInPeriod(p, fromD, toD))
      .sort((a, b) => String(firstCreateInPeriod(a, fromD, toD)?.at ?? "").localeCompare(String(firstCreateInPeriod(b, fromD, toD)?.at ?? "")));
    return items;
  }, [all, fromD, toD]);

  const rowsAjustes = useMemo(() => {
    if (!fromD || !toD) return [];
    const items = all
      .filter((p) => !!lastAdjustmentsInPeriod(p, fromD, toD))
      .sort((a, b) => String(lastAdjustmentsInPeriod(b, fromD, toD)?.at ?? "").localeCompare(String(lastAdjustmentsInPeriod(a, fromD, toD)?.at ?? "")));
    return items;
  }, [all, fromD, toD]);

  const rowsTermos = useMemo(() => {
    if (!fromD || !toD) return [];
    const items = all
      .filter((p) => !!lastTermSignedInPeriod(p, fromD, toD))
      .sort((a, b) => String(lastTermSignedInPeriod(b, fromD, toD)?.at ?? "").localeCompare(String(lastTermSignedInPeriod(a, fromD, toD)?.at ?? "")));
    return items;
  }, [all, fromD, toD]);

  const rowsEmOutros = useMemo(() => {
    if (!fromD || !toD) return [];
    const items = all
      .filter((p) => !!lastOtherOrgEntryInPeriod(p, fromD, toD))
      .sort((a, b) => String(lastOtherOrgEntryInPeriod(b, fromD, toD)?.at ?? "").localeCompare(String(lastOtherOrgEntryInPeriod(a, fromD, toD)?.at ?? "")));
    return items;
  }, [all, fromD, toD]);

  const slaRows = useMemo(() => computeSlaDetails(all, fromD, toD), [all, fromD, toD]);

  // ======================
  // EXPORTS
  // ======================

  const exportConsolidado = () => {
    const headers = [
      "Período (de)",
      "Período (até)",
      "Protocolos criados",
      "Entradas Análise SEMAD",
      "Entradas Análise ECOS",
      "Entradas Decisão (Governo)",
      "Ajustes solicitados",
      "Termos assinados",
      "Indeferidas",
      "Em outros órgãos (ECOS + Governo)",
    ];
    const emOutros = consolidated.entered_ecos + consolidated.entered_gov;
    const rows = [
      [
        from,
        to,
        consolidated.protocols_created,
        consolidated.entered_semad,
        consolidated.entered_ecos,
        consolidated.entered_gov,
        consolidated.adjustments_requested,
        consolidated.terms_signed,
        consolidated.rejected,
        emOutros,
      ],
    ];
    downloadCSV(`relatorio_consolidado_eventos_${from}_a_${to}.csv`, headers, rows);
  };

  const exportList = (filename: string, items: any[], eventName: string, getEventAt: (p: any) => string) => {
    const headers = [
      "Evento",
      "Evento em",
      "Protocolo",
      "Área",
      "Etapa atual",
      "Criado em",
      "Atualizado em",
      "Adotante (nome)",
      "E-mail",
      "Celular",
      "WhatsApp",
      "Último motivo de ajustes (no período)",
    ];
    const rows = items.map((p) => {
      const k = (p?.kanban_coluna ?? p?.kanbanColuna ?? "protocolo") as KanbanColuna;
      const c = getAdopterContact(p);
      const aj = lastAdjustmentsInPeriod(p, fromD, toD);
      return [
        eventName,
        fmtBR(getEventAt(p)),
        p?.codigo_protocolo ?? p?.codigo ?? "—",
        p?.area_nome ?? "—",
        COL_LABEL[k] ?? String(k),
        fmtBR(p?.created_at ?? p?.createdAt),
        fmtBR(p?.updated_at ?? p?.updatedAt),
        c.nome,
        c.email,
        c.cel,
        c.wpp,
        aj?.note ?? "",
      ];
    });
    downloadCSV(filename, headers, rows);
  };

  return (
    <div className="container">
      <div className="card pad">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Relatórios</h2>
            <p style={{ marginTop: 6, opacity: 0.85 }}>
              Perfil: <strong>{role}</strong> · Período baseado em <strong>eventos</strong> (create/move/request_adjustments/decision) · SLA com censura (itens ainda abertos no fim do período).
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn" onClick={exportConsolidado}>
              Exportar consolidado (CSV)
            </button>
          </div>
        </div>

        <hr className="hr" />

        <div className="grid cols-3" style={{ alignItems: "end" }}>
          <label style={{ fontWeight: 800 }}>
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => setTab("consolidado")}>Consolidado</button>
            <button type="button" className="btn" onClick={() => setTab("protocolos")}>Protocolos</button>
            <button type="button" className="btn" onClick={() => setTab("em_analise_outros")}>Em outros órgãos</button>
            <button type="button" className="btn" onClick={() => setTab("ajustes")}>Ajustes</button>
            <button type="button" className="btn" onClick={() => setTab("termos")}>Termos assinados</button>
            <button type="button" className="btn" onClick={() => setTab("produtividade")}>Produtividade (SEMAD)</button>
            <button type="button" className="btn" onClick={() => setTab("sla")}>SLA (Kanban)</button>
          </div>
        </div>

        <hr className="hr" />

        {tab === "consolidado" ? (
          <div className="grid cols-3">
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Consolidado (por eventos)</h3>
              <p style={{ marginTop: 6 }}>
                Período: <strong>{from}</strong> a <strong>{to}</strong>
              </p>

              <p>Protocolos criados: <strong>{consolidated.protocols_created}</strong></p>
              <p>Entradas em Análise SEMAD: <strong>{consolidated.entered_semad}</strong></p>
              <p>Entradas em Análise ECOS: <strong>{consolidated.entered_ecos}</strong></p>
              <p>Entradas em Decisão (Governo): <strong>{consolidated.entered_gov}</strong></p>
              <p>Ajustes solicitados: <strong>{consolidated.adjustments_requested}</strong></p>
              <p>Termos assinados: <strong>{consolidated.terms_signed}</strong></p>
              <p>Indeferidas: <strong>{consolidated.rejected}</strong></p>

              <hr className="hr" />
              <p>Em outros órgãos (ECOS + Governo): <strong>{consolidated.entered_ecos + consolidated.entered_gov}</strong></p>
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Observação</h3>
              <p style={{ marginTop: 6 }}>
                Se algum relatório ainda “parecer Kanban atual”, verifique se as movimentações estão chamando <code>moveProposal(..., actor_role)</code>.
                Sem isso, não existe evidência para o período/SLA.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "protocolos" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Protocolos criados no período</h3>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  exportList(
                    `relatorio_protocolos_eventos_${from}_a_${to}.csv`,
                    rowsProtocolos,
                    "create",
                    (p) => firstCreateInPeriod(p, fromD, toD)?.at ?? ""
                  )
                }
              >
                Exportar (CSV)
              </button>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Protocolo", "Área", "Criado em (evento)", "Contato (e-mail / celular / whatsapp)"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsProtocolos.map((p: any) => {
                    const c = getAdopterContact(p);
                    const ev = firstCreateInPeriod(p, fromD, toD);
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.codigo_protocolo}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.area_nome}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{fmtBR(ev?.at)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {c.email} · {c.cel} · {c.wpp}
                        </td>
                      </tr>
                    );
                  })}
                  {rowsProtocolos.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, opacity: 0.75 }}>
                        Sem itens no período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "em_analise_outros" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Entradas em outros órgãos (ECOS + Governo) no período</h3>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  exportList(
                    `relatorio_em_outros_orgaos_eventos_${from}_a_${to}.csv`,
                    rowsEmOutros,
                    "move->(analise_ecos|decisao)",
                    (p) => lastOtherOrgEntryInPeriod(p, fromD, toD)?.at ?? ""
                  )
                }
              >
                Exportar (CSV)
              </button>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Protocolo", "Área", "Entrada em", "Evento em", "Contato"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsEmOutros.map((p: any) => {
                    const c = getAdopterContact(p);
                    const ev = lastOtherOrgEntryInPeriod(p, fromD, toD);
                    const toCol = (ev?.to ?? "—") as KanbanColuna | "—";
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.codigo_protocolo}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.area_nome}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {toCol === "—" ? "—" : COL_LABEL[toCol]}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{fmtBR(ev?.at)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {c.email} · {c.cel} · {c.wpp}
                        </td>
                      </tr>
                    );
                  })}
                  {rowsEmOutros.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, opacity: 0.75 }}>
                        Sem itens no período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "ajustes" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Ajustes solicitados no período</h3>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  exportList(
                    `relatorio_ajustes_eventos_${from}_a_${to}.csv`,
                    rowsAjustes,
                    "request_adjustments",
                    (p) => lastAdjustmentsInPeriod(p, fromD, toD)?.at ?? ""
                  )
                }
              >
                Exportar (CSV)
              </button>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Protocolo", "Área", "Motivo (último no período)", "Solicitado por", "Evento em", "Contato"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsAjustes.map((p: any) => {
                    const c = getAdopterContact(p);
                    const aj = lastAdjustmentsInPeriod(p, fromD, toD);
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.codigo_protocolo}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.area_nome}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{aj?.note ? aj.note : "—"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{aj?.actor ?? "—"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{fmtBR(aj?.at)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {c.email} · {c.cel} · {c.wpp}
                        </td>
                      </tr>
                    );
                  })}
                  {rowsAjustes.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 12, opacity: 0.75 }}>
                        Sem itens no período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "termos" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Termos assinados no período</h3>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  exportList(
                    `relatorio_termos_assinados_eventos_${from}_a_${to}.csv`,
                    rowsTermos,
                    "decision:approved",
                    (p) => lastTermSignedInPeriod(p, fromD, toD)?.at ?? ""
                  )
                }
              >
                Exportar (CSV)
              </button>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Protocolo", "Área", "Evento em", "Contato"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsTermos.map((p: any) => {
                    const c = getAdopterContact(p);
                    const ev = lastTermSignedInPeriod(p, fromD, toD);
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.codigo_protocolo}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{p.area_nome}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{fmtBR(ev?.at)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {c.email} · {c.cel} · {c.wpp}
                        </td>
                      </tr>
                    );
                  })}
                  {rowsTermos.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, opacity: 0.75 }}>
                        Sem itens no período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "produtividade" ? (
          <div className="grid cols-2">
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Produtividade — SEMAD (por eventos)</h3>

              {!semadProd ? (
                <p style={{ opacity: 0.75 }}>Selecione um período válido.</p>
              ) : (
                <>
                  <p style={{ marginTop: 6 }}>
                    Movimentações executadas (SEMAD): <strong>{semadProd.total_moves}</strong>
                  </p>
                  <p>
                    Ajustes solicitados (SEMAD): <strong>{semadProd.total_adjustments_requested}</strong>
                  </p>
                  <p>
                    Propostas tocadas (SEMAD): <strong>{semadProd.proposals_touched}</strong>
                  </p>

                  <hr className="hr" />

                  <h3 style={{ marginTop: 0 }}>Transições mais frequentes</h3>
                  {semadProd.transitions.length === 0 ? (
                    <p style={{ opacity: 0.75 }}>Sem movimentações registradas no período.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {semadProd.transitions.map((t: any) => (
                        <li key={t.key}>
                          <strong>{t.key}</strong>: {t.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Nota técnica</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Se este painel ainda ficar zerado, o Kanban/ações do gestor provavelmente não estão chamando{" "}
                <code>moveProposal(id, to, actor_role, note?)</code> com <code>actor_role="gestor_semad"</code>.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "sla" ? (
          <div>
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>SLA por etapa (tempo de permanência)</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Métricas calculadas a partir do log de <strong>moves</strong>, com recorte no período e censura no fim do intervalo.
                Metas abaixo são iniciais e podem ser ajustadas.
              </p>

              <div style={{ marginTop: 10, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Coluna", "Amostras (segmentos)", "Meta", "P50", "P80", "P95", "Violação (≥ meta)"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slaRows.map((r: any) => (
                      <tr key={r.col}>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {COL_LABEL[r.col] ?? r.col}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{r.n}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {r.targetMs ? `${SLA_TARGET_DAYS[r.col]}d` : "—"}
                        </td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{formatDuration(r.p50)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{formatDuration(r.p80)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>{formatDuration(r.p95)}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                          {r.violationRate == null ? "—" : `${Math.round(r.violationRate * 100)}%`}
                        </td>
                      </tr>
                    ))}
                    {slaRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 12, opacity: 0.75 }}>
                          Selecione um período válido.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <p style={{ marginTop: 12, opacity: 0.85 }}>
                Para um SLA “oficial”, as metas devem ser definidas por norma interna (dias úteis vs corridos) e a violação pode ser separada em:
                (i) segmentos encerrados no período; (ii) itens censurados (ainda abertos).
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}