// apps/api/src/modules/proposals/proposals.schemas.ts
import { z } from "zod";

export const KanbanColunaZ = z.enum([
  "protocolo",
  "analise_semad",
  "analise_ecos",
  "ajustes",
  "decisao",
  "termo_assinado",
  "indeferida",
]);

export const ClosedStatusZ = z.enum(["approved", "rejected"]);

export const ProposalDocumentoZ = z.object({
  id: z.string().uuid().optional(),
  tipo: z.string().min(1),
  file_name: z.string().min(1),
  file_size: z.number().int().nonnegative().optional().nullable(),
  mime_type: z.string().optional().nullable(),
  last_modified: z.number().int().optional().nullable(),
});

export const ProposalEventZ = z.object({
  id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  type: z.string().min(1),
  at: z.string().datetime(),
  actor_role: z.string().min(1),

  from_coluna: KanbanColunaZ.optional().nullable(),
  to_coluna: KanbanColunaZ.optional().nullable(),

  note: z.string().optional().nullable(),
  decision: z.string().optional().nullable(),
  decision_note: z.string().optional().nullable(),
});

export const ProposalZ = z.object({
  id: z.string().uuid(),
  codigo_protocolo: z.string().min(1),

  area_id: z.string().uuid(),
  area_nome: z.string().min(1),

  descricao_plano: z.string().min(1),
  kanban_coluna: KanbanColunaZ,

  owner_role: z.string().min(1),

  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),

  closed_status: ClosedStatusZ.optional().nullable(),
  closed_at: z.string().datetime().optional().nullable(),

  documentos: z.array(ProposalDocumentoZ).optional(),
});

export const ProposalsListQueryZ = z.object({
  q: z.string().optional(),
  area_id: z.string().uuid().optional(),
  owner_role: z.string().optional(),
  kanban_coluna: KanbanColunaZ.optional(),

  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ProposalCreateBodyZ = z.object({
  // opcional: se vier do frontend (MVP). Se não vier, API gera um valor único.
  codigo_protocolo: z.string().min(1).optional(),

  area_id: z.string().uuid(),
  descricao_plano: z.string().min(30),

  owner_role: z.string().min(1),
  actor_role: z.string().min(1),

  documentos: z.array(ProposalDocumentoZ).optional().default([]),
});

export const ProposalMoveBodyZ = z.object({
  to: KanbanColunaZ,
  actor_role: z.string().min(1),
  note: z.string().optional(),

  // reservado p/ governança (override sem vistoria). ainda não aplicado aqui.
  override_reason: z.string().optional(),
});