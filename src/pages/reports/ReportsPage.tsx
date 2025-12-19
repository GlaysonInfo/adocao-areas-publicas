// src/pages/reports/ReportsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
function toMs(iso?: string) {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : NaN;
}

function normEventType(h: any) {
  return String(h?.type ?? h?.action ?? h?.tipo ?? "").trim();
}
function normActor(h: any) {
  return String(h?.actor_role ?? h?.actor ?? h?.autor ?? h?.role ?? "—").trim();
}
function normAt(h: any) {
  return String(h?.at ?? h?.quando ?? h?.timestamp ?? h?.created_at ?? "");
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
  return String(h?.decision ?? h?.decisao ?? h?.resultado ?? h?.result ?? "").trim();
}

function getAdopterContact(p: any) {
  const nome = p?.adotante?.nome ?? p?.adotante_nome ?? p?.adotanteName ?? "—";
  const email = p?.adotante?.email ?? p?.adotante_email ?? p?.adotanteEmail ?? "—";
  const cel = p?.adotante?.celular ?? p?.adotante_celular ?? p?.celular ?? "—";
  const wpp = p?.adotante?.whatsapp ?? p?.adotante_whatsapp ?? p?.whatsapp ?? "—";
  return { nome, email, cel, wpp };
}

function downloadCSV(filename: string, headers: string[], rows: (string | number | null)[][]) {
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
        (normDecision(h) === "approved" ||
          normDecision(h) === "aprovada" ||
          normDecision(h) === "aprovado") &&
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
  const toMs2 = toD.getTime();

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

      const endSeg = Math.min(t, toMs2);
      const startSeg = Math.max(curAtMs, fromMs);

      if (endSeg > startSeg && bucket[curCol]) bucket[curCol].push(endSeg - startSeg);

      curCol = normTo(e) as KanbanColuna;
      curAtMs = t;
    }

    const endSeg = toMs2;
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

/* =========================================================
   SOLICITAÇÕES DE ÁREA (sem depender de imports novos)
   - lê do localStorage procurando um array com "solicitacao"/"sisgeo"/etc.
   - calcula métricas 100% baseadas em event-log (history/events)
========================================================= */

type AreaReqEvent = {
  id: string;
  type: string;
  at: string;
  actor_role: string;
  result?: "approved" | "rejected" | string;
  note?: string;
  sisgeo_ref?: string;
};

type AreaReqMetrics = {
  qtd_solicitacoes_criadas: number;
  qtd_solicitacoes_em_verificacao: number; // start_verification
  qtd_solicitacoes_decididas: number; // decision
  qtd_solicitacoes_deferidas: number;
  qtd_solicitacoes_indeferidas: number;

  tempo_medio_verificacao_sisgeo_ms: number | null;
  amostras_verificacao: number;

  tempo_medio_resposta_solicitacao_ms: number | null;
  amostras_resposta: number;
};

type AreaReqSemadProd = {
  total_actions: number;
  total_start_verification: number;
  total_sisgeo_updates: number;
  total_decisions: number;
  total_deferidas: number;
  total_indeferidas: number;
  requests_touched: number;
  transitions: { key: string; count: number }[];
};

function isApprovedWord(s: string) {
  const x = s.trim().toLowerCase();
  return ["approved", "aprovado", "aprovada", "deferido", "deferida", "ok", "sim"].includes(x);
}
function isRejectedWord(s: string) {
  const x = s.trim().toLowerCase();
  return ["rejected", "indeferido", "indeferida", "nao", "não", "negado", "invalido", "inválido"].includes(x);
}

function normalizeAreaReqEvent(raw: any): AreaReqEvent | null {
  if (!raw) return null;

  const type = String(raw?.type ?? raw?.action ?? raw?.tipo ?? "").trim();
  const at = String(raw?.at ?? raw?.quando ?? raw?.timestamp ?? raw?.created_at ?? "").trim();
  const actor_role = String(raw?.actor_role ?? raw?.actor ?? raw?.autor ?? raw?.role ?? "unknown").trim();

  if (!type || !at) return null;

  const note = String(raw?.note ?? raw?.motivo ?? raw?.mensagem ?? raw?.decision_note ?? "").trim() || undefined;
  const sisgeo_ref =
    String(raw?.sisgeo_ref ?? raw?.sisgeo_referencia ?? raw?.referencia_sisgeo ?? raw?.referencia ?? "").trim() ||
    undefined;

  const d0 = String(raw?.decision ?? raw?.resultado ?? raw?.result ?? raw?.outcome ?? "").trim();
  let result: AreaReqEvent["result"] = undefined;
  if (d0) {
    if (isApprovedWord(d0)) result = "approved";
    else if (isRejectedWord(d0)) result = "rejected";
    else result = d0;
  }

  return {
    id: String(raw?.id ?? `ev_${Math.random().toString(16).slice(2)}`),
    type,
    at,
    actor_role,
    result,
    note,
    sisgeo_ref,
  };
}

function normalizeAreaReq(raw: any) {
  const id = String(raw?.id ?? raw?.request_id ?? raw?.solicitacao_id ?? `req_${Math.random().toString(16).slice(2)}`);
  const created_at = String(raw?.created_at ?? raw?.createdAt ?? raw?.criada_em ?? "");
  const updated_at = String(raw?.updated_at ?? raw?.updatedAt ?? raw?.atualizada_em ?? created_at);

  const historyRaw: any[] = Array.isArray(raw?.history)
    ? raw.history
    : Array.isArray(raw?.events)
    ? raw.events
    : Array.isArray(raw?.historico)
    ? raw.historico
    : [];

  const history = historyRaw.map(normalizeAreaReqEvent).filter(Boolean) as AreaReqEvent[];

  // Se não existir log, sintetiza "create" pelo created_at (apenas p/ não zerar a UI).
  if (history.length === 0 && created_at) {
    history.push({
      id: `ev_create_${id}`,
      type: "create",
      at: created_at,
      actor_role: String(raw?.owner_role ?? raw?.role ?? "adotante"),
    });
  }

  history.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const codigo =
    String(raw?.codigo_solicitacao ?? raw?.codigo ?? raw?.protocolo ?? raw?.codigo_protocolo ?? "").trim() || "—";
  const status = String(raw?.status ?? raw?.estado ?? "").trim();
  const owner_role = String(raw?.owner_role ?? raw?.owner ?? raw?.perfil ?? "").trim();

  return { id, codigo, status, owner_role, created_at, updated_at, history };
}

function tryReadJsonArrayFromKey(key: string): any[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function looksLikeAreaRequestItem(x: any) {
  if (!x || typeof x !== "object") return false;
  const keys = Object.keys(x);
  const hasHistory = keys.includes("history") || keys.includes("events") || keys.includes("historico");
  const hasSisgeo =
    keys.some((k) => k.toLowerCase().includes("sisgeo")) ||
    String(x?.sisgeo_result ?? x?.resultado_sisgeo ?? "").length > 0;
  const hasInterv =
    keys.some((k) => k.toLowerCase().includes("interv")) || String(x?.intervencao ?? x?.descricao_intervencao ?? "").length > 0;
  const hasCoord =
    keys.some((k) => k.toLowerCase().includes("lat")) || keys.some((k) => k.toLowerCase().includes("lng")) || keys.some((k) => k.toLowerCase().includes("long"));
  const hasCodigo =
    String(x?.codigo_solicitacao ?? x?.protocolo ?? x?.codigo ?? x?.codigo_protocolo ?? "").trim().length > 0;

  // heurística: precisa ter pelo menos 2 sinais
  const signals = [hasHistory, hasSisgeo, hasInterv, hasCoord, hasCodigo].filter(Boolean).length;
  return signals >= 2;
}

function findAreaRequestsKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const candidates: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const lk = k.toLowerCase();
      if (lk.includes("area") && (lk.includes("request") || lk.includes("solicit"))) candidates.push(k);
    }

    // tenta candidatos primeiro
    for (const k of candidates) {
      const arr = tryReadJsonArrayFromKey(k);
      if (!arr || arr.length === 0) continue;
      if (arr.some(looksLikeAreaRequestItem)) return k;
    }

    // fallback: varre tudo (MVP)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const arr = tryReadJsonArrayFromKey(k);
      if (!arr || arr.length === 0) continue;
      if (arr.some(looksLikeAreaRequestItem)) return k;
    }

    return null;
  } catch {
    return null;
  }
}

function listAreaRequestsNormalized(): { key: string | null; items: ReturnType<typeof normalizeAreaReq>[] } {
  const key = findAreaRequestsKey();
  if (!key) return { key: null, items: [] };

  const arr = tryReadJsonArrayFromKey(key);
  if (!arr) return { key, items: [] };

  return { key, items: arr.map(normalizeAreaReq) };
}

function computeAreaReqMetrics(items: ReturnType<typeof normalizeAreaReq>[], fromD: Date | null, toD: Date | null): AreaReqMetrics {
  const metrics: AreaReqMetrics = {
    qtd_solicitacoes_criadas: 0,
    qtd_solicitacoes_em_verificacao: 0,
    qtd_solicitacoes_decididas: 0,
    qtd_solicitacoes_deferidas: 0,
    qtd_solicitacoes_indeferidas: 0,
    tempo_medio_verificacao_sisgeo_ms: null,
    amostras_verificacao: 0,
    tempo_medio_resposta_solicitacao_ms: null,
    amostras_resposta: 0,
  };

  if (!fromD || !toD) return metrics;

  const verifDur: number[] = [];
  const respDur: number[] = [];

  for (const r of items) {
    const hist = r.history ?? [];

    const creates = hist.filter((e) => e.type === "create" && inRange(e.at, fromD, toD));
    metrics.qtd_solicitacoes_criadas += creates.length;

    const starts = hist.filter((e) => e.type === "start_verification" && inRange(e.at, fromD, toD));
    metrics.qtd_solicitacoes_em_verificacao += starts.length;

    const decisions = hist.filter((e) => e.type === "decision" && inRange(e.at, fromD, toD));
    metrics.qtd_solicitacoes_decididas += decisions.length;

    for (const d of decisions) {
      const res = String(d.result ?? "");
      if (res === "approved" || isApprovedWord(res)) metrics.qtd_solicitacoes_deferidas++;
      else if (res === "rejected" || isRejectedWord(res)) metrics.qtd_solicitacoes_indeferidas++;
    }

    // tempo verificação: primeiro start_verification -> primeiro sisgeo_update depois
    const s0 = hist.find((e) => e.type === "start_verification" && inRange(e.at, fromD, toD));
    if (s0) {
      const sMs = toMs(s0.at);
      const sis = hist.find((e) => e.type === "sisgeo_update" && toMs(e.at) >= sMs);
      if (sis) {
        const dMs = toMs(sis.at) - sMs;
        if (Number.isFinite(dMs) && dMs >= 0) verifDur.push(dMs);
      }
    }

    // tempo resposta: primeiro create -> primeiro decision depois
    const c0 = hist.find((e) => e.type === "create" && inRange(e.at, fromD, toD));
    if (c0) {
      const cMs = toMs(c0.at);
      const dec = hist.find((e) => e.type === "decision" && toMs(e.at) >= cMs);
      if (dec) {
        const dMs = toMs(dec.at) - cMs;
        if (Number.isFinite(dMs) && dMs >= 0) respDur.push(dMs);
      }
    }
  }

  if (verifDur.length > 0) {
    metrics.amostras_verificacao = verifDur.length;
    metrics.tempo_medio_verificacao_sisgeo_ms = Math.round(verifDur.reduce((a, b) => a + b, 0) / verifDur.length);
  }
  if (respDur.length > 0) {
    metrics.amostras_resposta = respDur.length;
    metrics.tempo_medio_resposta_solicitacao_ms = Math.round(respDur.reduce((a, b) => a + b, 0) / respDur.length);
  }

  return metrics;
}

function computeAreaReqSemadProd(items: ReturnType<typeof normalizeAreaReq>[], fromD: Date | null, toD: Date | null): AreaReqSemadProd {
  const out: AreaReqSemadProd = {
    total_actions: 0,
    total_start_verification: 0,
    total_sisgeo_updates: 0,
    total_decisions: 0,
    total_deferidas: 0,
    total_indeferidas: 0,
    requests_touched: 0,
    transitions: [],
  };

  if (!fromD || !toD) return out;

  const touched = new Set<string>();
  const transCount = new Map<string, number>();

  for (const r of items) {
    for (const e of r.history ?? []) {
      if (!inRange(e.at, fromD, toD)) continue;
      if (e.actor_role !== "gestor_semad") continue;

      out.total_actions++;
      touched.add(r.id);

      if (e.type === "start_verification") out.total_start_verification++;
      if (e.type === "sisgeo_update") out.total_sisgeo_updates++;
      if (e.type === "decision") {
        out.total_decisions++;
        const res = String(e.result ?? "");
        if (res === "approved" || isApprovedWord(res)) out.total_deferidas++;
        else if (res === "rejected" || isRejectedWord(res)) out.total_indeferidas++;
      }

      // transições (evidência): tipo + resultado (quando houver)
      const k = e.type === "decision" ? `decision:${String(e.result ?? "unknown")}` : e.type;
      transCount.set(k, (transCount.get(k) ?? 0) + 1);
    }
  }

  out.requests_touched = touched.size;
  out.transitions = Array.from(transCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));

  return out;
}

export function ReportsPage() {
  const { role } = useAuth();

  const [tab, setTab] = useState<TabKey>("consolidado");

  const today = new Date();
  const thirty = new Date();
  thirty.setDate(today.getDate() - 30);

  const [from, setFrom] = useState<string>(toDateInputValue(thirty));
  const [to, setTo] = useState<string>(toDateInputValue(today));

  // proposals: subscribe (mesmo tab)
  // area requests: não assumimos subscribe existente -> detecta mudança por "poll" leve (MVP)
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const reqKeyRef = useRef<string | null>(null);
  const reqSnapshotRef = useRef<string>("");

  useEffect(() => {
    const interval = window.setInterval(() => {
      const key = findAreaRequestsKey();
      if (key !== reqKeyRef.current) {
        reqKeyRef.current = key;
        reqSnapshotRef.current = key ? localStorage.getItem(key) ?? "" : "";
        setTick((t) => t + 1);
        return;
      }

      if (!key) return;
      const snap = localStorage.getItem(key) ?? "";
      if (snap !== reqSnapshotRef.current) {
        reqSnapshotRef.current = snap;
        setTick((t) => t + 1);
      }
    }, 800);

    return () => window.clearInterval(interval);
  }, []);

  const fromD = useMemo(() => parseDateStart(from), [from]);
  const toD = useMemo(() => parseDateEnd(to), [to]);

  const fromIso = useMemo(() => (fromD ? fromD.toISOString() : ""), [fromD]);
  const toIso = useMemo(() => (toD ? toD.toISOString() : ""), [toD]);

  const all = useMemo(() => listProposals(), [tick]);

  // ======================
  // PROPOSTAS (KANBAN): EVENT-BASED
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
    return all
      .filter((p) => !!firstCreateInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(firstCreateInPeriod(a, fromD, toD)?.at ?? "").localeCompare(
          String(firstCreateInPeriod(b, fromD, toD)?.at ?? "")
        )
      );
  }, [all, fromD, toD]);

  const rowsAjustes = useMemo(() => {
    if (!fromD || !toD) return [];
    return all
      .filter((p) => !!lastAdjustmentsInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(lastAdjustmentsInPeriod(b, fromD, toD)?.at ?? "").localeCompare(
          String(lastAdjustmentsInPeriod(a, fromD, toD)?.at ?? "")
        )
      );
  }, [all, fromD, toD]);

  const rowsTermos = useMemo(() => {
    if (!fromD || !toD) return [];
    return all
      .filter((p) => !!lastTermSignedInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(lastTermSignedInPeriod(b, fromD, toD)?.at ?? "").localeCompare(
          String(lastTermSignedInPeriod(a, fromD, toD)?.at ?? "")
        )
      );
  }, [all, fromD, toD]);

  const rowsEmOutros = useMemo(() => {
    if (!fromD || !toD) return [];
    return all
      .filter((p) => !!lastOtherOrgEntryInPeriod(p, fromD, toD))
      .sort((a, b) =>
        String(lastOtherOrgEntryInPeriod(b, fromD, toD)?.at ?? "").localeCompare(
          String(lastOtherOrgEntryInPeriod(a, fromD, toD)?.at ?? "")
        )
      );
  }, [all, fromD, toD]);

  const slaRows = useMemo(() => computeSlaDetails(all, fromD, toD), [all, fromD, toD]);

  // ======================
  // SOLICITAÇÕES DE ÁREA: EVENT-BASED (localStorage)
  // ======================

  const areaReq = useMemo(() => listAreaRequestsNormalized(), [tick]);
  const areaReqMetrics = useMemo(() => computeAreaReqMetrics(areaReq.items, fromD, toD), [areaReq.items, fromD, toD]);
  const areaReqSemadProd = useMemo(() => computeAreaReqSemadProd(areaReq.items, fromD, toD), [areaReq.items, fromD, toD]);

  // ======================
  // EXPORTS
  // ======================

  const exportConsolidado = () => {
    const headers = [
      "Período (de)",
      "Período (até)",

      // Propostas (Kanban)
      "Protocolos criados (propostas)",
      "Entradas Análise SEMAD (propostas)",
      "Entradas Análise ECOS (propostas)",
      "Entradas Decisão (Governo) (propostas)",
      "Ajustes solicitados (propostas)",
      "Termos assinados (propostas)",
      "Indeferidas (propostas)",
      "Em outros órgãos (ECOS + Governo) (propostas)",

      // Solicitações de área
      "Solicitações criadas (área)",
      "Start verificação (área)",
      "Decisões (área)",
      "Deferidas (área)",
      "Indeferidas (área)",
      "Tempo médio verificação SisGeo (ms)",
      "Amostras verificação",
      "Tempo médio resposta solicitação (ms)",
      "Amostras resposta",
      "StorageKey (área)",
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

        areaReqMetrics.qtd_solicitacoes_criadas,
        areaReqMetrics.qtd_solicitacoes_em_verificacao,
        areaReqMetrics.qtd_solicitacoes_decididas,
        areaReqMetrics.qtd_solicitacoes_deferidas,
        areaReqMetrics.qtd_solicitacoes_indeferidas,
        areaReqMetrics.tempo_medio_verificacao_sisgeo_ms,
        areaReqMetrics.amostras_verificacao,
        areaReqMetrics.tempo_medio_resposta_solicitacao_ms,
        areaReqMetrics.amostras_resposta,
        areaReq.key ?? "",
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
              Perfil: <strong>{role}</strong> · Período baseado em <strong>eventos</strong> · SLA com censura (itens ainda abertos no fim do período).
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
              <h3>Consolidado — Propostas (Kanban)</h3>
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
              <h3>Consolidado — Solicitações de área</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Fonte: event-log (history/events) em localStorage {areaReq.key ? <code>{areaReq.key}</code> : <span>(não detectado)</span>}
              </p>

              <p>Solicitações criadas: <strong>{areaReqMetrics.qtd_solicitacoes_criadas}</strong></p>
              <p>Início verificação (start_verification): <strong>{areaReqMetrics.qtd_solicitacoes_em_verificacao}</strong></p>
              <p>Decisões (decision): <strong>{areaReqMetrics.qtd_solicitacoes_decididas}</strong></p>
              <p>Deferidas: <strong>{areaReqMetrics.qtd_solicitacoes_deferidas}</strong></p>
              <p>Indeferidas: <strong>{areaReqMetrics.qtd_solicitacoes_indeferidas}</strong></p>

              <hr className="hr" />

              <p>
                Tempo médio verificação SisGeo:{" "}
                <strong>{formatDuration(areaReqMetrics.tempo_medio_verificacao_sisgeo_ms)}</strong>{" "}
                <span style={{ opacity: 0.75 }}>(n={areaReqMetrics.amostras_verificacao})</span>
              </p>
              <p>
                Tempo médio resposta solicitação:{" "}
                <strong>{formatDuration(areaReqMetrics.tempo_medio_resposta_solicitacao_ms)}</strong>{" "}
                <span style={{ opacity: 0.75 }}>(n={areaReqMetrics.amostras_resposta})</span>
              </p>
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Observação</h3>
              <p style={{ marginTop: 6 }}>
                Se algum painel ficar zerado:
                <br />• Kanban depende de <code>moveProposal(..., actor_role)</code>.
                <br />• Solicitações dependem de eventos <code>start_verification</code>, <code>sisgeo_update</code>, <code>decision</code>.
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
          <div className="grid cols-3">
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Produtividade — SEMAD (Propostas / Kanban)</h3>

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
              <h3>Produtividade — SEMAD (Solicitações de área)</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Fonte: eventos com <code>actor_role="gestor_semad"</code> em localStorage {areaReq.key ? <code>{areaReq.key}</code> : <span>(não detectado)</span>}
              </p>

              <p>Ações (SEMAD): <strong>{areaReqSemadProd.total_actions}</strong></p>
              <p>start_verification: <strong>{areaReqSemadProd.total_start_verification}</strong></p>
              <p>sisgeo_update: <strong>{areaReqSemadProd.total_sisgeo_updates}</strong></p>
              <p>decision (total): <strong>{areaReqSemadProd.total_decisions}</strong></p>
              <p>
                decision:approved: <strong>{areaReqSemadProd.total_deferidas}</strong> · decision:rejected:{" "}
                <strong>{areaReqSemadProd.total_indeferidas}</strong>
              </p>
              <p>Solicitações tocadas: <strong>{areaReqSemadProd.requests_touched}</strong></p>

              <hr className="hr" />

              <h3 style={{ marginTop: 0 }}>Ações mais frequentes</h3>
              {areaReqSemadProd.transitions.length === 0 ? (
                <p style={{ opacity: 0.75 }}>Sem ações registradas no período.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {areaReqSemadProd.transitions.map((t) => (
                    <li key={t.key}>
                      <strong>{t.key}</strong>: {t.count}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>Nota técnica</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Para evidência “reproduzível por localStorage”, cada ação do gestor precisa persistir:
                <br />• Propostas: <code>history[]</code> com <code>type="move|request_adjustments|decision"</code>, <code>at</code>, <code>actor_role</code>.
                <br />• Solicitações: <code>history[]</code> com <code>type="start_verification|sisgeo_update|decision"</code>, <code>at</code>, <code>actor_role</code>, <code>result</code>, <code>note</code>.
              </p>
            </div>
          </div>
        ) : null}

        {tab === "sla" ? (
          <div>
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3>SLA por etapa (tempo de permanência)</h3>
              <p style={{ marginTop: 6, opacity: 0.85 }}>
                Calculado por segmentos (moves) com recorte no período e censura no fim do intervalo.
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
                Para SLA “oficial”: definir dias úteis vs corridos e separar itens censurados (ainda abertos no fim do período).
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}