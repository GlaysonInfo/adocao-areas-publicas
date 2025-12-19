// src/domain/proposal.ts

export type DocumentoTipo = "carta_intencao" | "projeto_resumo";

export type DocumentoMeta = {
  tipo: DocumentoTipo;
  file_name: string;
  file_size: number;
  mime_type: string;
  last_modified: number;
};

export type KanbanColuna =
  | "protocolo"
  | "analise_semad"
  | "analise_ecos"
  | "ajustes"
  | "decisao"
  | "termo_assinado"
  | "indeferida";

export type ProposalEventType = "create" | "move" | "request_adjustments" | "decision";

export type ProposalEvent = {
  id: string;
  type: ProposalEventType;
  at: string; // ISO
  actor_role: string;

  // move / request_adjustments
  from?: KanbanColuna;
  to?: KanbanColuna;

  // request_adjustments
  note?: string;

  // decision
  decision?: "approved" | "rejected";
  decision_note?: string;
};

export type PropostaAdocao = {
  id: string;
  codigo_protocolo: string;

  area_id: string;
  area_nome: string;

  descricao_plano: string;

  kanban_coluna: KanbanColuna;

  documentos: DocumentoMeta[];

  owner_role: string;

  created_at: string;
  updated_at: string;

  // EVENT LOG (fonte de verdade p/ relatórios e SLA)
  history: ProposalEvent[];

  // encerramento (pra bloquear concorrência e liberar área)
  closed_status?: "approved" | "rejected" | null;
  closed_at?: string | null;
};