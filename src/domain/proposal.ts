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

/**
 * EVENT LOG (fonte de verdade p/ relatórios, produtividade e SLA)
 *
 * - create: criação do protocolo
 * - move: movimentação no Kanban
 * - request_adjustments: solicitação de ajustes (evento canônico pro adotante)
 * - decision: decisão terminal (approved/rejected)
 * - override_no_vistoria: exceção deliberada (seguir fluxo sem vistoria pré-adoção)
 */
export type ProposalEventType =
  | "create"
  | "move"
  | "request_adjustments"
  | "decision"
  | "override_no_vistoria";

export type ProposalEvent = {
  id: string;
  type: ProposalEventType;
  at: string; // ISO
  actor_role: string;

  // move / request_adjustments / override_no_vistoria
  from?: KanbanColuna;
  to?: KanbanColuna;

  /**
   * Texto livre / motivo:
   * - request_adjustments: orientações ao adotante
   * - move: observação (opcional)
   * - override_no_vistoria: justificativa obrigatória do override (regra na storage/UI)
   */
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