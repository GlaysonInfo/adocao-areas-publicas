// src/domain/area_request.ts
export type AreaRequestStatus = "solicitada" | "em_verificacao" | "aprovada" | "indeferida";

export type AreaRequestDocumentoTipo = "carta_intencao" | "projeto_resumo" | "foto_referencia";

export type AreaRequestDocumentoMeta = {
  tipo: AreaRequestDocumentoTipo;
  file_name: string;
  file_size: number;
  mime_type: string;
  last_modified: number;
};

export type GeoCapture = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  captured_at: string;
};

export type SisGeoResultado =
  | "publica_disponivel"
  | "publica_indisponivel"
  | "nao_publica"
  | "nao_encontrada"
  | "uso_incompativel";

export type AreaRequestEvent =
  | { id: string; type: "create"; at: string; actor_role: string }
  | { id: string; type: "start_verification"; at: string; actor_role: string }
  | {
      id: string;
      type: "sisgeo_update";
      at: string;
      actor_role: string;
      sisgeo_resultado: SisGeoResultado;
      sisgeo_ref?: string;
      note?: string;
    }
  | {
      id: string;
      type: "decision";
      at: string;
      actor_role: string;
      decision: "approved" | "rejected";
      decision_note?: string;
    };

export type AreaDraft = {
  codigo: string;
  nome: string;
  tipo: string;
  bairro: string;
  logradouro: string;
  metragem_m2: number;
};

export type AreaRequest = {
  id: string;
  codigo_protocolo: string;

  status: AreaRequestStatus;
  owner_role: string;

  // Identificação informada pelo adotante
  lote?: string;
  quadra?: string;
  localizacao_descritiva: string;

  // Opcional
  geo?: GeoCapture;

  // Intervenção pretendida
  descricao_intervencao: string;

  // Metadados de anexos (MVP)
  documentos: AreaRequestDocumentoMeta[];

  // Preenchido pelo gestor
  sisgeo_resultado?: SisGeoResultado;
  sisgeo_ref?: string;
  sisgeo_note?: string;

  // Rascunho do cadastro da área
  area_draft?: AreaDraft;

  // Links gerados na aprovação
  created_area_id?: string;
  created_proposal_id?: string;

  created_at: string;
  updated_at: string;

  history: AreaRequestEvent[];
};