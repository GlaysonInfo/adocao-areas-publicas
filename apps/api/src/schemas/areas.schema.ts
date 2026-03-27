// apps/api/src/schemas/areas.schema.ts
import { z } from "zod";

export const areaStatusSchema = z.enum(["disponivel", "em_adocao", "adotada"]);

export const areaSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  nome: z.string(),
  tipo: z.string(),
  bairro: z.string(),
  logradouro: z.string(),
  metragem_m2: z.number(),
  status: areaStatusSchema,
  ativo: z.boolean(),
});

export const areaListSchema = z.array(areaSchema);
