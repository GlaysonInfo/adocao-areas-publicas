// src/domain/status.ts
import type { AreaStatus } from "./area";
import type { AreaRequestStatus } from "./area_request";
import type { KanbanColuna } from "./proposal";
import type { VistoriaStatus } from "./vistoria";

/**
 * Dicionário central dos status/etapas canônicos do MVP.
 */
export const AREA_STATUS = ["disponivel", "em_adocao", "adotada"] as const satisfies readonly AreaStatus[];

export const PROPOSAL_KANBAN_COLUMNS = [
  "protocolo",
  "analise_semad",
  "analise_ecos",
  "ajustes",
  "decisao",
  "termo_assinado",
  "indeferida",
] as const satisfies readonly KanbanColuna[];

export const AREA_REQUEST_STATUS = [
  "solicitada",
  "em_verificacao",
  "aprovada",
  "indeferida",
] as const satisfies readonly AreaRequestStatus[];

export const VISTORIA_STATUS = [
  "agendada",
  "realizada",
  "laudo_emitido",
  "cancelada",
] as const satisfies readonly VistoriaStatus[];

export function isAreaStatus(value: unknown): value is AreaStatus {
  return typeof value === "string" && (AREA_STATUS as readonly string[]).includes(value);
}

export function isProposalKanbanColuna(value: unknown): value is KanbanColuna {
  return typeof value === "string" && (PROPOSAL_KANBAN_COLUMNS as readonly string[]).includes(value);
}

export function isAreaRequestStatus(value: unknown): value is AreaRequestStatus {
  return typeof value === "string" && (AREA_REQUEST_STATUS as readonly string[]).includes(value);
}

export function isVistoriaStatus(value: unknown): value is VistoriaStatus {
  return typeof value === "string" && (VISTORIA_STATUS as readonly string[]).includes(value);
}

function normalizeText(raw: unknown) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export function normalizeLegacyAreaStatus(raw: unknown): AreaStatus | null {
  const s = normalizeText(raw);
  if (s === "disponivel") return "disponivel";
  if (s === "disponivel_para_adocao") return "disponivel";
  if (s === "em_adocao" || s === "em_adocao_ativa") return "em_adocao";
  if (s === "adotada" || s === "adotado" || s === "termo_assinado") return "adotada";
  return null;
}

export function normalizeLegacyProposalStatus(raw: unknown): KanbanColuna | null {
  const s = normalizeText(raw);

  if (s === "protocolo") return "protocolo";
  if (s === "analise_semad" || s === "analise_semma") return "analise_semad";
  if (s === "analise_ecos") return "analise_ecos";
  if (s === "ajustes") return "ajustes";
  if (s === "decisao" || s === "decisao_admin") return "decisao";
  if (s === "termo_assinado" || s === "termo_cooperacao") return "termo_assinado";
  if (s === "indeferida") return "indeferida";
  if (s === "interesse") return "protocolo";

  return null;
}

export function normalizeLegacyAreaRequestStatus(raw: unknown): AreaRequestStatus | null {
  const s = normalizeText(raw);
  if (s === "solicitada") return "solicitada";
  if (s === "em_verificacao") return "em_verificacao";
  if (s === "aprovada") return "aprovada";
  if (s === "indeferida") return "indeferida";
  return null;
}

export function normalizeLegacyVistoriaStatus(raw: unknown): VistoriaStatus | null {
  const s = normalizeText(raw);
  if (s === "agendada") return "agendada";
  if (s === "realizada") return "realizada";
  if (s === "laudo_emitido") return "laudo_emitido";
  if (s === "cancelada") return "cancelada";
  return null;
}
