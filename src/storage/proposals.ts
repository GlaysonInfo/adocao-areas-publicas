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

function readAllRaw(): any[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: PropostaAdocao[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emit(); // dispara no mesmo tab
}

function normalizeCol(raw: any): KanbanColuna {
  const s = String(raw ?? "").trim();
  const allowed: KanbanColuna[] = [
    "protocolo",
    "analise_semad",
    "analise_ecos",
    "ajustes",
    "decisao",
    "termo_assinado",
    "indeferida",
  ];
  return (allowed as string[]).includes(s) ? (s as KanbanColuna) : "protocolo";
}

/** Normaliza evento, aceitando formatos antigos (historico/action/autor/etc.) */
function normalizeEvent(raw: any): ProposalEvent | null {
  if (!raw) return null;

  const type = String(raw.type ?? raw.action ?? raw.tipo ?? "").trim() as ProposalEventType;
  const at = String(raw.at ?? raw.quando ?? raw.timestamp ?? raw.created_at ?? "");
  const actor_role = String(raw.actor_role ?? raw.actor ?? raw.autor ?? raw.profile ?? "unknown");

  if (!type || !at) return null;

  const ev: ProposalEvent = {
    id: String(raw.id ?? safeUuid()),
    type,
    at,
    actor_role,
  };

  const from = raw.from ?? raw.from_coluna ?? raw.fromColuna;
  const to = raw.to ?? raw.to_coluna ?? raw.toColuna;

  if (from != null) ev.from = normalizeCol(from);
  if (to != null) ev.to = normalizeCol(to);

  const note = raw.note ?? raw.motivo ?? raw.mensagem;
  if (note != null && String(note).trim()) ev.note = String(note);

  if (raw.decision) ev.decision = raw.decision === "approved" ? "approved" : "rejected";
  if (raw.decision_note) ev.decision_note = String(raw.decision_note);

  return ev;
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
  const history = historyRaw.map(normalizeEvent).filter(Boolean) as ProposalEvent[];

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
    history,
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

export function listMyProposals(owner_role: string): PropostaAdocao[] {
  const all = listProposals();
  return all.filter((p) => p.owner_role === owner_role);
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

function pushEvent(
  p: PropostaAdocao,
  ev: Omit<ProposalEvent, "id">,
  updatedAtIso: string
): PropostaAdocao {
  const next: PropostaAdocao = {
    ...p,
    updated_at: updatedAtIso,
    history: [
      ...(p.history ?? []),
      {
        id: safeUuid(),
        ...ev,
      },
    ],
  };
  next.history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
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
   - bloqueia concorrência por área
   - status da área: disponivel -> em_adocao
   - registra evento create
   ========================= */
export function createProposal(input: PropostaAdocao, actor_role: string) {
  const area = getAreaById(input.area_id);
  if (!area) throw new Error("Área inválida.");
  if (area.status !== "disponivel") throw new Error("Esta área não está disponível para adoção.");
  if (hasOpenProposalForArea(input.area_id))
    throw new Error("Já existe uma proposta em andamento para esta área.");

  const created = input.created_at ?? nowIso();
  const updated = input.updated_at ?? created;

  const base = normalizeProposal({
    ...input,
    kanban_coluna: "protocolo",
    closed_status: null,
    closed_at: null,
    created_at: created,
    updated_at: updated,
    history: [],
  });

  let p = base;

  // evento create (mesmo timestamp do created_at)
  p = pushEvent(
    p,
    {
      type: "create",
      at: p.created_at,
      actor_role: actor_role || p.owner_role,
    },
    p.updated_at
  );

  const all = listProposals();
  all.unshift(p);
  writeAll(all);

  // regra de negócio: ao protocolar, a área entra em adoção
  setAreaStatus(p.area_id, "em_adocao");

  return p;
}

/* =========================
   MOVE / REQUEST_ADJUSTMENTS
   - registra:
     - move (sempre)
     - request_adjustments (quando to === "ajustes", com note obrigatório)
     - decision (quando termina)
   - atualiza status da área:
     protocolo -> em_adocao (já no create)
     termo_assinado -> adotada
     indeferida -> disponivel
   ========================= */
export function moveProposal(id: string, to: KanbanColuna, actor_role: string, note?: string) {
  const all = listProposals();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Proposta não encontrada.");

  const current = all[idx];
  const from = current.kanban_coluna;

  if (isClosed(current) && to !== current.kanban_coluna) {
    throw new Error("Proposta encerrada. Não é possível mover.");
  }

  // ajustes exige motivo
  if (to === "ajustes") {
    const t = String(note ?? "").trim();
    if (!t) throw new Error("Motivo de ajustes é obrigatório.");
  }

  const t = nowIso();

  let next: PropostaAdocao = { ...current, kanban_coluna: to, updated_at: t };

  // move sempre
  next = pushEvent(
    next,
    {
      type: "move",
      at: t,
      actor_role: actor_role || "unknown",
      from,
      to,
    },
    t
  );

  // request_adjustments quando aplicável
  if (to === "ajustes") {
    next = pushEvent(
      next,
      {
        type: "request_adjustments",
        at: t,
        actor_role: actor_role || "unknown",
        from,
        to,
        note: String(note).trim(),
      },
      t
    );
  }

  // terminais
  if (to === "termo_assinado") {
    next = { ...next, closed_status: "approved", closed_at: t };
    next = pushEvent(
      next,
      {
        type: "decision",
        at: t,
        actor_role: actor_role || "unknown",
        decision: "approved",
      },
      t
    );
  }

  if (to === "indeferida") {
    next = { ...next, closed_status: "rejected", closed_at: t };
    next = pushEvent(
      next,
      {
        type: "decision",
        at: t,
        actor_role: actor_role || "unknown",
        decision: "rejected",
        decision_note: note ? String(note) : undefined,
      },
      t
    );
  }

  all[idx] = next;
  writeAll(all);

  // atualiza status da área (após persistir)
  if (to === "termo_assinado") setAreaStatus(next.area_id, "adotada");
  if (to === "indeferida") setAreaStatus(next.area_id, "disponivel");

  return next;
}

/* =========================
   ADOTANTE: ATENDER AJUSTES (EDITAR E/OU SUBSTITUIR DOCS) E REENVIAR
   - A proposta precisa estar em "ajustes"
   - Ao reenviar, VOLTA PARA "protocolo" (como você definiu)
   - Mantém o mesmo codigo_protocolo
   - Registra evento move (ajustes -> protocolo)
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

  // (MVP) trava por owner_role
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
    kanban_coluna: "protocolo", // <- regra: voltou para protocolo
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

  // área continua em adoção (não mexe)

  return next;
}

/**
 * Compat: se sua UI já chama resubmitAfterAdjustments(id, role)
 * agora ela volta para "protocolo" (não mais analise_semad).
 */
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
    for (const ev of p.history ?? []) {
      rows.push({
        ...ev,
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

/**
 * Consolidado por período baseado em EVENTOS (não estado atual)
 */
export function computeConsolidatedByPeriod(fromIso: string, toIso: string) {
  const evs = listEventRowsBetween(fromIso, toIso);

  const protocols_created = evs.filter((e) => e.type === "create").length;

  const entered_semad = evs.filter((e) => e.type === "move" && e.to === "analise_semad").length;
  const entered_ecos = evs.filter((e) => e.type === "move" && e.to === "analise_ecos").length;
  const entered_gov = evs.filter((e) => e.type === "move" && e.to === "decisao").length;

  const adjustments_requested = evs.filter((e) => e.type === "request_adjustments").length;

  const terms_signed =
    evs.filter((e) => e.type === "decision" && e.decision === "approved").length +
    evs.filter((e) => e.type === "move" && e.to === "termo_assinado").length;

  const rejected =
    evs.filter((e) => e.type === "decision" && e.decision === "rejected").length +
    evs.filter((e) => e.type === "move" && e.to === "indeferida").length;

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

/**
 * Produtividade SEMAD por EVENTOS (ator = gestor_semad)
 * - total_moves = moves feitos pela SEMAD no período
 * - total_adjustments_requested = requests de ajustes feitos pela SEMAD no período
 * - proposals_touched = propostas com >=1 evento SEMAD no período
 * - transitions = contagem de transições SEMAD (from->to)
 */
export function computeSemadProductivity(fromIso: string, toIso: string) {
  const evs = listEventRowsBetween(fromIso, toIso);

  const semadMoves = evs.filter((e) => e.actor_role === "gestor_semad" && e.type === "move");
  const semadAdjust = evs.filter(
    (e) => e.actor_role === "gestor_semad" && e.type === "request_adjustments"
  );

  const touched = new Set<string>();
  for (const e of [...semadMoves, ...semadAdjust]) touched.add(e.proposal_id);

  const transCount = new Map<string, number>();
  for (const e of semadMoves) {
    const k = `${e.from ?? "?"}→${e.to ?? "?"}`;
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
  };
}

/**
 * SLA por coluna: tempo de permanência (entrada->saída), com censura em toIso.
 * IMPORTANTE: reconstrói a coluna vigente no início do período (não assume "protocolo").
 */
export function computeSlaByColumn(fromIso: string, toIso: string) {
  const startMs = toMs(fromIso);
  const endMs = toMs(toIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return { by_column: {}, samples: 0 };
  }

  const cols: KanbanColuna[] = [
    "protocolo",
    "analise_semad",
    "analise_ecos",
    "ajustes",
    "decisao",
    "termo_assinado",
    "indeferida",
  ];

  const bucket: Record<string, number[]> = {};
  for (const c of cols) bucket[c] = [];

  const proposals = listProposals();

  for (const p of proposals) {
    const hist = [...(p.history ?? [])].sort((a, b) => String(a.at).localeCompare(String(b.at)));

    // 1) coluna inicial em created_at
    let curCol: KanbanColuna = "protocolo";
    let curAt = toMs(p.created_at);
    if (!Number.isFinite(curAt)) curAt = startMs;

    // 2) “rebobina” até o startMs para descobrir a coluna vigente no início do período
    for (const e of hist) {
      const t = toMs(e.at);
      if (!Number.isFinite(t)) continue;
      if (t >= startMs) break;

      if (e.type === "move" && e.to) {
        curCol = e.to;
        curAt = t;
      }
    }

    // início efetivo de contagem
    curAt = Math.max(curAt, startMs);

    // 3) processa moves dentro do período
    for (const e of hist) {
      const t = toMs(e.at);
      if (!Number.isFinite(t)) continue;
      if (t < startMs) continue;
      if (t > endMs) break;

      if (e.type === "move" && e.to) {
        const segStart = Math.max(curAt, startMs);
        const segEnd = Math.min(t, endMs);

        if (segEnd > segStart) bucket[curCol].push(segEnd - segStart);

        curCol = e.to;
        curAt = t;
      }
    }

    // 4) censura no fim do período
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

  const by_column: Record<
    string,
    { n: number; p50_ms: number | null; p80_ms: number | null; p95_ms: number | null }
  > = {};

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