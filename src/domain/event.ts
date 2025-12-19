// src/domain/event.ts
import type { KanbanColuna } from "./kanban";

export type ProposalEventType = "create" | "move" | "request_adjustments" | "decision";
export type DecisionOutcome = "termo_assinado" | "indeferida";

/**
 * Evento canônico (append-only) usado para relatórios por período e SLA.
 * - at: timestamp ISO
 * - actor_role: perfil que executou a ação
 */
export type ProposalEvent = {
  id: string;
  proposal_id: string;
  area_id: string;

  type: ProposalEventType;
  at: string;
  actor_role: string;

  from_col?: KanbanColuna;
  to_col?: KanbanColuna;

  // obrigatório quando type === "request_adjustments"
  note?: string;

  // usado quando type === "decision"
  outcome?: DecisionOutcome;
};