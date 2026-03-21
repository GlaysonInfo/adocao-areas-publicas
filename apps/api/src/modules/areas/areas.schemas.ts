import { z } from "zod";

export const AreaStatusZ = z.enum(["disponivel", "em_adocao", "adotada", "indisponivel"]);
export const AreaTipoZ = z.enum([
  "area_publica",
  "solicitacao_adotante",
  "praca",
  "parque",
  "campo_futebol",
  "jardim",
  "canteiro",
  "outro",
]);

export const AreaZ = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  nome: z.string(),
  tipo: AreaTipoZ,
  bairro: z.string(),
  logradouro: z.string().nullable().optional(),
  metragem_m2: z.number().int().nonnegative(),
  status: AreaStatusZ,
  ativo: z.boolean(),
  restricoes: z.string().nullable().optional(),
  geo_arquivo: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AreaCreateBodyZ = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  tipo: AreaTipoZ,
  bairro: z.string().min(1),
  logradouro: z.string().optional(),
  metragem_m2: z.number().int().nonnegative(),
  status: AreaStatusZ.optional(),
  ativo: z.boolean().optional(),
  restricoes: z.string().optional(),
  geo_arquivo: z.string().optional(),
});

export const AreaPatchBodyZ = AreaCreateBodyZ.partial();

export const AreasListQueryZ = z.object({
  status: AreaStatusZ.optional(),
  tipo: AreaTipoZ.optional(),
  ativo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v == null ? undefined : v === "true")),
  q: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(200)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0))
    .pipe(z.number().int().min(0)),
});