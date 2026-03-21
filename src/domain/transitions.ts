// src/domain/transitions.ts
import type { KanbanColuna } from "./proposal";

export type TransitionRule = {
  from: KanbanColuna;
  to: KanbanColuna;
  allowed_roles: string[];
  requires_note?: boolean;
  note_label?: string;
  terminal?: boolean;
};

/**
 * Regras canônicas de transição do fluxo de propostas.
 *
 * Observações:
 * - admin pode executar qualquer transição válida do fluxo
 * - solicitar ajustes exige motivo (note)
 * - termo_assinado e indeferida são estados terminais
 */
export const PROPOSAL_TRANSITIONS: readonly TransitionRule[] = [
  {
    from: "protocolo",
    to: "analise_semad",
    allowed_roles: ["administrador", "gestor_semad"],
  },
  {
    from: "analise_semad",
    to: "analise_ecos",
    allowed_roles: ["administrador", "gestor_semad"],
  },
  {
    from: "analise_semad",
    to: "ajustes",
    allowed_roles: ["administrador", "gestor_semad"],
    requires_note: true,
    note_label: "Motivo dos ajustes",
  },
  {
    from: "analise_ecos",
    to: "decisao",
    allowed_roles: ["administrador", "gestor_ecos"],
  },
  {
    from: "analise_ecos",
    to: "ajustes",
    allowed_roles: ["administrador", "gestor_ecos"],
    requires_note: true,
    note_label: "Motivo dos ajustes",
  },
  {
    from: "ajustes",
    to: "analise_semad",
    allowed_roles: ["administrador", "gestor_semad", "gestor_ecos"],
  },
  {
    from: "decisao",
    to: "termo_assinado",
    allowed_roles: ["administrador", "gestor_governo"],
    terminal: true,
  },
  {
    from: "decisao",
    to: "indeferida",
    allowed_roles: ["administrador", "gestor_governo"],
    requires_note: true,
    note_label: "Justificativa do indeferimento",
    terminal: true,
  },
  {
    from: "decisao",
    to: "ajustes",
    allowed_roles: ["administrador", "gestor_governo"],
    requires_note: true,
    note_label: "Motivo dos ajustes",
  },
] as const;

export function getAllowedTransitionsFrom(from: KanbanColuna, role?: string | null): TransitionRule[] {
  const base = PROPOSAL_TRANSITIONS.filter((r) => r.from === from);
  if (!role) return [];
  return base.filter((r) => r.allowed_roles.includes(role));
}

export function findProposalTransition(from: KanbanColuna, to: KanbanColuna): TransitionRule | null {
  return PROPOSAL_TRANSITIONS.find((r) => r.from === from && r.to === to) ?? null;
}

export function canTransitionProposal(role: string | null | undefined, from: KanbanColuna, to: KanbanColuna): boolean {
  if (!role) return false;
  const rule = findProposalTransition(from, to);
  if (!rule) return false;
  return rule.allowed_roles.includes(role);
}

export function requiresNoteForProposalTransition(from: KanbanColuna, to: KanbanColuna): boolean {
  return !!findProposalTransition(from, to)?.requires_note;
}
