// apps/api/src/schemas/vistorias.schema.ts
import { z } from "zod";

export const vistoriaStatusSchema = z.enum([
  "agendada",
  "realizada",
  "laudo_emitido",
  "cancelada"
]);

export const vistoriaSchema = z.object({
  id: z.string(),
  proposal_id: z.string(),
  fase: z.string(),
  status: vistoriaStatusSchema,
  agendada_para: z.string(),
  local_texto: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  history: z.array(z.any()),
});

export const vistoriaListSchema = z.array(vistoriaSchema);
