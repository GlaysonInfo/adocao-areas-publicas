// src/storage/proposals.ts
import type {
  KanbanColuna,
  PropostaAdocao,
  ProposalEvent,
  ProposalEventType,
  DocumentoMeta,
  DocumentoTipo,
} from "../domain/proposal";
import { getAreaById, setAreaStatus } from "./areas";

const KEY = "mvp_proposals_v1";

/* =========================
   SUBSCRIBE
========================= */
type Unsub = () => void;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

export function subscribeProposals(fn: () => void): Unsub {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/* =========================
   UTILS
========================= */
function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toMs(iso: string) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

function tryParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readAllRaw(): any[] {
  const parsed = tryParseJson(localStorage.getItem(KEY));
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(items: PropostaAdocao[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emit(); // dispara no mesmo tab
}

const ALLOWED_COLS: KanbanColuna[] = [
  "protocolo",
  "analise_semad",
  "analise_ecos",
  "ajustes",
  "decisao",
  "termo_assinado",
  "indeferida",
];

function normalizeCol(raw: any): KanbanColuna {
  const s = String(raw ?? "").trim();
  return (ALLOWED_COLS as string[]).includes(s) ? (s as KanbanColuna) : "protocolo";
}

/** Normaliza evento aceitando formatos antigos (historico/action/autor/etc.)
 *  Mantém campos extras (ex.: meta) quando existirem.
 */
function normalizeEvent(raw: any): (ProposalEvent & { meta?: any; gate_from?: any; gate_to?: any }) | null {
  if (!raw) return null;

  // NOTE: aceita tipos novos mesmo que ProposalEventType não tenha literal.
  const type = String(raw.type ?? raw.action ?? raw.tipo ?? "").trim() as ProposalEventType;
  const at = String(raw.at ?? raw.quando ?? raw.timestamp ?? raw.created_at ?? "");
  const actor_role = String(raw.actor_role ?? raw.actor ?? raw.autor ?? raw.profile ?? raw.role ?? "unknown");

  if (!type || !at) return null;

  const ev: any = {
    id: String(raw.id ?? safeUuid()),
    type,
    at,
    actor_role,
  };

  const from = raw.from ?? raw.from_coluna ?? raw.fromColuna;
  const to = raw.to ?? raw.to_coluna ?? raw.toColuna;

  if (from != null) ev.from = normalizeCol(from);
  if (to != null) ev.to = normalizeCol(to);

  const note = raw.note ?? raw.motivo ?? raw.mensagem ?? raw.decision_note;
  if (note != null && String(note).trim()) ev.note = String(note);

  if (raw.decision) ev.decision = raw.decision === "approved" ? "approved" : "rejected";
  if (raw.decision_note) ev.decision_note = String(raw.decision_note);

  // Mantém meta quando existir (ex.: meta.gate_from/gate_to)
  if (raw.meta != null) ev.meta = raw.meta;

  // compat: também aceita gate_from/gate_to em nível superior
  if (raw.gate_from != null) ev.gate_from = raw.gate_from;
  if (raw.gate_to != null) ev.gate_to = raw.gate_to;

  return ev as ProposalEvent & { meta?: any; gate_from?: any; gate_to?: any };
}

function normalizeProposal(raw: any): PropostaAdocao {
  const id = String(raw?.id ?? safeUuid());
  const created_at = String(raw?.created_at ?? raw?.createdAt ?? nowIso());
  const updated_at = String(raw?.updated_at ?? raw?.updatedAt ?? created_at);

  const historyRaw = Array.isArray(raw?.history)
    ? raw.history
    : Array.isArray(raw?.historico)
      ? raw.historico
      : [];

  const history = historyRaw.map(normalizeEvent).filter(Boolean) as any[];

  // migração: se não tem history, cria um create mínimo (ajuda relatórios/SLA)
  if (history.length === 0) {
    history.push({
      id: safeUuid(),
      type: "create",
      at: created_at,
      actor_role: String(raw?.owner_role ?? "adotante_pf"),
    });
  }

  history.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return {
    id,
    codigo_protocolo: String(raw?.codigo_protocolo ?? raw?.codigo ?? "—"),
    area_id: String(raw?.area_id ?? ""),
    area_nome: String(raw?.area_nome ?? "—"),
    descricao_plano: String(raw?.descricao_plano ?? ""),
    kanban_coluna: normalizeCol(raw?.kanban_coluna ?? raw?.kanbanColuna ?? "protocolo"),
    documentos: Array.isArray(raw?.documentos) ? raw.documentos : [],
    owner_role: String(raw?.owner_role ?? "adotante_pf"),
    created_at,
    updated_at,
    history: history as ProposalEvent[],
    closed_status: raw?.closed_status ?? null,
    closed_at: raw?.closed_at ?? null,
  };
}

export function listProposals(): PropostaAdocao[] {
  return readAllRaw().map(normalizeProposal);
}

export function getProposalById(id: string): PropostaAdocao | null {
  const all = listProposals();
  return all.find((p) => p.id === id) ?? null;
}

// aceita undefined/null (pra UI não estourar tipagem)
export function listMyProposals(owner_role: string | null | undefined): PropostaAdocao[] {
  const role = String(owner_role ?? "").trim();
  if (!role) return [];
  const all = listProposals();
  return all.filter((p) => p.owner_role === role);
}

/* =========================
   RULES
========================= */
function isClosed(p: PropostaAdocao) {
  return (
    p.closed_status === "approved" ||
    p.closed_status === "rejected" ||
    p.kanban_coluna === "termo_assinado" ||
    p.kanban_coluna === "indeferida"
  );
}

function hasOpenProposalForArea(area_id: string, ignoreProposalId?: string) {
  const all = listProposals();
  return all.some((p) => {
    if (ignoreProposalId && p.id === ignoreProposalId) return false;
    if (p.area_id !== area_id) return false;
    return !isClosed(p);
  });
}

function pushEvent<T extends Record<string, any>>(p: PropostaAdocao, ev: T, updatedAtIso: string): PropostaAdocao {
  const next: PropostaAdocao = {
    ...p,
    updated_at: updatedAtIso,
    history: [
      ...(p.history ?? []),
      {
        id: safeUuid(),
        ...ev,
      } as any,
    ],
  };
  (next.history as any[]).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return next;
}

/* =========================
   DOCUMENT HELPERS (MVP = só metadados)
========================= */
function fileMeta(tipo: DocumentoTipo, list: FileList): DocumentoMeta {
  const f = list.item(0)!;
  return {
    tipo,
    file_name: f.name,
    file_size: f.size,
    mime_type: f.type || "application/octet-stream",
    last_modified: f.lastModified,
  };
}

function upsertDoc(docs: DocumentoMeta[], next: DocumentoMeta): DocumentoMeta[] {
  const idx = docs.findIndex((d) => d.tipo === next.tipo);
  if (idx >= 0) {
    const copy = [...docs];
    copy[idx] = next;
    return copy;
  }
  return [...docs, next];
}

/* =========================
   CREATE
========================= */
export function createProposal(input: PropostaAdocao, actor_role: string) {
  const area = getAreaById(input.area_id);
  if (!area) throw new Error("Área inválida.");
  if (area.status !== "disponivel") throw new Error("Esta área não está disponível para adoção.");
  if (hasOpenProposalForArea(input.area_id)) throw new Error("Já existe uma proposta em andamento para esta área.");

  const created = input.created_at ?? nowIso();
  const updated = input.updated_at ?? created;

  const base = normalizeProposal({
    ...input,
    kanban_coluna: "protocolo",
    closed_status: null,
    closed_at: null,
    created_at: created,
    updated_at: updated,
    history: [
      {
        id: safeUuid(),
        type: "create",
        at: created,
        actor_role: actor_role || input.owner_role,
      },
    ],
  });

  const all = listProposals();
  all.unshift(base);
  writeAll(all);

  setAreaStatus(base.area_id, "em_adocao");
  return base;
}

/* =========================
   VISTORIA GATE (laudo_emitido)
   - heurística: encontra em localStorage qualquer coleção com "vist"
========================= */
function hasLaudoEmitidoForProposal(proposalId: string): boolean {
  const seedKeys = ["mvp_vistorias_v1", "mvp_vistorias"];
  const keys = Array.from(
    new Set([...seedKeys, ...Object.keys(localStorage).filter((k) => k.toLowerCase().includes("vist"))])
  );

  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;

    const parsed = tryParseJson(raw);
    if (!Array.isArray(parsed)) continue;

    for (const v of parsed) {
      const pid = String((v as any)?.proposal_id ?? (v as any)?.proposta_id ?? "");
      if (pid !== proposalId) continue;

      const status = String((v as any)?.status ?? "");
      if (status === "laudo_emitido") return true;

      // fallback: se existir laudo estruturado
      if ((v as any)?.laudo?.emitido_em) return true;
    }
  }

  return false;
}

/* =========================
   MOVE / REQUEST_ADJUSTMENTS
========================= */
export type ProposalExtraEventInput = {
  type: string; // ex.: "override_no_vistoria"
  at?: string;
  note?: string;
  from?: KanbanColuna;
  to?: KanbanColuna;
  meta?: Record<string, any>; // ex.: { gate_from, gate_to }
};

function ensureMoveAfterExtras(moveIso: string, extras: ProposalExtraEventInput[]) {
  const moveMs = toMs(moveIso);
  const maxExtraMs = extras
    .map((e) => toMs(String(e.at ?? "")))
    .filter((n) => Number.isFinite(n))
    .reduce((m, v) => Math.max(m, v), -Infinity);

  if (!Number.isFinite(maxExtraMs)) return moveIso;
  if (!Number.isFinite(moveMs) || moveMs <= maxExtraMs) return new Date(maxExtraMs + 1).toISOString();
  return moveIso;
}

function hasOverrideForGate(p: PropostaAdocao, from: KanbanColuna, to: KanbanColuna) {
  const hist: any[] = Array.isArray(p.history) ? p.history : [];
  return hist.some((e) => {
    if (String(e?.type) !== "override_no_vistoria") return false;
    const gf = (e?.meta?.gate_from ?? e?.gate_from ?? e?.from) as any;
    const gt = (e?.meta?.gate_to ?? e?.gate_to ?? e?.to) as any;
    return String(gf) === String(from) && String(gt) === String(to);
  });
}

export function moveProposal(
  id: string,
  to: KanbanColuna,
  actor_role: string,
  note?: string,
  extraEvents?: ProposalExtraEventInput[]
) {
  const all = listProposals();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Proposta não encontrada.");

  const current = all[idx];
  const from = current.kanban_coluna;

  if (isClosed(current) && to !== current.kanban_coluna) {
    throw new Error("Proposta encerrada. Não é possível mover.");
  }

  // validações básicas
  if (to === "ajustes") {
    const t0 = String(note ?? "").trim();
    if (!t0) throw new Error("Motivo de ajustes é obrigatório.");
  }
  if (to === "indeferida") {
    const t0 = String(note ?? "").trim();
    if (!t0) throw new Error("Motivo do indeferimento é obrigatório.");
  }

  // ===== ✅ GATE (AGORA NO PONTO CERTO):
  // SEMAD -> ECOS (encaminhar p/ ECOS) sem laudo_emitido => exigir confirmação + motivo e logar override
  const isGateTransition = from === "analise_semad" && to === "analise_ecos";
  const needsGate = isGateTransition && !hasLaudoEmitidoForProposal(current.id);

  const extra: ProposalExtraEventInput[] = Array.isArray(extraEvents) ? [...extraEvents] : [];
  const hasOverrideInExtras = extra.some((e) => String(e?.type) === "override_no_vistoria");
  const alreadyLoggedForThisGate = hasOverrideForGate(current, from, to);

  if (needsGate && !hasOverrideInExtras && !alreadyLoggedForThisGate) {
    const ok = window.confirm(
      `Atenção: não há LAUDO DE VISTORIA emitido para esta proposta.\n\n` +
        `Você está encaminhando da SEMAD para a ECOS.\n\n` +
        `Deseja seguir mesmo assim (OVERRIDE SEM VISTORIA)?`
    );
    if (!ok) return current;

    const motivo = (window.prompt("Motivo do override (obrigatório):", "") ?? "").trim();
    if (!motivo) {
      alert("Motivo obrigatório. Operação cancelada.");
      return current;
    }

    // evento override ANTES do move
    extra.unshift({
      type: "override_no_vistoria",
      at: nowIso(),
      note: motivo,
      from,
      to,
      meta: { gate_from: from, gate_to: to },
    });
  }

  // timestamps (garante move depois dos extras)
  let tMove = ensureMoveAfterExtras(nowIso(), extra);

  let next: PropostaAdocao = { ...current, kanban_coluna: to, updated_at: tMove };

  // 1) extras (ex.: override_no_vistoria) — ANTES do move
  if (extra.length > 0) {
    for (const ex of extra) {
      const at = String(ex.at ?? nowIso());
      next = pushEvent(
        next,
        {
          type: ex.type as unknown as ProposalEventType,
          at,
          actor_role: actor_role || "unknown",
          from: ex.from ?? from,
          to: ex.to ?? to,
          note: ex.note ? String(ex.note) : undefined,
          ...(ex.meta ? { meta: ex.meta } : {}),
        },
        tMove
      );
    }
  }

  // 2) move
  next = pushEvent(
    next,
    {
      type: "move",
      at: tMove,
      actor_role: actor_role || "unknown",
      from,
      to,
      note: note != null && String(note).trim() ? String(note).trim() : undefined,
    },
    tMove
  );

  // 3) request_adjustments
  if (to === "ajustes") {
    next = pushEvent(
      next,
      {
        type: "request_adjustments",
        at: tMove,
        actor_role: actor_role || "unknown",
        from,
        to,
        note: String(note).trim(),
      },
      tMove
    );
  }

  // 4) decisões terminais
  if (to === "termo_assinado") {
    next = { ...next, closed_status: "approved", closed_at: tMove };
    next = pushEvent(
      next,
      {
        type: "decision",
        at: tMove,
        actor_role: actor_role || "unknown",
        decision: "approved",
      },
      tMove
    );
  }

  if (to === "indeferida") {
    next = { ...next, closed_status: "rejected", closed_at: tMove };
    next = pushEvent(
      next,
      {
        type: "decision",
        at: tMove,
        actor_role: actor_role || "unknown",
        decision: "rejected",
        decision_note: note ? String(note) : undefined,
      },
      tMove
    );
  }

  all[idx] = next;
  writeAll(all);

  if (to === "termo_assinado") setAreaStatus(next.area_id, "adotada");
  if (to === "indeferida") setAreaStatus(next.area_id, "disponivel");

  return next;
}

/* =========================
   ADOTANTE: ATENDER AJUSTES E REENVIAR
========================= */
export function adopterUpdateAndResubmitFromAdjustments(
  id: string,
  input: {
    descricao_plano?: string;
    carta_intencao?: FileList | null;
    projeto_resumo?: FileList | null;
  },
  actor_role: string
) {
  const role = String(actor_role ?? "");
  if (!role.startsWith("adotante")) throw new Error("Apenas adotante pode atender ajustes.");

  const all = listProposals();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Proposta não encontrada.");

  const current = all[idx];

  if (current.kanban_coluna !== "ajustes") throw new Error("A proposta não está em ajustes.");
  if (isClosed(current)) throw new Error("Proposta encerrada.");

  if (current.owner_role && current.owner_role !== role) {
    throw new Error("Você não é o responsável por esta proposta.");
  }

  const t = nowIso();

  let docs: DocumentoMeta[] = Array.isArray(current.documentos) ? [...current.documentos] : [];

  if (input.carta_intencao instanceof FileList && input.carta_intencao.length > 0) {
    docs = upsertDoc(docs, fileMeta("carta_intencao", input.carta_intencao));
  }

  if (input.projeto_resumo instanceof FileList && input.projeto_resumo.length > 0) {
    docs = upsertDoc(docs, fileMeta("projeto_resumo", input.projeto_resumo));
  }

  const descricao =
    input.descricao_plano != null
      ? String(input.descricao_plano).trim()
      : String(current.descricao_plano ?? "").trim();

  let next: PropostaAdocao = {
    ...current,
    descricao_plano: descricao,
    documentos: docs,
    kanban_coluna: "protocolo",
    updated_at: t,
  };

  next = pushEvent(
    next,
    {
      type: "move",
      at: t,
      actor_role: role,
      from: "ajustes",
      to: "protocolo",
      note: "Reenvio do adotante após ajustes",
    },
    t
  );

  all[idx] = next;
  writeAll(all);

  return next;
}

export function resubmitAfterAdjustments(id: string, actor_role: string) {
  return adopterUpdateAndResubmitFromAdjustments(id, {}, actor_role);
}

/* =========================
   EVENTOS (BASE PARA RELATÓRIOS/SLA)
========================= */
type EventRow = ProposalEvent & {
  proposal_id: string;
  codigo_protocolo: string;
  area_id: string;
  area_nome: string;
};

function listEventRows(): EventRow[] {
  const proposals = listProposals();
  const rows: EventRow[] = [];

  for (const p of proposals) {
    for (const ev of (p.history ?? []) as any[]) {
      rows.push({
        ...(ev as any),
        proposal_id: p.id,
        codigo_protocolo: p.codigo_protocolo,
        area_id: p.area_id,
        area_nome: p.area_nome,
      });
    }
  }

  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return rows;
}

export function listProposalEvents(): ProposalEvent[] {
  return listEventRows().map(({ proposal_id, codigo_protocolo, area_id, area_nome, ...ev }) => ev);
}

export function listProposalEventsBetween(fromIso: string, toIso: string): ProposalEvent[] {
  const a = toMs(fromIso);
  const b = toMs(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  return listProposalEvents().filter((e) => {
    const t = toMs(e.at);
    return Number.isFinite(t) && t >= a && t <= b;
  });
}

function listEventRowsBetween(fromIso: string, toIso: string): EventRow[] {
  const a = toMs(fromIso);
  const b = toMs(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  return listEventRows().filter((e) => {
    const t = toMs(e.at);
    return Number.isFinite(t) && t >= a && t <= b;
  });
}

export function computeConsolidatedByPeriod(fromIso: string, toIso: string) {
  const evs = listEventRowsBetween(fromIso, toIso);

  const protocols_created = evs.filter((e) => e.type === "create").length;

  const entered_semad = evs.filter((e) => e.type === "move" && e.to === "analise_semad").length;
  const entered_ecos = evs.filter((e) => e.type === "move" && e.to === "analise_ecos").length;
  const entered_gov = evs.filter((e) => e.type === "move" && e.to === "decisao").length;

  const adjustments_requested = evs.filter((e) => e.type === "request_adjustments").length;

  const byProposal = new Map<string, EventRow[]>();
  for (const e of evs) {
    const arr = byProposal.get(e.proposal_id) ?? [];
    arr.push(e);
    byProposal.set(e.proposal_id, arr);
  }

  let terms_signed = 0;
  let rejected = 0;

  for (const [, arr] of byProposal) {
    const decApproved = arr.some((e) => e.type === "decision" && (e as any).decision === "approved");
    const decRejected = arr.some((e) => e.type === "decision" && (e as any).decision === "rejected");

    if (decApproved) terms_signed += 1;
    else if (arr.some((e) => e.type === "move" && e.to === "termo_assinado")) terms_signed += 1;

    if (decRejected) rejected += 1;
    else if (arr.some((e) => e.type === "move" && e.to === "indeferida")) rejected += 1;
  }

  return {
    protocols_created,
    entered_semad,
    entered_ecos,
    entered_gov,
    adjustments_requested,
    terms_signed,
    rejected,
  };
}

export function computeSemadProductivity(fromIso: string, toIso: string) {
  const evs = listEventRowsBetween(fromIso, toIso);

  const semadMoves = evs.filter((e) => e.actor_role === "gestor_semad" && e.type === "move");
  const semadAdjust = evs.filter((e) => e.actor_role === "gestor_semad" && e.type === "request_adjustments");
  const semadOverrides = evs.filter(
    (e) => e.actor_role === "gestor_semad" && String(e.type) === "override_no_vistoria"
  );

  const touched = new Set<string>();
  for (const e of [...semadMoves, ...semadAdjust, ...semadOverrides]) touched.add(e.proposal_id);

  const transCount = new Map<string, number>();
  for (const e of semadMoves) {
    const k = `${(e as any).from ?? "?"}→${(e as any).to ?? "?"}`;
    transCount.set(k, (transCount.get(k) ?? 0) + 1);
  }

  const transitions = Array.from(transCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));

  return {
    total_moves: semadMoves.length,
    total_adjustments_requested: semadAdjust.length,
    proposals_touched: touched.size,
    transitions,
    overrides_no_vistoria: semadOverrides.length,
  };
}

export function computeSlaByColumn(fromIso: string, toIso: string) {
  const startMs = toMs(fromIso);
  const endMs = toMs(toIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return { by_column: {}, samples: 0 };
  }

  const cols: KanbanColuna[] = [...ALLOWED_COLS];

  const bucket: Record<string, number[]> = {};
  for (const c of cols) bucket[c] = [];

  const proposals = listProposals();

  for (const p of proposals) {
    const hist = [...(p.history ?? [])].sort((a, b) => String(a.at).localeCompare(String(b.at)));

    let curCol: KanbanColuna = "protocolo";
    let curAt = toMs(p.created_at);
    if (!Number.isFinite(curAt)) curAt = startMs;

    for (const e of hist) {
      const t = toMs(e.at);
      if (!Number.isFinite(t)) continue;
      if (t >= startMs) break;
      if (e.type === "move" && (e as any).to) {
        curCol = normalizeCol((e as any).to);
        curAt = t;
      }
    }

    curAt = Math.max(curAt, startMs);

    for (const e of hist) {
      const t = toMs(e.at);
      if (!Number.isFinite(t)) continue;
      if (t < startMs) continue;
      if (t > endMs) break;

      if (e.type === "move" && (e as any).to) {
        const segStart = Math.max(curAt, startMs);
        const segEnd = Math.min(t, endMs);

        if (segEnd > segStart) bucket[curCol].push(segEnd - segStart);

        curCol = normalizeCol((e as any).to);
        curAt = t;
      }
    }

    const segStart = Math.max(curAt, startMs);
    const segEnd = endMs;
    if (segEnd > segStart) bucket[curCol].push(segEnd - segStart);
  }

  const pct = (arr: number[], p: number) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
    return sorted[idx];
  };

  const by_column: Record<string, { n: number; p50_ms: number | null; p80_ms: number | null; p95_ms: number | null }> =
    {};

  let samples = 0;
  for (const c of cols) {
    const arr = bucket[c];
    samples += arr.length;
    by_column[c] = {
      n: arr.length,
      p50_ms: pct(arr, 0.5),
      p80_ms: pct(arr, 0.8),
      p95_ms: pct(arr, 0.95),
    };
  }

  return { by_column, samples };
}