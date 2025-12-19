// src/storage/area_requests.ts
import type { AreaDraft, AreaRequest, AreaRequestDocumentoMeta, AreaRequestEvent, AreaRequestStatus, SisGeoResultado } from "../domain/area_request";

import type { AreaPublica } from "../domain/area";
import type { PropostaAdocao, DocumentoMeta, DocumentoTipo } from "../domain/proposal";

import { createArea } from "./areas";
import { createProposal } from "./proposals";

const KEY = "mvp_area_requests_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const cb of Array.from(listeners)) cb();
}

export function subscribeAreaRequests(cb: Listener) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readAllRaw(): any[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(all: AreaRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(all));
  emit();
}

function normalizeDocs(raw: any): AreaRequestDocumentoMeta[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((d: any) => ({
      tipo: String(d?.tipo ?? "foto_referencia"),
      file_name: String(d?.file_name ?? "arquivo"),
      file_size: Number(d?.file_size ?? 0),
      mime_type: String(d?.mime_type ?? "application/octet-stream"),
      last_modified: Number(d?.last_modified ?? 0),
    }))
    .filter((d) => !!d.file_name) as AreaRequestDocumentoMeta[];
}

function normalizeHistory(raw: any): AreaRequestEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((e: any) => ({
    ...e,
    id: String(e?.id ?? safeUuid()),
    type: String(e?.type ?? "create"),
    at: String(e?.at ?? nowIso()),
    actor_role: String(e?.actor_role ?? "unknown"),
  })) as AreaRequestEvent[];
}

function normalizeOne(raw: any): AreaRequest {
  const id = String(raw?.id ?? safeUuid());
  const codigo_protocolo = String(raw?.codigo_protocolo ?? "—");
  const status = String(raw?.status ?? "solicitada") as AreaRequestStatus;

  const owner_role = String(raw?.owner_role ?? "adotante_pf");
  const lote = raw?.lote != null ? String(raw.lote) : undefined;
  const quadra = raw?.quadra != null ? String(raw.quadra) : undefined;

  const localizacao_descritiva = String(raw?.localizacao_descritiva ?? "").trim();
  const descricao_intervencao = String(raw?.descricao_intervencao ?? "").trim();

  const geo = raw?.geo
    ? {
        lat: Number(raw.geo.lat),
        lng: Number(raw.geo.lng),
        accuracy_m: raw.geo.accuracy_m != null ? Number(raw.geo.accuracy_m) : undefined,
        captured_at: String(raw.geo.captured_at ?? nowIso()),
      }
    : undefined;

  const documentos = normalizeDocs(raw?.documentos);

  const sisgeo_resultado = raw?.sisgeo_resultado ? (String(raw.sisgeo_resultado) as SisGeoResultado) : undefined;
  const sisgeo_ref = raw?.sisgeo_ref != null ? String(raw.sisgeo_ref) : undefined;
  const sisgeo_note = raw?.sisgeo_note != null ? String(raw.sisgeo_note) : undefined;

  const area_draft = raw?.area_draft
    ? {
        codigo: String(raw.area_draft.codigo ?? ""),
        nome: String(raw.area_draft.nome ?? ""),
        tipo: String(raw.area_draft.tipo ?? ""),
        bairro: String(raw.area_draft.bairro ?? ""),
        logradouro: String(raw.area_draft.logradouro ?? ""),
        metragem_m2: Number(raw.area_draft.metragem_m2 ?? 0),
      }
    : undefined;

  const created_area_id = raw?.created_area_id != null ? String(raw.created_area_id) : undefined;
  const created_proposal_id = raw?.created_proposal_id != null ? String(raw.created_proposal_id) : undefined;

  const created_at = String(raw?.created_at ?? nowIso());
  const updated_at = String(raw?.updated_at ?? created_at);

  const history = normalizeHistory(raw?.history);

  return {
    id,
    codigo_protocolo,
    status,
    owner_role,
    lote,
    quadra,
    localizacao_descritiva,
    geo,
    descricao_intervencao,
    documentos,
    sisgeo_resultado,
    sisgeo_ref,
    sisgeo_note,
    area_draft,
    created_area_id,
    created_proposal_id,
    created_at,
    updated_at,
    history,
  };
}

export function listAreaRequests(): AreaRequest[] {
  return readAllRaw().map(normalizeOne).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function getAreaRequestById(id: string): AreaRequest | null {
  return listAreaRequests().find((r) => r.id === id) ?? null;
}

export function listMyAreaRequests(owner_role: string | null | undefined): AreaRequest[] {
  const role = String(owner_role ?? "");
  if (!role) return [];
  return listAreaRequests().filter((r) => r.owner_role === role);
}

function pushEvent(r: AreaRequest, ev: Omit<AreaRequestEvent, "id">): AreaRequest {
  const e = { ...ev, id: safeUuid() } as AreaRequestEvent;
  return { ...r, history: [...(r.history ?? []), e] };
}

export function createAreaRequest(input: AreaRequest, actor_role: string) {
  const created = input.created_at ?? nowIso();
  const updated = input.updated_at ?? created;

  if (!String(input.localizacao_descritiva ?? "").trim()) throw new Error("Informe a localização descritiva.");
  if (!String(input.descricao_intervencao ?? "").trim()) throw new Error("Informe a descrição da intervenção.");

  const base: AreaRequest = {
    ...input,
    id: input.id ?? safeUuid(),
    status: "solicitada",
    created_at: created,
    updated_at: updated,
    history: input.history ?? [],
  };

  const withEv = pushEvent(base, { type: "create", at: created, actor_role: actor_role || base.owner_role });

  const all = listAreaRequests();
  all.unshift(withEv);
  writeAll(all);
  return withEv;
}

export function startVerification(id: string, actor_role: string) {
  const all = listAreaRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Solicitação não encontrada.");

  const current = all[idx];
  if (current.status === "aprovada" || current.status === "indeferida") throw new Error("Solicitação encerrada.");

  const t = nowIso();
  let next: AreaRequest = { ...current, status: "em_verificacao", updated_at: t };
  next = pushEvent(next, { type: "start_verification", at: t, actor_role: actor_role || "unknown" });

  all[idx] = next;
  writeAll(all);
  return next;
}

export function updateSisGeo(
  id: string,
  input: { sisgeo_resultado: SisGeoResultado; sisgeo_ref?: string; sisgeo_note?: string },
  actor_role: string
) {
  const all = listAreaRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Solicitação não encontrada.");

  const current = all[idx];
  if (current.status === "aprovada" || current.status === "indeferida") throw new Error("Solicitação encerrada.");

  const t = nowIso();
  let next: AreaRequest = {
    ...current,
    status: current.status === "solicitada" ? "em_verificacao" : current.status,
    sisgeo_resultado: input.sisgeo_resultado,
    sisgeo_ref: input.sisgeo_ref,
    sisgeo_note: input.sisgeo_note,
    updated_at: t,
  };

  next = pushEvent(next, {
    type: "sisgeo_update",
    at: t,
    actor_role: actor_role || "unknown",
    sisgeo_resultado: input.sisgeo_resultado,
    sisgeo_ref: input.sisgeo_ref,
    note: input.sisgeo_note,
  });

  all[idx] = next;
  writeAll(all);
  return next;
}

export function setAreaDraft(id: string, draft: AreaDraft) {
  const all = listAreaRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Solicitação não encontrada.");

  const current = all[idx];
  const t = nowIso();
  const next: AreaRequest = { ...current, area_draft: draft, updated_at: t };
  all[idx] = next;
  writeAll(all);
  return next;
}

function mapDocsToProposalDocs(docs: AreaRequestDocumentoMeta[]): DocumentoMeta[] {
  const out: DocumentoMeta[] = [];
  for (const d of docs) {
    if (d.tipo === "carta_intencao" || d.tipo === "projeto_resumo") {
      out.push({
        tipo: d.tipo as DocumentoTipo,
        file_name: d.file_name,
        file_size: d.file_size,
        mime_type: d.mime_type,
        last_modified: d.last_modified,
      });
    }
  }
  return out;
}

export function decideAreaRequest(
  id: string,
  input:
    | { decision: "approved"; decision_note?: string; area_draft: AreaDraft }
    | { decision: "rejected"; decision_note: string },
  actor_role: string
) {
  const all = listAreaRequests();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Solicitação não encontrada.");

  const current = all[idx];
  if (current.status === "aprovada" || current.status === "indeferida") throw new Error("Solicitação encerrada.");

  const t = nowIso();

  if (input.decision === "rejected") {
    const note = String(input.decision_note ?? "").trim();
    if (!note) throw new Error("Informe o motivo do indeferimento.");

    let next: AreaRequest = { ...current, status: "indeferida", updated_at: t };
    next = pushEvent(next, { type: "decision", at: t, actor_role: actor_role || "unknown", decision: "rejected", decision_note: note });

    all[idx] = next;
    writeAll(all);
    return next;
  }

  const draft = input.area_draft;
  if (!draft?.codigo || !draft?.nome || !draft?.tipo) throw new Error("Preencha o cadastro mínimo da área (código/nome/tipo).");

  // 1) cria área
  const area_created: AreaPublica = createArea({
    codigo: draft.codigo,
    nome: draft.nome,
    tipo: draft.tipo,
    bairro: draft.bairro || "—",
    logradouro: draft.logradouro || "—",
    metragem_m2: Number(draft.metragem_m2 ?? 0),
    status: "disponivel",
    ativo: true,
    restricoes: "",
    geo_arquivo: undefined,
  } as any);

  // 2) cria proposta (mesmo protocolo)
  const proposal_id = safeUuid();
  const proposta: PropostaAdocao = {
    id: proposal_id,
    codigo_protocolo: current.codigo_protocolo,
    area_id: area_created.id,
    area_nome: area_created.nome,
    descricao_plano: current.descricao_intervencao,
    kanban_coluna: "protocolo",
    documentos: mapDocsToProposalDocs(current.documentos),
    owner_role: current.owner_role,
    created_at: current.created_at,
    updated_at: t,
    history: [],
  };

  createProposal(proposta, current.owner_role);

  let next: AreaRequest = {
    ...current,
    status: "aprovada",
    area_draft: draft,
    created_area_id: area_created.id,
    created_proposal_id: proposal_id,
    updated_at: t,
  };

  next = pushEvent(next, {
    type: "decision",
    at: t,
    actor_role: actor_role || "unknown",
    decision: "approved",
    decision_note: input.decision_note ? String(input.decision_note) : undefined,
  });

  all[idx] = next;
  writeAll(all);
  return next;
}