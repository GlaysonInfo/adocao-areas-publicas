// apps/api/src/schemas/area-requests.schema.ts
import { z } from "zod";

export const areaRequestStatusSchema = z.enum([
  "solicitada",
  "em_verificacao",
  "aprovada",
  "indeferida",
]);

export const sisGeoResultadoSchema = z.enum([
  "publica_disponivel",
  "publica_indisponivel",
  "nao_publica",
  "nao_encontrada",
  "uso_incompativel",
]);

export const areaDraftSchema = z.object({
  codigo: z.string(),
  nome: z.string(),
  tipo: z.string(),
  bairro: z.string(),
  logradouro: z.string(),
  metragem_m2: z.number(),
});

export const areaRequestSchema = z.object({
  id: z.string(),
  codigo_protocolo: z.string(),
  status: areaRequestStatusSchema,
  owner_role: z.string(),
  lote: z.string().optional(),
  quadra: z.string().optional(),
  localizacao_descritiva: z.string(),
  geo: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy_m: z.number().optional(),
      captured_at: z.string(),
    })
    .optional(),
  descricao_intervencao: z.string(),
  documentos: z.array(
    z.object({
      tipo: z.string(),
      file_name: z.string(),
      file_size: z.number(),
      mime_type: z.string(),
      last_modified: z.number(),
    })
  ),
  sisgeo_resultado: sisGeoResultadoSchema.optional(),
  sisgeo_ref: z.string().optional(),
  sisgeo_note: z.string().optional(),
  area_draft: areaDraftSchema.optional(),
  created_area_id: z.string().optional(),
  created_proposal_id: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  history: z.array(z.any()),
});

export const areaRequestListSchema = z.array(areaRequestSchema);

export const createAreaRequestBodySchema = z.object({
  codigo_protocolo: z.string(),
  owner_role: z.string().min(1),
  lote: z.string().optional(),
  quadra: z.string().optional(),
  localizacao_descritiva: z.string().min(3),
  geo: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy_m: z.number().optional(),
      captured_at: z.string(),
    })
    .optional(),
  descricao_intervencao: z.string().min(5),
  documentos: z
    .array(
      z.object({
        tipo: z.string(),
        file_name: z.string(),
        file_size: z.number(),
        mime_type: z.string(),
        last_modified: z.number(),
      })
    )
    .default([]),
});

export const startVerificationBodySchema = z.object({
  actor_role: z.string().min(1),
});

export const updateSisGeoBodySchema = z.object({
  actor_role: z.string().min(1),
  sisgeo_resultado: sisGeoResultadoSchema,
  sisgeo_ref: z.string().optional(),
  sisgeo_note: z.string().optional(),
});

export const decideAreaRequestBodySchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approved"),
    actor_role: z.string().min(1),
    decision_note: z.string().optional(),
    area_draft: areaDraftSchema,
  }),
  z.object({
    decision: z.literal("rejected"),
    actor_role: z.string().min(1),
    decision_note: z.string().min(1),
  }),
]);