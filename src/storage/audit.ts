// src/storage/audit.ts
export type AuditEntity = "proposta" | "area";

export type AuditAction =
  | "criada"
  | "status_alterado"
  | "encaminhada"
  | "solicitado_ajustes"
  | "observacao"
  | "anexo"
  | "outro";

export type AuditLog = {
  id: string;
  at: string; // ISO
  by_role: string; // gestor_semad, gestor_ecos, etc.
  by_label?: string; // opcional: nome/usuario
  entity: AuditEntity;
  entity_id: string;

  action: AuditAction;

  from_status?: string;
  to_status?: string;

  message?: string; // observação/nota
  meta?: Record<string, any>;
};

const KEY = "mvp_audit_v1";

function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readAll(): AuditLog[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditLog[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: AuditLog[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function appendAuditLog(input: Omit<AuditLog, "id" | "at">) {
  const all = readAll();
  const next: AuditLog = { id: safeUuid(), at: nowIso(), ...input };
  all.unshift(next); // mais recente primeiro
  writeAll(all);
  return next;
}

export function listAuditLogs(params?: {
  entity?: AuditEntity;
  entity_id?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  by_role?: string;
}): AuditLog[] {
  const all = readAll();

  const fromMs = params?.from ? new Date(params.from).getTime() : null;
  const toMs = params?.to ? new Date(params.to).getTime() : null;

  return all.filter((l) => {
    if (params?.entity && l.entity !== params.entity) return false;
    if (params?.entity_id && l.entity_id !== params.entity_id) return false;
    if (params?.by_role && l.by_role !== params.by_role) return false;

    const t = new Date(l.at).getTime();
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;

    return true;
  });
}

export function summarizeProductivity(logs: AuditLog[]) {
  const byAction: Record<string, number> = {};
  for (const l of logs) byAction[l.action] = (byAction[l.action] ?? 0) + 1;

  const statusMoves = logs.filter((l) => l.action === "status_alterado");
  const moved = statusMoves.length;

  return { total: logs.length, moved, byAction };
}