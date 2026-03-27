// src/storage/vistorias.ts
import type {
  Vistoria,
  VistoriaAnexoMeta,
  VistoriaChecklist,
  VistoriaEvent,
  VistoriaFase,
  VistoriaLaudo,
  VistoriaLaudoConclusao,
  VistoriaStatus,
} from "../domain/vistoria";
import { sanitizeText } from "../lib/text-normalize";
import { getProposalById } from "./proposals";

const KEY = "mvp_vistorias_v1";

type Unsub = () => void;
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const cb of Array.from(listeners)) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

export function subscribeVistorias(cb: Listener): Unsub {
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
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

function writeAll(items: Vistoria[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emit();
}

function normStatus(raw: any): VistoriaStatus {
  const s = sanitizeText(raw);
  const allowed: VistoriaStatus[] = ["agendada", "realizada", "laudo_emitido", "cancelada"];
  return (allowed as string[]).includes(s) ? (s as VistoriaStatus) : "agendada";
}

function normFase(raw: any): VistoriaFase {
  const s = sanitizeText(raw);
  const allowed: VistoriaFase[] = ["analise_pre_termo", "execucao_pos_termo"];
  return (allowed as string[]).includes(s) ? (s as VistoriaFase) : "analise_pre_termo";
}

function normConclusao(raw: any): VistoriaLaudoConclusao {
  const s = sanitizeText(raw).toLowerCase();

  if (s === "favoravel") return "favoravel";
  if (s === "com_ressalvas") return "com_ressalvas";
  if (s === "com ressalvas") return "com_ressalvas";
  if (s === "desfavoravel") return "desfavoravel";

  return "favoravel";
}

function normChecklist(raw: any): VistoriaChecklist {
  const fallback: VistoriaChecklist = {
    acesso: "pendente",
    iluminacao: "pendente",
    limpeza: "pendente",
    sinalizacao: "pendente",
    risco: "baixo",
    observacoes: "",
  };

  if (!raw || typeof raw !== "object") return fallback;

  const pickItem = (v: any) => {
    const s = sanitizeText(v);
    return (["ok", "pendente", "nao_ok"] as const).includes(s as any) ? (s as any) : "pendente";
  };

  const pickRisco = (v: any) => {
    const s = sanitizeText(v);
    return (["baixo", "medio", "alto"] as const).includes(s as any) ? (s as any) : "baixo";
  };

  return {
    acesso: pickItem(raw.acesso),
    iluminacao: pickItem(raw.iluminacao),
    limpeza: pickItem(raw.limpeza),
    sinalizacao: pickItem(raw.sinalizacao),
    risco: pickRisco(raw.risco),
    observacoes: sanitizeText(raw.observacoes),
  };
}

function normAnexos(raw: any): VistoriaAnexoMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      if (!a) return null;
      const tipo = sanitizeText(a.tipo, "arquivo") === "foto" ? "foto" : "arquivo";
      return {
        tipo,
        file_name: sanitizeText(a.file_name),
        file_size: Number(a.file_size ?? 0),
        mime_type: sanitizeText(a.mime_type ?? "application/octet-stream", "application/octet-stream"),
        last_modified: Number(a.last_modified ?? 0),
      } as VistoriaAnexoMeta;
    })
    .filter(Boolean) as VistoriaAnexoMeta[];
}

function normHistory(raw: any): VistoriaEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      if (!e) return null;

      const at = String(e.at ?? "");
      const type = sanitizeText(e.type);
      const actor_role = sanitizeText(e.actor_role, "unknown");
      if (!at || !type) return null;

      return {
        id: String(e.id ?? safeUuid()),
        type: type as VistoriaEvent["type"],
        at,
        actor_role,
        from_status: e.from_status ? normStatus(e.from_status) : undefined,
        to_status: e.to_status ? normStatus(e.to_status) : undefined,
        note: e.note != null ? sanitizeText(e.note) : undefined,
      } as VistoriaEvent;
    })
    .filter(Boolean) as VistoriaEvent[];
}

function normalizeVistoria(raw: any): Vistoria {
  const id = String(raw?.id ?? safeUuid());
  const created_at = String(raw?.created_at ?? nowIso());
  const updated_at = String(raw?.updated_at ?? created_at);

  const proposal_id = sanitizeText(raw?.proposal_id);
  const agendada_para = sanitizeText(raw?.agendada_para);
  const local_texto = sanitizeText(raw?.local_texto);

  return {
    id,
    proposal_id,
    codigo_protocolo: raw?.codigo_protocolo ? sanitizeText(raw.codigo_protocolo) : undefined,
    area_id: raw?.area_id ? sanitizeText(raw.area_id) : undefined,
    area_nome: raw?.area_nome ? sanitizeText(raw.area_nome) : undefined,
    fase: normFase(raw?.fase),
    status: normStatus(raw?.status),
    agendada_para,
    local_texto,
    checklist: normChecklist(raw?.checklist),
    observacoes: sanitizeText(raw?.observacoes),
    anexos: normAnexos(raw?.anexos),
    laudo: raw?.laudo
      ? {
          conclusao: normConclusao(raw.laudo.conclusao),
          emitido_em: String(raw.laudo.emitido_em ?? ""),
          recomendacoes: sanitizeText(raw.laudo.recomendacoes),
          responsavel_role: sanitizeText(raw.laudo.responsavel_role, "unknown"),
        }
      : null,
    created_at,
    updated_at,
    history: normHistory(raw?.history),
  };
}

export function listVistorias(): Vistoria[] {
  return readAllRaw().map(normalizeVistoria);
}

export function listVistoriasByProposal(proposal_id: string): Vistoria[] {
  const all = listVistorias();
  const pid = sanitizeText(proposal_id);
  return all
    .filter((v) => v.proposal_id === pid)
    .sort((a, b) => String(a.agendada_para).localeCompare(String(b.agendada_para)));
}

export function getVistoriaById(id: string): Vistoria | null {
  const all = listVistorias();
  return all.find((v) => v.id === id) ?? null;
}

function pushEvent(v: Vistoria, ev: Omit<VistoriaEvent, "id">): Vistoria {
  const next: Vistoria = {
    ...v,
    updated_at: nowIso(),
    history: [
      ...(v.history ?? []),
      {
        id: safeUuid(),
        ...ev,
      } as VistoriaEvent,
    ],
  };
  next.history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return next;
}

function assertTransition(from: VistoriaStatus, to: VistoriaStatus) {
  if (from === to) return;

  const allowed: Record<VistoriaStatus, VistoriaStatus[]> = {
    agendada: ["realizada", "cancelada"],
    realizada: ["laudo_emitido"],
    laudo_emitido: [],
    cancelada: [],
  };

  if (!allowed[from].includes(to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`);
  }
}

function fileMeta(list: FileList, tipo: "foto" | "arquivo"): VistoriaAnexoMeta[] {
  const out: VistoriaAnexoMeta[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list.item(i);
    if (!f) continue;
    out.push({
      tipo,
      file_name: sanitizeText(f.name),
      file_size: f.size,
      mime_type: sanitizeText(f.type || "application/octet-stream", "application/octet-stream"),
      last_modified: f.lastModified,
    });
  }
  return out;
}

export function createVistoria(
  input: {
    proposal_id: string;
    fase: VistoriaFase;
    agendada_para: string;
    local_texto: string;
    checklist: VistoriaChecklist;
    observacoes?: string;
    anexos?: VistoriaAnexoMeta[];
  },
  actor_role: string
) {
  const pid = sanitizeText(input.proposal_id);
  if (!pid) throw new Error("proposal_id é obrigatório.");

  const ag = sanitizeText(input.agendada_para);
  if (!ag) throw new Error("agendada_para é obrigatório.");

  const loc = sanitizeText(input.local_texto);
  if (!loc) throw new Error("Localização (texto) é obrigatória.");

  const proposal = getProposalById(pid);
  const base: Vistoria = {
    id: safeUuid(),
    proposal_id: pid,
    codigo_protocolo: proposal?.codigo_protocolo,
    area_id: proposal?.area_id,
    area_nome: proposal?.area_nome,
    fase: input.fase,
    status: "agendada",
    agendada_para: ag,
    local_texto: loc,
    checklist: normChecklist(input.checklist),
    observacoes: sanitizeText(input.observacoes),
    anexos: Array.isArray(input.anexos) ? normAnexos(input.anexos) : [],
    laudo: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    history: [],
  };

  let v = base;
  v = pushEvent(v, {
    type: "create",
    at: v.created_at,
    actor_role: sanitizeText(actor_role, "unknown"),
  });

  const all = listVistorias();
  all.unshift(v);
  writeAll(all);

  return v;
}

export function updateVistoriaSchedule(id: string, agendada_para: string, actor_role: string) {
  const all = listVistorias();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error("Vistoria não encontrada.");

  const current = all[idx];
  if (current.status !== "agendada") {
    throw new Error("Só é possível alterar agendamento quando a vistoria está 'agendada'.");
  }

  const ag = sanitizeText(agendada_para);
  if (!ag) throw new Error("agendada_para é obrigatório.");

  let next: Vistoria = { ...current, agendada_para: ag, updated_at: nowIso() };
  next = pushEvent(next, {
    type: "update_schedule",
    at: nowIso(),
    actor_role: sanitizeText(actor_role, "unknown"),
    note: `Agendamento atualizado para ${ag}`,
  });

  all[idx] = next;
  writeAll(all);
  return next;
}

export function updateVistoriaChecklist(id: string, checklist: VistoriaChecklist, actor_role: string) {
  const all = listVistorias();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error("Vistoria não encontrada.");

  const current = all[idx];
  let next: Vistoria = { ...current, checklist: normChecklist(checklist), updated_at: nowIso() };
  next = pushEvent(next, {
    type: "update_checklist",
    at: nowIso(),
    actor_role: sanitizeText(actor_role, "unknown"),
  });

  all[idx] = next;
  writeAll(all);
  return next;
}

export function addVistoriaAnexos(id: string, files: FileList, tipo: "foto" | "arquivo", actor_role: string) {
  const all = listVistorias();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error("Vistoria não encontrada.");

  const current = all[idx];
  if (!(files instanceof FileList) || files.length === 0) return current;

  const metas = fileMeta(files, tipo);

  let next: Vistoria = {
    ...current,
    anexos: [...(current.anexos ?? []), ...metas],
    updated_at: nowIso(),
  };

  next = pushEvent(next, {
    type: "add_anexos",
    at: nowIso(),
    actor_role: sanitizeText(actor_role, "unknown"),
    note: `+${metas.length} anexo(s)`,
  });

  all[idx] = next;
  writeAll(all);
  return next;
}

export function updateVistoriaStatus(id: string, to: VistoriaStatus, actor_role: string, note?: string) {
  const all = listVistorias();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error("Vistoria não encontrada.");

  const current = all[idx];
  assertTransition(current.status, to);

  let next: Vistoria = { ...current, status: to, updated_at: nowIso() };
  next = pushEvent(next, {
    type: "status_change",
    at: nowIso(),
    actor_role: sanitizeText(actor_role, "unknown"),
    from_status: current.status,
    to_status: to,
    note: note ? sanitizeText(note) : undefined,
  });

  all[idx] = next;
  writeAll(all);
  return next;
}

export function emitVistoriaLaudo(id: string, laudo: Omit<VistoriaLaudo, "responsavel_role">, actor_role: string) {
  const all = listVistorias();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error("Vistoria não encontrada.");

  const current = all[idx];
  if (current.status !== "realizada") {
    throw new Error("Para emitir laudo, a vistoria precisa estar 'realizada'.");
  }

  const concl = normConclusao(laudo.conclusao);
  const emitido = sanitizeText(laudo.emitido_em);
  if (!emitido) throw new Error("emitido_em é obrigatório.");

  const nextLaudo: VistoriaLaudo = {
    conclusao: concl,
    emitido_em: emitido,
    recomendacoes: sanitizeText(laudo.recomendacoes),
    responsavel_role: sanitizeText(actor_role, "unknown"),
  };

  let next: Vistoria = { ...current, laudo: nextLaudo, updated_at: nowIso() };
  next = updateVistoriaStatus(id, "laudo_emitido", actor_role, "Laudo emitido");

  const all2 = listVistorias();
  const idx2 = all2.findIndex((v) => v.id === id);

  if (idx2 >= 0) {
    all2[idx2] = {
      ...all2[idx2],
      laudo: nextLaudo,
      updated_at: nowIso(),
      history: [
        ...(all2[idx2].history ?? []),
        {
          id: safeUuid(),
          type: "emit_laudo" as const,
          at: nowIso(),
          actor_role: sanitizeText(actor_role, "unknown"),
          note: `Conclusão: ${nextLaudo.conclusao}`,
        } as VistoriaEvent,
      ].sort((a, b) => String(a.at).localeCompare(String(b.at))),
    };

    writeAll(all2);
    return all2[idx2];
  }

  return next;
}