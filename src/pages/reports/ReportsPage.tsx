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

// ✅ Solicitações de área
import { listAreaRequests, subscribeAreaRequests } from "../../storage/area_requests";

// ✅ Vistorias
import { listVistorias, subscribeVistorias } from "../../storage/vistorias";

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

// ----------------------
// Helpers Kanban (proposals)
// ----------------------
function normEventType(h: any) {
  return String(h?.type ?? h?.action ?? h?.tipo ?? "").trim();
}
function normActor(h: any) {
  return String(h?.actor_role ?? h?.actor ?? h?.autor ?? h?.role ?? "—").trim();
}
function normAt(h: any) {
  return String(h?.at ?? h?.quando ?? h?.timestamp ?? "");
}
function normTo(h: any) {
  return String(h?.to ?? h?.to_coluna ?? h?.toColuna ?? "");
}
function normDecision(h: any) {
  return String(h?.decision ?? h?.decisao ?? "").trim();
}
function normNote(h: any) {
  return String(h?.note ?? h?.motivo ?? h?.mensagem ?? h?.decision_note ?? "");
}

function getAdopterContact(p: any) {
  const nome = p?.adotante?.nome ?? p?.adotante_nome ?? p?.adotanteName ?? "—";
  const email = p?.adotante?.email ?? p?.adotante_email ?? p?.adotanteEmail ?? "—";
  const cel = p?.adotante?.celular ?? p?.adotante_celular ?? p?.celular ?? "—";
  const wpp = p?.adotante?.whatsapp ?? p?.adotante_whatsapp ?? p?.whatsapp ?? "—";
  return { nome, email, cel, wpp };
}

function firstCreateInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];
  const created = hist
    .filter((h) => normEventType(h) === "create" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (created.length === 0) return null;
  return { at: normAt(created[0]), actor: normActor(created[0]) };
}

function lastAdjustmentsInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];

  const req = hist
    .filter((h) => normEventType(h) === "request_adjustments" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (req.length > 0) {
    const last = req[req.length - 1];
    return { actor: normActor(last), at: normAt(last), note: normNote(last) };
  }

  const moves = hist
    .filter((h) => normEventType(h) === "move" && normTo(h) === "ajustes" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (moves.length === 0) return null;

  const last = moves[moves.length - 1];
  return { actor: normActor(last), at: normAt(last), note: normNote(last) };
}

function lastOtherOrgEntryInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];
  const entries = hist
    .filter(
      (h) =>
        normEventType(h) === "move" &&
        ["analise_ecos", "decisao"].includes(normTo(h)) &&
        inRange(normAt(h), fromD, toD)
    )
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return { at: normAt(last), actor: normActor(last), to: normTo(last) as KanbanColuna };
}

function lastTermSignedInPeriod(p: any, fromD: Date | null, toD: Date | null) {
  const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];

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

  const moves = hist
    .filter((h) => normEventType(h) === "move" && normTo(h) === "termo_assinado" && inRange(normAt(h), fromD, toD))
    .sort((a, b) => String(normAt(a)).localeCompare(String(normAt(b))));
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1];
  return { at: normAt(last), actor: normActor(last) };
}

// ----------------------
// Overrides sem vistoria (event-log em proposals)
// ----------------------
type OverrideRow = {
  proposal_id: string;
  codigo_protocolo: string;
  at: string;
  actor_role: string;
  gate_from: string;
  gate_to: string;
  note: string;
};

function extractOverrideRows(proposals: any[], fromD: Date | null, toD: Date | null): OverrideRow[] {
  const rows: OverrideRow[] = [];

  for (const p of proposals) {
    const hist: any[] = (p?.history ?? p?.historico ?? []) as any[];
    for (const ev of hist) {
      if (normEventType(ev) !== "override_no_vistoria") continue;
      const at = normAt(ev);
      if (!inRange(at, fromD, toD)) continue;

      // tolera:
      // - meta.gate_from / meta.gate_to (recomendado)
      // - gate_from / gate_to (alternativo)
      // - from / to (fallback)
      const gate_from =
        String(ev?.meta?.gate_from ?? ev?.gate_from ?? ev?.from ?? "").trim() || "—";
      const gate_to =
        String(ev?.meta?.gate_to ?? ev?.gate_to ?? ev?.to ?? "").trim() || "—";

      rows.push({
        proposal_id: String(p?.id ?? ""),
        codigo_protocolo: String(p?.codigo_protocolo ?? p?.codigo ?? "—"),
        at,
        actor_role: normActor(ev),
        gate_from,
        gate_to,
        note: normNote(ev),
      });
    }
  }

  rows.sort((a, b) => String(b.at).localeCompare(String(a.at))); // mais recentes primeiro
  return rows;
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
      if (endSeg > startSeg && bucket[curCol]) bucket[curCol].push(endSeg - startSeg);

      curCol = normTo(e) as KanbanColuna;
      curAtMs = t;
    }

    const endSeg = toMs;
    const startSeg = Math.max(curAtMs, fromMs);
    if (endSeg > startSeg && bucket[curCol]) bucket[curCol].push(endSeg - startSeg);
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
    const rate = targetMs == null || arr.length === 0 ? null : (viol as number) / arr.length;

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

// ----------------------
// Consolidado: Solicitações de Área (event-log)
// ----------------------
function normalizeDecisionValue(v: any) {
  const s = String(v ?? "").toLowerCase().trim();
  if (["approved", "aprovado", "aprovada", "deferido", "deferida"].includes(s)) return "approved";
  if (["rejected", "rejeitado", "rejeitada", "indeferido", "indeferida"].includes(s)) return "rejected";
  return null;
}

function getReqEvents(req: any): any[] {
  const hist = req?.history ?? req?.events ?? req?.historico ?? [];
  return Array.isArray(hist) ? hist : [];
}

function reqEventType(ev: any) {
  return String(ev?.type ?? ev?.action ?? ev?.tipo ?? "").trim();
}

function reqEventAt(ev: any) {
  return String(ev?.at ?? ev?.quando ?? ev?.timestamp ?? ev?.created_at ?? "");
}

function computeAreaRequestsConsolidated(requests: any[], fromD: Date | null, toD: Date | null) {
  const created = requests.filter((r) => inRange(String(r?.created_at ?? r?.createdAt), fromD, toD)).length;

  let start_verification = 0;
  let sisgeo_update = 0;
  let decisions = 0;
  let approved = 0;
  let rejected = 0;

  const sisgeoDur: number[] = [];
  const responseDur: number[] = [];

  for (const r of requests) {
    const evs = getReqEvents(r).slice().sort((a, b) => String(reqEventAt(a)).localeCompare(String(reqEventAt(b))));
    const evsIn = evs.filter((e) => inRange(reqEventAt(e), fromD, toD));

    start_verification += evsIn.filter((e) => reqEventType(e) === "start_verification").length;
    sisgeo_update += evsIn.filter((e) => reqEventType(e) === "sisgeo_update").length;

    const decs = evsIn.filter((e) => reqEventType(e) === "decision");
    decisions += decs.length;

    for (const d of decs) {
      const dv = normalizeDecisionValue(d?.decision ?? d?.result ?? d?.resultado);
      if (dv === "approved") approved++;
      if (dv === "rejected") rejected++;
    }

    const startEv = evs.find((e) => reqEventType(e) === "start_verification" && inRange(reqEventAt(e), fromD, toD));
    const sisEv = evs.find((e) => reqEventType(e) === "sisgeo_update" && inRange(reqEventAt(e), fromD, toD));

    const startMs = safeDate(startEv ? reqEventAt(startEv) : "")?.getTime();
    const sisMs = safeDate(sisEv ? reqEventAt(sisEv) : "")?.getTime();
    if (startMs != null && sisMs != null && Number.isFinite(startMs) && Number.isFinite(sisMs) && sisMs >= startMs) {
      sisgeoDur.push(sisMs - startMs);
    }

    const createdMs = safeDate(String(r?.created_at ?? r?.createdAt ?? ""))?.getTime();
    const decEv = evs.find((e) => reqEventType(e) === "decision" && inRange(reqEventAt(e), fromD, toD));
    const decMs = safeDate(decEv ? reqEventAt(decEv) : "")?.getTime();

    if (createdMs != null && decMs != null && Number.isFinite(createdMs) && Number.isFinite(decMs) && decMs >= createdMs) {
      responseDur.push(decMs - createdMs);
    }
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  return {
    created,
    start_verification,
    sisgeo_update,
    decisions,
    approved,
    rejected,
    avg_sisgeo_ms: avg(sisgeoDur),
    n_sisgeo: sisgeoDur.length,
    avg_response_ms: avg(responseDur),
    n_response: responseDur.length,
  };
}

// ----------------------
// Consolidado: Vistorias (event-log)
// ----------------------
function vistEvents(v: any): any[] {
  const hist = v?.history ?? v?.events ?? v?.historico ?? [];
  return Array.isArray(hist) ? hist : [];
}
function vistType(ev: any) {
  return String(ev?.type ?? ev?.action ?? ev?.tipo ?? "").trim();
}
function vistAt(ev: any) {
  return String(ev?.at ?? ev?.quando ?? ev?.timestamp ?? ev?.created_at ?? "");
}
function vistTo(ev: any) {
  return String(ev?.to ?? ev?.status_to ?? ev?.status ?? "").trim();
}

function computeVistoriasConsolidated(vistorias: any[], fromD: Date | null, toD: Date | null) {
  const created = vistorias.filter((v) => inRange(String(v?.created_at ?? v?.createdAt), fromD, toD)).length;

  let status_changes = 0;
  let laudos_emitidos = 0;

  const durAgendadaRealizada: number[] = [];
  const durRealizadaLaudo: number[] = [];

  for (const v of vistorias) {
    const evs = vistEvents(v).slice().sort((a, b) => String(vistAt(a)).localeCompare(String(vistAt(b))));
    const evsIn = evs.filter((e) => inRange(vistAt(e), fromD, toD));

    status_changes += evsIn.filter((e) => vistType(e) === "status_change").length;
    laudos_emitidos += evsIn.filter((e) => vistType(e) === "emit_laudo").length;

    const agendadaMs = safeDate(String(v?.agendada_para ?? ""))?.getTime();
    const realizadaEv = evs.find(
      (e) => vistType(e) === "status_change" && (e?.to === "realizada" || vistTo(e) === "realizada")
    );
    const realizadaMs = safeDate(realizadaEv ? vistAt(realizadaEv) : "")?.getTime();

    if (agendadaMs != null && realizadaMs != null && Number.isFinite(agendadaMs) && Number.isFinite(realizadaMs) && realizadaMs >= agendadaMs) {
      const rIso = realizadaEv ? vistAt(realizadaEv) : "";
      if (inRange(rIso, fromD, toD)) durAgendadaRealizada.push(realizadaMs - agendadaMs);
    }

    const laudoEv =
      evs.find((e) => vistType(e) === "emit_laudo") ||
      evs.find((e) => vistType(e) === "status_change" && (e?.to === "laudo_emitido" || vistTo(e) === "laudo_emitido"));

    const laudoMs = safeDate(laudoEv ? vistAt(laudoEv) : "")?.getTime();

    if (realizadaMs != null && laudoMs != null && Number.isFinite(realizadaMs) && Number.isFinite(laudoMs) && laudoMs >= realizadaMs) {
      const lIso = laudoEv ? vistAt(laudoEv) : "";
      if (inRange(lIso, fromD, toD)) durRealizadaLaudo.push(laudoMs - realizadaMs);
    }
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  return {
    created,
    status_changes,
    laudos_emitidos,
    avg_agendada_realizada_ms: avg(durAgendadaRealizada),
    n_agendada_realizada: durAgendadaRealizada.length,
    avg_realizada_laudo_ms: avg(durRealizadaLaudo),
    n_realizada_laudo: durRealizadaLaudo.length,
  };
}

export function ReportsPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<TabKey>("consolidado");

  const today = new Date();
  const thirty = new Date();
  thirty.setDate(today.getDate() - 30);

  const [from, setFrom] = useState<string>(toDateInputValue(thirty));
  const [to, setTo] = useState<string>(toDateInputValue(today));

  // ticks (event-driven)
  const [tickP, setTickP] = useState(0);
  const [tickR, setTickR] = useState(0);
  const [tickV, setTickV] = useState(0);

  useEffect(() => subscribeProposals(() => setTickP((t) => t + 1)), []);
  useEffect(() => subscribeAreaRequests(() => setTickR((t) => t + 1)), []);
  useEffect(() => subscribeVistorias(() => setTickV((t) => t + 1)), []);

  const fromD = useMemo(() => parseDateStart(from), [from]);
  const toD = useMemo(() => parseDateEnd(to), [to]);

  const fromIso = useMemo(() => (fromD ? fromD.toISOString() : ""), [fromD]);
  const toIso = useMemo(() => (toD ? toD.toISOString() : ""), [toD]);

  const proposals = useMemo(() => listProposals(), [tickP]);
  const areaRequests = useMemo(() => listAreaRequests(), [tickR]);
  const vistorias = useMemo(() => listVistorias(), [tickV]);

  // ===== Propostas (Kanban) =====
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
  }, [fromIso, toIso, tickP]);

  const semadProd = useMemo(() => {
    if (!fromIso || !toIso) return null;
    return computeSemadProductivity(fromIso, toIso);
  }, [fromIso, toIso, tickP]);

  // ===== Overrides (event-log) =====
  const overridesAll = useMemo(() => extractOverrideRows(proposals, fromD, toD), [proposals, fromD, toD]);
  const qtd_overrides_sem_vistoria = overridesAll.length;
  const qtd_overrides_sem_vistoria_semad = overridesAll.filter((o) => o.actor_role === "gestor_semad").length;
  const lastOverrides = overridesAll.slice(0, 8);

  const rowsProtocolos = useMemo(() => {
    if (!fromD || !toD) return [];
    return proposals
      .filter((p) => !!firstCreateInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(firstCreateInPeriod(a, fromD, toD)?.at ?? "").localeCompare(
          String(firstCreateInPeriod(b, fromD, toD)?.at ?? "")
        )
      );
  }, [proposals, fromD, toD]);

  const rowsAjustes = useMemo(() => {
    if (!fromD || !toD) return [];
    return proposals
      .filter((p) => !!lastAdjustmentsInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(lastAdjustmentsInPeriod(b, fromD, toD)?.at ?? "").localeCompare(
          String(lastAdjustmentsInPeriod(a, fromD, toD)?.at ?? "")
        )
      );
  }, [proposals, fromD, toD]);

  const rowsTermos = useMemo(() => {
    if (!fromD || !toD) return [];
    return proposals
      .filter((p) => !!lastTermSignedInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(lastTermSignedInPeriod(b, fromD, toD)?.at ?? "").localeCompare(
          String(lastTermSignedInPeriod(a, fromD, toD)?.at ?? "")
        )
      );
  }, [proposals, fromD, toD]);

  const rowsEmOutros = useMemo(() => {
    if (!fromD || !toD) return [];
    return proposals
      .filter((p) => !!lastOtherOrgEntryInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(lastOtherOrgEntryInPeriod(b, fromD, toD)?.at ?? "").localeCompare(
          String(lastOtherOrgEntryInPeriod(a, fromD, toD)?.at ?? "")
        )
      );
  }, [proposals, fromD, toD]);

  const slaRows = useMemo(() => computeSlaDetails(proposals, fromD, toD), [proposals, fromD, toD]);

  // ===== Solicitações de área =====
  const consolidatedReq = useMemo(
    () => computeAreaRequestsConsolidated(areaRequests, fromD, toD),
    [areaRequests, fromD, toD]
  );

  // ===== Vistorias =====
  const consolidatedV = useMemo(
    () => computeVistoriasConsolidated(vistorias, fromD, toD),
    [vistorias, fromD, toD]
  );

  // ===== EXPORTS =====
  const exportConsolidado = () => {
    const headers = [
      "Período (de)",
      "Período (até)",

      // Propostas
      "Protocolos criados",
      "Entradas Análise SEMAD",
      "Entradas Análise ECOS",
      "Entradas Decisão (Governo)",
      "Ajustes solicitados",
      "Termos assinados",
      "Indeferidas",

      // Exceções
      "Overrides sem vistoria (total)",
      "Overrides sem vistoria (SEMAD)",

      // Solicitações
      "Solicitações criadas",
      "Início verificação (start_verification)",
      "Atualizações SisGeo (sisgeo_update)",
      "Decisões (solicitação)",
      "Solicitações deferidas",
      "Solicitações indeferidas",
      "Tempo médio verificação SisGeo (ms)",
      "n_verificação_sisgeo",
      "Tempo médio resposta solicitação (ms)",
      "n_resposta_solicitação",

      // Vistorias
      "Vistorias criadas",
      "Status changes (vistorias)",
      "Laudos emitidos",
      "Tempo médio agendada→realizada (ms)",
      "n_agendada→realizada",
      "Tempo médio realizada→laudo (ms)",
      "n_realizada→laudo",
    ];

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

        qtd_overrides_sem_vistoria,
        qtd_overrides_sem_vistoria_semad,

        consolidatedReq.created,
        consolidatedReq.start_verification,
        consolidatedReq.sisgeo_update,
        consolidatedReq.decisions,
        consolidatedReq.approved,
        consolidatedReq.rejected,
        consolidatedReq.avg_sisgeo_ms ?? "",
        consolidatedReq.n_sisgeo,
        consolidatedReq.avg_response_ms ?? "",
        consolidatedReq.n_response,

        consolidatedV.created,
        consolidatedV.status_changes,
        consolidatedV.laudos_emitidos,
        consolidatedV.avg_agendada_realizada_ms ?? "",
        consolidatedV.n_agendada_realizada,
        consolidatedV.avg_realizada_laudo_ms ?? "",
        consolidatedV.n_realizada_laudo,
      ],
    ];

    downloadCSV(`relatorio_consolidado_${from}_a_${to}.csv`, headers, rows);
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
              Perfil: <strong>{role}</strong> · Período baseado em <strong>eventos</strong> (localStorage) · SLA com censura.
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
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            />
          </label>

          <label style={{ fontWeight: 800 }}>
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => setTab("consolidado")}>
              Consolidado
            </button>
            <button type="button" className="btn" onClick={() => setTab("protocolos")}>
              Protocolos
            </button>
            <button type="button" className="btn" onClick={() => setTab("em_analise_outros")}>
              Em outros órgãos
            </button>
            <button type="button" className="btn" onClick={() => setTab("ajustes")}>
              Ajustes
            </button>
            <button type="button" className="btn" onClick={() => setTab("termos")}>
              Termos assinados
            </button>
            <button type="button" className="btn" onClick={() => setTab("produtividade")}>
              Produtividade (SEMAD)
            </button>
            <button type="button" className="btn" onClick={() => setTab("sla")}>
              SLA (Kanban)
            </button>
          </div>
        </div>

        <hr className="hr" />

        {/* CONSOLIDADO */}
        {tab === "consolidado" ? (
          <div className="grid cols-2">
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Consolidado — Propostas (Kanban)</h3>
              <p style={{ marginTop: 6 }}>
                Período: <strong>{from}</strong> a <strong>{to}</strong>
              </p>

              <p>
                Protocolos criados: <strong>{consolidated.protocols_created}</strong>
              </p>
              <p>
                Entradas em Análise SEMAD: <strong>{consolidated.entered_semad}</strong>
              </p>
              <p>
                Entradas em Análise ECOS: <strong>{consolidated.entered_ecos}</strong>
              </p>
              <p>
                Entradas em Decisão (Governo): <strong>{consolidated.entered_gov}</strong>
              </p>
              <p>
                Ajustes solicitados: <strong>{consolidated.adjustments_requested}</strong>
              </p>
              <p>
                Termos assinados: <strong>{consolidated.terms_signed}</strong>
              </p>
              <p>
                Indeferidas: <strong>{consolidated.rejected}</strong>
              </p>

              <hr className="hr" />
              <p>
                Em outros órgãos (ECOS + Governo):{" "}
                <strong>{consolidated.entered_ecos + consolidated.entered_gov}</strong>
              </p>
            </div>

            {/* ✅ Mantém: Solicitações de área */}
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Consolidado — Solicitações de área</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Fonte: event-log (history/events) em localStorage
              </p>

              <p>
                Solicitações criadas: <strong>{consolidatedReq.created}</strong>
              </p>
              <p>
                Início verificação (start_verification): <strong>{consolidatedReq.start_verification}</strong>
              </p>
              <p>
                Atualizações SisGeo (sisgeo_update): <strong>{consolidatedReq.sisgeo_update}</strong>
              </p>
              <p>
                Decisões (decision): <strong>{consolidatedReq.decisions}</strong>
              </p>
              <p>
                Deferidas: <strong>{consolidatedReq.approved}</strong>
              </p>
              <p>
                Indeferidas: <strong>{consolidatedReq.rejected}</strong>
              </p>

              <hr className="hr" />
              <p>
                Tempo médio verificação SisGeo: <strong>{formatDuration(consolidatedReq.avg_sisgeo_ms)}</strong>{" "}
                <span className="muted">(n={consolidatedReq.n_sisgeo})</span>
              </p>
              <p>
                Tempo médio resposta solicitação: <strong>{formatDuration(consolidatedReq.avg_response_ms)}</strong>{" "}
                <span className="muted">(n={consolidatedReq.n_response})</span>
              </p>
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Consolidado — Vistorias</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Fonte: event-log (history/events) em localStorage
              </p>

              <p>
                Vistorias criadas: <strong>{consolidatedV.created}</strong>
              </p>
              <p>
                Status changes: <strong>{consolidatedV.status_changes}</strong>
              </p>
              <p>
                Laudos emitidos: <strong>{consolidatedV.laudos_emitidos}</strong>
              </p>

              <hr className="hr" />
              <p>
                Tempo médio agendada → realizada: <strong>{formatDuration(consolidatedV.avg_agendada_realizada_ms)}</strong>{" "}
                <span className="muted">(n={consolidatedV.n_agendada_realizada})</span>
              </p>
              <p>
                Tempo médio realizada → laudo: <strong>{formatDuration(consolidatedV.avg_realizada_laudo_ms)}</strong>{" "}
                <span className="muted">(n={consolidatedV.n_realizada_laudo})</span>
              </p>
            </div>

            {/* ✅ NOVO: Exceções / Governança */}
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Exceções / Governança</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Fonte: event-log de <code>mvp_proposals_v1</code> (history[]).
              </p>

              <p>
                Overrides sem vistoria (total): <strong>{qtd_overrides_sem_vistoria}</strong>
              </p>
              <p>
                Overrides sem vistoria (SEMAD): <strong>{qtd_overrides_sem_vistoria_semad}</strong>
              </p>

              <hr className="hr" />

              {lastOverrides.length === 0 ? (
                <div className="muted">Nenhum override no período.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Protocolo", "Gate", "Data", "Motivo"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: 10,
                              borderBottom: "1px solid var(--border)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lastOverrides.map((o) => (
                        <tr key={`${o.proposal_id}_${o.at}`}>
                          <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                            {o.codigo_protocolo}
                          </td>
                          <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                            {o.gate_from} → {o.gate_to}
                          </td>
                          <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)" }}>
                            {fmtBR(o.at)}
                          </td>
                          <td style={{ padding: 10, borderBottom: "1px solid rgba(15,23,42,.08)", whiteSpace: "pre-wrap" }}>
                            {o.note?.trim() ? o.note : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Observação</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Se algum painel ficar zerado:
                <br />• Kanban depende de <code>moveProposal(..., actor_role)</code>.
                <br />• Overrides dependem de evento <code>override_no_vistoria</code> (e do motivo em <code>note</code>).
                <br />• Solicitações dependem de <code>start_verification</code>, <code>sisgeo_update</code>, <code>decision</code>.
                <br />• Vistorias dependem de <code>create</code>, <code>status_change</code>, <code>emit_laudo</code>.
              </p>
            </div>
          </div>
        ) : null}

        {/* PROTOCOLOS */}
        {tab === "protocolos" ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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

        {/* EM OUTROS ÓRGÃOS */}
        {tab === "em_analise_outros" ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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

        {/* AJUSTES */}
        {tab === "ajustes" ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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

        {/* TERMOS */}
        {tab === "termos" ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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

        {/* PRODUTIVIDADE */}
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

                  {/* ✅ NOVO: overrides (derivado do event-log de proposals) */}
                  <p>
                    Overrides sem vistoria (SEMAD): <strong>{qtd_overrides_sem_vistoria_semad}</strong>{" "}
                    <span className="muted">(event-log: override_no_vistoria)</span>
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
                Este painel usa somente evidência do <strong>event-log</strong>:
                <br />• Kanban: <code>move</code> / <code>request_adjustments</code>
                <br />• Override: <code>override_no_vistoria</code>
                <br />
                Se “Overrides sem vistoria” ficar zerado, verifique se o fluxo está persistindo o evento no{" "}
                <code>history[]</code> antes do <code>move</code>.
              </p>
            </div>
          </div>
        ) : null}

        {/* SLA */}
        {tab === "sla" ? (
          <div>
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>SLA por etapa (tempo de permanência)</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Métricas calculadas a partir do log de <strong>moves</strong>, com recorte no período e censura no fim do intervalo.
              </p>

              <div style={{ marginTop: 10, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Coluna", "Amostras", "Meta", "P50", "P80", "P95", "Violação (≥ meta)"].map((h) => (
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