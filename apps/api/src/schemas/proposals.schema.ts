// apps/api/src/schemas/proposals.schema.ts
import { z } from "zod";

export const kanbanColunaSchema = z.enum([
  "protocolo",
  "analise_semad",
  "analise_ecos",
  "ajustes",
  "decisao",
  "termo_assinado",
  "indeferida"
]);

export const proposalSchema = z.object({
  id: z.string(),
  codigo_protocolo: z.string(),
  area_id: z.string(),
  area_nome: z.string(),
  descricao_plano: z.string(),
  kanban_coluna: kanbanColunaSchema,
  owner_role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  history: z.array(z.any()),
});

export const proposalListSchema = z.array(proposalSchema);

export const createProposalBodySchema = z.object({
  area_id: z.string().min(1),
  area_nome: z.string().min(1),
  descricao_plano: z.string().min(10),
  owner_role: z.string().min(1),
});
