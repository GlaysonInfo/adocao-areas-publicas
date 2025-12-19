import type { KanbanColuna } from "./proposal";

export type HistoryAction =
  | "create"
  | "move"
  | "request_adjustments"
  | "resubmit_adjustments";

export type HistoryEvent = {
  id: string;
  timestamp: string; // ISO
  actor_role: string; // ex.: adotante_pf, gestor_semad...
  action: HistoryAction;
  from_col?: KanbanColuna;
  to_col?: KanbanColuna;
  comment?: string;
};