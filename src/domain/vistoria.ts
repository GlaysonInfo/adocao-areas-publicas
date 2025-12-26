// src/domain/vistoria.ts

export type VistoriaFase = "analise_pre_termo" | "execucao_pos_termo";

export type VistoriaStatus = "agendada" | "realizada" | "laudo_emitido" | "cancelada";

export type VistoriaChecklistItem = "ok" | "pendente" | "nao_ok";
export type VistoriaRisco = "baixo" | "medio" | "alto";

export type VistoriaChecklist = {
  acesso: VistoriaChecklistItem;
  iluminacao: VistoriaChecklistItem;
  limpeza: VistoriaChecklistItem;
  sinalizacao: VistoriaChecklistItem;
  risco: VistoriaRisco;
  observacoes?: string;
};

export type VistoriaAnexoTipo = "foto" | "arquivo";

export type VistoriaAnexoMeta = {
  tipo: VistoriaAnexoTipo;
  file_name: string;
  file_size: number;
  mime_type: string;
  last_modified: number;
};

export type VistoriaLaudoConclusao = "favoravel" | "desfavoravel" | "com_ressalvas";

export type VistoriaLaudo = {
  conclusao: VistoriaLaudoConclusao;
  emitido_em: string; // ISO
  recomendacoes?: string;
  responsavel_role: string; // role (ex.: gestor_semad)
};

export type VistoriaEventType =
  | "create"
  | "update_schedule"
  | "status_change"
  | "update_checklist"
  | "add_anexos"
  | "emit_laudo";

export type VistoriaEvent = {
  id: string;
  type: VistoriaEventType;
  at: string; // ISO
  actor_role: string;

  from_status?: VistoriaStatus;
  to_status?: VistoriaStatus;

  note?: string;
};

export type Vistoria = {
  id: string;

  proposal_id: string;

  // redundância útil p/ telas (MVP/localStorage)
  codigo_protocolo?: string;
  area_id?: string;
  area_nome?: string;

  fase: VistoriaFase;
  status: VistoriaStatus;

  // agendamento obrigatório no create
  agendada_para: string; // ISO

  local_texto: string;

  checklist: VistoriaChecklist;

  observacoes?: string;

  anexos: VistoriaAnexoMeta[];

  laudo?: VistoriaLaudo | null;

  created_at: string;
  updated_at: string;

  history: VistoriaEvent[];
};