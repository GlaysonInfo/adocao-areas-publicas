// apps/api/prisma/seed.ts
import { PrismaClient, type AreaStatus, type AreaTipo } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

/**
 * Seed de Áreas a partir de CSV (com separador ";")
 * - Aceita números decimais com vírgula em latitude/longitude (ex.: -19,989128)
 * - Faz upsert por `codigo` (unique)
 *
 * CSV esperado (headers típicos):
 * codigo;nome;tipo;bairro;logradouro;metragem_m2;status;restricoes;ativo;latitude_centro;longitude_centro
 */
function hereDir() {
  const __filename = fileURLToPath(import.meta.url);
  return path.dirname(__filename);
}

function normalizeText(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toBool(v: unknown, fallback = true) {
  const s = normalizeText(v);
  if (!s) return fallback;
  if (["1", "true", "t", "sim", "s", "yes", "y"].includes(s)) return true;
  if (["0", "false", "f", "nao", "não", "n", "no"].includes(s)) return false;
  return fallback;
}

function toInt(v: unknown, fallback = 0) {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloatPt(v: unknown) {
  // aceita "-19,989128" e "-19.989128"
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function mapAreaStatus(v: unknown): AreaStatus {
  const s = normalizeText(v);
  if (s === "em_adocao" || s === "em adocao" || s === "em adoção") return "em_adocao";
  if (s === "adotada") return "adotada";
  if (s === "indisponivel" || s === "indisponivel") return "indisponivel";
  return "disponivel";
}

function mapAreaTipo(v: unknown): AreaTipo {
  const s0 = normalizeText(v);

  // normalizações comuns
  const s = s0
    .replace(/[()]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // mapeamentos por palavras-chave
  if (s.includes("solicitacao") && s.includes("adotante")) return "solicitacao_adotante";
  if (s.includes("area publica") || s.includes("area pública")) return "area_publica";
  if (s === "praca" || s.includes("praca")) return "praca";
  if (s === "parque" || s.includes("parque")) return "parque";
  if (s.includes("campo") && (s.includes("futebol") || s.includes("fut")) ) return "campo_futebol";
  if (s.includes("jardim")) return "jardim";
  if (s.includes("canteiro")) return "canteiro";

  // fallback
  return "outro";
}

function pickCsvPath(): string {
  // prioridade: argumento CLI > env > caminhos comuns
  const arg = process.argv.slice(2).find(Boolean);
  if (arg) return path.resolve(process.cwd(), arg);

  const env = process.env.SEED_CSV;
  if (env) return path.resolve(process.cwd(), env);

  // seed roda a partir de apps/api normalmente
  const base = path.resolve(hereDir(), ".."); // apps/api/prisma -> apps/api

  const candidates = [
    path.resolve(base, "../../data/import/areas_betim_20_simuladas.csv"),
    path.resolve(base, "../../areas_betim_20_simuladas.csv"),
    path.resolve(base, "data/import/areas_betim_20_simuladas.csv"),
    path.resolve(base, "areas_betim_20_simuladas.csv"),
  ];

  return candidates[0]; // tenta o primeiro; erro aponta o caminho
}

type CsvRow = Record<string, string>;

async function main() {
  const csvPath = pickCsvPath();

  const raw = await readFile(csvPath, "utf8");

  // remove BOM, normaliza quebras
  const content = raw.replace(/^\uFEFF/, "");

  const rows = parse(content, {
    columns: true,
    delimiter: ";",          // ✅ importante: arquivo está separado por ";"
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CsvRow[];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`CSV vazio ou inválido em: ${csvPath}`);
  }

  // valida cabeçalhos mínimos
  const sample = rows[0] ?? {};
  const required = ["codigo", "nome", "tipo", "bairro", "metragem_m2"];
  for (const k of required) {
    if (!(k in sample)) {
      throw new Error(
        `CSV sem coluna obrigatória "${k}". Cabeçalhos encontrados: ${Object.keys(sample).join(", ")}`
      );
    }
  }

  let upserted = 0;

  // upsert em lotes para reduzir transação gigante em CSV maior
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    const ops = batch.map((r) => {
      const codigo = String(r.codigo ?? "").trim();
      if (!codigo) return null;

      const nome = String(r.nome ?? "").trim();
      const bairro = String(r.bairro ?? "").trim();

      const logradouroRaw = String(r.logradouro ?? "").trim();
      const logradouro = logradouroRaw ? logradouroRaw : null;

      const metragem_m2 = toInt(r.metragem_m2, 0);
      const status = mapAreaStatus(r.status);
      const tipo = mapAreaTipo(r.tipo);

      const restricoesRaw = String(r.restricoes ?? "").trim();
      const restricoes = restricoesRaw ? restricoesRaw : null;

      const ativo = toBool(r.ativo, true);

      // latitude/longitude existem no CSV, mas não existem no schema (ainda).
      // Mantém parsing apenas para validação futura; não persiste.
      const lat = toFloatPt((r as any).latitude_centro);
      const lng = toFloatPt((r as any).longitude_centro);
      void lat;
      void lng;

      return prisma.area.upsert({
        where: { codigo },
        update: {
          nome,
          tipo,
          bairro,
          logradouro,
          metragem_m2,
          status,
          ativo,
          restricoes,
          // geo_arquivo pode continuar nulo até existir estratégia de geodados
        },
        create: {
          codigo,
          nome,
          tipo,
          bairro,
          logradouro,
          metragem_m2,
          status,
          ativo,
          restricoes,
          geo_arquivo: null,
        },
      });
    }).filter(Boolean);

    if (ops.length) {
      await prisma.$transaction(ops as any[]);
      upserted += ops.length;
    }
  }

  // evidência de execução
  const total = await prisma.area.count();
  console.log(
    JSON.stringify(
      {
        ok: true,
        csvPath,
        rows_read: rows.length,
        upserted,
        total_in_db: total,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });