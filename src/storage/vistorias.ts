// src/storage/vistorias.ts
import type {
  Vistoria,
  VistoriaAnexoMeta,
  VistoriaChecklist,
  VistoriaEvent,
  VistoriaFase,
  VistoriaLaudo,
  VistoriaStatus,
} from "../domain/vistoria";
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
  const s = String(raw ?? "").trim();
  const allowed: VistoriaStatus[] = ["agendada", "realizada", "laudo_emitido", "cancelada"];
  return (allowed as string[]).includes(s) ? (s as VistoriaStatus) : "agendada";
}

function normFase(raw: any): VistoriaFase {
  const s = String(raw ?? "").trim();
  const allowed: VistoriaFase[] = ["analise_pre_termo", "execucao_pos_termo"];
  return (allowed as string[]).includes(s) ? (s as VistoriaFase) : "analise_pre_termo";
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
    const s = String(v ?? "").trim();
    return (["ok", "pendente", "nao_ok"] as const).includes(s as any) ? (s as any) : "pendente";
  };

  const pickRisco = (v: any) => {
    const s = String(v ?? "").trim();
    return (["baixo", "medio", "alto"] as const).includes(s as any) ? (s as any) : "baixo";
  };

  return {
    acesso: pickItem(raw.acesso),
    iluminacao: pickItem(raw.iluminacao),
    limpeza: pickItem(raw.limpeza),
    sinalizacao: pickItem(raw.sinalizacao),
    risco: pickRisco(raw.risco),
    observacoes: raw.observacoes != null ? String(raw.observacoes) : "",
  };
}

function normAnexos(raw: any): VistoriaAnexoMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      if (!a) return null;
      const tipo = String(a.tipo ?? "arquivo") === "foto" ? "foto" : "arquivo";
      return {
        tipo,
        file_name: String(a.file_name ?? ""),
        file_size: Number(a.file_size ?? 0),
        mime_type: String(a.mime_type ?? "application/octet-stream"),
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
      const type = String(e.type ?? "");
      const actor_role = String(e.actor_role ?? "unknown");
      if (!at || !type) return null;

      return {
        id: String(e.id ?? safeUuid()),
        type,
        at,
        actor_role,
        from_status: e.from_status ? normStatus(e.from_status) : undefined,
        to_status: e.to_status ? normStatus(e.to_status) : undefined,
        note: e.note != null ? String(e.note) : undefined,
      } as VistoriaEvent;
    })
    .filter(Boolean) as VistoriaEvent[];
}

function normalizeVistoria(raw: any): Vistoria {
  const id = String(raw?.id ?? safeUuid());
  const created_at = String(raw?.created_at ?? nowIso());
  const updated_at = String(raw?.updated_at ?? created_at);

  const proposal_id = String(raw?.proposal_id ?? "");
  const agendada_para = String(raw?.agendada_para ?? "");
  const local_texto = String(raw?.local_texto ?? "");

  return {
    id,
    proposal_id,
    codigo_protocolo: raw?.codigo_protocolo ? String(raw.codigo_protocolo) : undefined,
    area_id: raw?.area_id ? String(raw.area_id) : undefined,
    area_nome: raw?.area_nome ? String(raw.area_nome) : undefined,
    fase: normFase(raw?.fase),
    status: normStatus(raw?.status),
    agendada_para,
    local_texto,
    checklist: normChecklist(raw?.checklist),
    observacoes: raw?.observacoes != null ? String(raw.observacoes) : "",
    anexos: normAnexos(raw?.anexos),
    laudo: raw?.laudo ? (raw.laudo as VistoriaLaudo) : null,
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
  const pid = String(proposal_id ?? "").trim();
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
      },
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
      file_name: f.name,
      file_size: f.size,
      mime_type: f.type || "application/octet-stream",
      last_modified: f.lastModified,
    });
  }
  return out;
}

/**
 * CREATE (status inicial = agendada)
 * - agendada_para obrigatório
 * - checklist fixo (campos)
 * - vincula proposal_id e copia area/protocolo se houver
 */
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
  const pid = String(input.proposal_id ?? "").trim();
  if (!pid) throw new Error("proposal_id é obrigatório.");

  const ag = String(input.agendada_para ?? "").trim();
  if (!ag) throw new Error("agendada_para é obrigatório.");

  const loc = String(input.local_texto ?? "").trim();
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
    checklist: input.checklist,
    observacoes: input.observacoes ? String(input.observacoes) : "",
    anexos: Array.isArray(input.anexos) ? input.anexos : [],
    laudo: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    history: [],
  };

  let v = base;
  v = pushEvent(v, {
    type: "create",
    at: v.created_at,
    actor_role: actor_role || "unknown",
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

  const ag = String(agendada_para ?? "").trim();
  if (!ag) throw new Error("agendada_para é obrigatório.");

  let next: Vistoria = { ...current, agendada_para: ag, updated_at: nowIso() };
  next = pushEvent(next, {
    type: "update_schedule",
    at: nowIso(),
    actor_role: actor_role || "unknown",
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
  let next: Vistoria = { ...current, checklist, updated_at: nowIso() };
  next = pushEvent(next, {
    type: "update_checklist",
    at: nowIso(),
    actor_role: actor_role || "unknown",
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
    actor_role: actor_role || "unknown",
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
    actor_role: actor_role || "unknown",
    from_status: current.status,
    to_status: to,
    note: note ? String(note) : undefined,
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

  const concl = String(laudo.conclusao ?? "").trim();
  if (!concl) throw new Error("Conclusão do laudo é obrigatória.");

  const emitido = String(laudo.emitido_em ?? "").trim();
  if (!emitido) throw new Error("emitido_em é obrigatório.");

  const nextLaudo: VistoriaLaudo = {
    conclusao: laudo.conclusao,
    emitido_em: emitido,
    recomendacoes: laudo.recomendacoes ? String(laudo.recomendacoes) : "",
    responsavel_role: actor_role || "unknown",
  };

  // status: realizada -> laudo_emitido (regra)
  let next: Vistoria = { ...current, laudo: nextLaudo, updated_at: nowIso() };
  next = updateVistoriaStatus(id, "laudo_emitido", actor_role, "Laudo emitido");

  // updateVistoriaStatus já persistiu; vamos reabrir e setar laudo corretamente:
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
          type: "emit_laudo",
          at: nowIso(),
          actor_role: actor_role || "unknown",
          note: `Conclusão: ${nextLaudo.conclusao}`,
        },
      ].sort((a, b) => String(a.at).localeCompare(String(b.at))),
    };
    writeAll(all2);
    return all2[idx2];
  }

  return next;
}