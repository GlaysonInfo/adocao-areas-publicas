// apps/api/src/modules/vistorias/vistorias.schemas.ts
import { z } from "zod";

export const VistoriaFaseZ = z.enum(["analise", "vigencia"]);
export type VistoriaFase = z.infer<typeof VistoriaFaseZ>;

export const VistoriaStatusZ = z.enum(["rascunho", "agendada", "executada", "laudo_emitido", "cancelada"]);
export type VistoriaStatus = z.infer<typeof VistoriaStatusZ>;

export const LaudoConclusaoZ = z.enum(["favoravel", "favoravel_com_ressalvas", "desfavoravel"]);
export type LaudoConclusao = z.infer<typeof LaudoConclusaoZ>;

export const GeoZ = z
  .object({
    lat: z.number(),
    lng: z.number(),
    accuracy_m: z.number().optional(),
    captured_at: z.string().datetime().optional(),
  })
  .strict();

export const VistoriaCreateBodyZ = z
  .object({
    proposal_id: z.string().uuid(),
    fase: VistoriaFaseZ.default("analise"),
    local_texto: z.string().min(3),
    checklist_json: z.any().optional(),
    observacoes: z.string().optional(),
    actor_role: z.string().min(1),
  })
  .strict();

export const VistoriaScheduleBodyZ = z
  .object({
    agendada_para: z.string().datetime(),
    actor_role: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

export const VistoriaExecuteBodyZ = z
  .object({
    local_texto: z.string().min(3),
    geo: GeoZ.optional(),
    checklist_json: z.any().optional(),
    observacoes: z.string().optional(),
    actor_role: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

export const VistoriaIssueLaudoBodyZ = z
  .object({
    conclusao: LaudoConclusaoZ,
    recomendacoes: z.string().optional(),
    actor_role: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

export const VistoriasListQueryZ = z
  .object({
    proposal_id: z.string().uuid().optional(),
    fase: VistoriaFaseZ.optional(),
    status: VistoriaStatusZ.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const PaginationQueryZ = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const VistoriaEventZ = z
  .object({
    id: z.string().uuid(),
    vistoria_id: z.string().uuid(),
    type: z.string(),
    at: z.string().datetime(),
    actor_role: z.string(),
    payload: z.any().nullable(),
  })
  .strict();

export const VistoriaZ = z
  .object({
    id: z.string().uuid(),
    proposal_id: z.string().uuid(),
    fase: VistoriaFaseZ,
    status: VistoriaStatusZ,

    local_texto: z.string(),

    geo: z.any().nullable(),
    checklist_json: z.any().nullable(),
    observacoes: z.string().nullable(),

    agendada_para: z.string().datetime().nullable(),
    executada_em: z.string().datetime().nullable(),

    laudo_conclusao: LaudoConclusaoZ.nullable(),
    laudo_recomendacoes: z.string().nullable(),
    laudo_emitido_em: z.string().datetime().nullable(),

    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

export const VistoriaDetailZ = VistoriaZ.extend({
  history: z.array(VistoriaEventZ),
});

export const VistoriasListResponseZ = z.object({
  items: z.array(VistoriaZ),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export const VistoriaEventsResponseZ = z.object({
  items: z.array(VistoriaEventZ),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});