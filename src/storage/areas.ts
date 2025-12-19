// src/storage/areas.ts
import type { AreaPublica, AreaStatus, AreaArquivoMeta } from "../domain/area";
import { mock_areas } from "../mock/areas";

const KEY = "mvp_areas_v1";
const SEEDED = "mvp_areas_seeded_v1";
const DISABLE_SEED = "mvp_areas_disable_seed_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const cb of Array.from(listeners)) cb();
}

export function subscribeAreas(cb: Listener) {
  listeners.add(cb);

  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function stripAccents(s: string) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeStatus(raw: string): AreaStatus | null {
  const s = stripAccents(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (s === "disponivel" || s === "disponivel_para_adocao") return "disponivel";
  if (s === "em_adocao" || s === "em_adocao") return "em_adocao";
  if (s === "adotada" || s === "adotado") return "adotada";
  return null;
}

function parseBool(raw: unknown, fallback: boolean) {
  if (raw == null) return fallback;
  const s = stripAccents(String(raw)).toLowerCase().trim();
  if (["1", "true", "sim", "s", "ativo", "ativa", "yes", "y"].includes(s)) return true;
  if (["0", "false", "nao", "não", "n", "inativo", "inativa", "no"].includes(s)) return false;
  return fallback;
}

function parseNumberBR(raw: unknown): number | null {
  const s0 = String(raw ?? "").trim();
  if (!s0) return null;

  const hasComma = s0.includes(",");
  let s = s0;

  if (hasComma) s = s.replace(/\./g, "").replace(",", ".");
  s = s.replace(/[^\d.-]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeArea(raw: any, idx: number): AreaPublica {
  const id = String(raw?.id ?? safeUuid());
  const codigo = String(
    raw?.codigo ?? raw?.codigo_area ?? raw?.code ?? `AREA-${String(idx + 1).padStart(4, "0")}`
  ).trim();

  const nome = String(raw?.nome ?? raw?.area_nome ?? "—").trim();
  const tipo = String(raw?.tipo ?? raw?.categoria ?? "—").trim();
  const bairro = String(raw?.bairro ?? "—").trim();
  const logradouro = String(raw?.logradouro ?? raw?.endereco ?? "—").trim();

  const metragem_m2 =
    typeof raw?.metragem_m2 === "number"
      ? raw.metragem_m2
      : parseNumberBR(raw?.metragem_m2 ?? raw?.metragem ?? 0) ?? 0;

  const status: AreaStatus =
    (raw?.status as AreaStatus) || normalizeStatus(String(raw?.status ?? "")) || "disponivel";

  const ativo = typeof raw?.ativo === "boolean" ? raw.ativo : parseBool(raw?.ativo, true);
  const restricoes = raw?.restricoes ? String(raw.restricoes) : undefined;

  const latitude_centro =
    raw?.latitude_centro != null ? parseNumberBR(raw.latitude_centro) ?? undefined : undefined;

  const longitude_centro =
    raw?.longitude_centro != null ? parseNumberBR(raw.longitude_centro) ?? undefined : undefined;

  const geo_arquivo: AreaArquivoMeta | undefined = raw?.geo_arquivo ?? undefined;

  const created_at = String(raw?.created_at ?? nowIso());
  const updated_at = String(raw?.updated_at ?? nowIso());

  return {
    id,
    codigo,
    nome,
    tipo,
    bairro,
    logradouro,
    metragem_m2,
    status,
    ativo,
    restricoes,
    latitude_centro,
    longitude_centro,
    geo_arquivo,
    created_at,
    updated_at,
  };
}

function readAllRaw(): any[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: AreaPublica[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  emit();
}

function ensureSeeded() {
  if (localStorage.getItem(DISABLE_SEED)) return; // <- não semeia em modo teste CSV

  if (localStorage.getItem(SEEDED)) return;

  const existing = readAllRaw();
  if (existing.length > 0) {
    localStorage.setItem(SEEDED, "1");
    return;
  }

  const seeded = (mock_areas ?? []).map((a: any, i: number) => normalizeArea(a, i));
  writeAll(seeded);
  localStorage.setItem(SEEDED, "1");
}

/** Zera o cadastro e desativa o seed do mock (modo teste de importação CSV). */
export function clearAreasForImportTesting() {
  localStorage.setItem(DISABLE_SEED, "1");
  localStorage.setItem(SEEDED, "1");
  localStorage.removeItem(KEY);
  emit();
}

/** Lista todas (admin). */
export function listAreas(): AreaPublica[] {
  ensureSeeded();
  return readAllRaw().map((a, i) => normalizeArea(a, i));
}

/** Lista para público (somente ativas). */
export function listAreasPublic(): AreaPublica[] {
  return listAreas().filter((a) => a.ativo);
}

export function getAreaById(id: string): AreaPublica | null {
  const all = listAreas();
  return all.find((a) => a.id === id) ?? null;
}

export function getAreaByCodigo(codigo: string): AreaPublica | null {
  const all = listAreas();
  const c = String(codigo ?? "").trim();
  return all.find((a) => a.codigo === c) ?? null;
}

export function upsertArea(area: AreaPublica) {
  const all = listAreas();
  const idxById = all.findIndex((a) => a.id === area.id);
  const idxByCodigo = all.findIndex((a) => a.codigo === area.codigo);

  const next = { ...area, updated_at: nowIso() };

  if (idxById >= 0) all[idxById] = next;
  else if (idxByCodigo >= 0) all[idxByCodigo] = { ...all[idxByCodigo], ...next };
  else all.unshift({ ...next, created_at: nowIso() });

  writeAll(all);
}

export function createArea(input: Omit<AreaPublica, "id" | "created_at" | "updated_at">) {
  const area: AreaPublica = {
    ...input,
    id: safeUuid(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  upsertArea(area);
  return area;
}

export function setAreaActive(id: string, ativo: boolean) {
  const all = listAreas();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;

  all[idx] = { ...all[idx], ativo, updated_at: nowIso() };
  writeAll(all);
}

export function setAreaStatus(id: string, status: AreaStatus) {
  const all = listAreas();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;

  all[idx] = { ...all[idx], status, updated_at: nowIso() };
  writeAll(all);
}

export function setAreaGeoFile(id: string, file: AreaArquivoMeta | undefined) {
  const all = listAreas();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return;

  all[idx] = { ...all[idx], geo_arquivo: file, updated_at: nowIso() };
  writeAll(all);
}

/* =========================
   IMPORTAÇÃO CSV
========================= */

export type ImportReport = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

function guessDelimiter(headerLine: string) {
  const semicol = (headerLine.match(/;/g) ?? []).length;
  const comma = (headerLine.match(/,/g) ?? []).length;
  return semicol >= comma ? ";" : ",";
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delim = guessDelimiter(lines[0]);

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === delim) {
        out.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h) =>
    stripAccents(h).toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export function importAreasFromCSV(csvText: string): ImportReport {
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };

  const { headers, rows } = parseCSV(csvText);
  if (headers.length === 0) {
    report.errors.push({ row: 0, message: "Arquivo vazio ou sem cabeçalho." });
    return report;
  }

  const need = ["codigo", "nome", "tipo", "bairro", "logradouro", "metragem_m2", "status"];
  for (const h of need) {
    if (!headers.includes(h)) report.errors.push({ row: 0, message: `Cabeçalho obrigatório ausente: "${h}".` });
  }
  if (report.errors.length > 0) return report;

  const idx = (name: string) => headers.indexOf(name);

  const all = listAreas();
  const byCodigo = new Map(all.map((a) => [a.codigo, a]));

  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 2;
    const row = rows[r];

    const codigo = String(row[idx("codigo")] ?? "").trim();
    if (!codigo) {
      report.skipped++;
      report.errors.push({ row: rowNum, message: "Linha sem 'codigo'." });
      continue;
    }

    const nome = String(row[idx("nome")] ?? "").trim();
    const tipo = String(row[idx("tipo")] ?? "").trim();
    const bairro = String(row[idx("bairro")] ?? "").trim();
    const logradouro = String(row[idx("logradouro")] ?? "").trim();

    const metr = parseNumberBR(row[idx("metragem_m2")] ?? "");
    if (metr == null || metr <= 0) {
      report.skipped++;
      report.errors.push({ row: rowNum, message: `metragem_m2 inválida para codigo="${codigo}".` });
      continue;
    }

    const st = normalizeStatus(String(row[idx("status")] ?? ""));
    if (!st) {
      report.skipped++;
      report.errors.push({ row: rowNum, message: `status inválido para codigo="${codigo}".` });
      continue;
    }

    const restricoes = headers.includes("restricoes") ? String(row[idx("restricoes")] ?? "").trim() : "";
    const ativo = headers.includes("ativo") ? parseBool(row[idx("ativo")], true) : true;

    const lat = headers.includes("latitude_centro") ? parseNumberBR(row[idx("latitude_centro")] ?? "") : null;
    const lon = headers.includes("longitude_centro") ? parseNumberBR(row[idx("longitude_centro")] ?? "") : null;

    const existing = byCodigo.get(codigo);

    if (existing) {
      byCodigo.set(codigo, {
        ...existing,
        codigo,
        nome: nome || existing.nome,
        tipo: tipo || existing.tipo,
        bairro: bairro || existing.bairro,
        logradouro: logradouro || existing.logradouro,
        metragem_m2: metr,
        status: st,
        ativo,
        restricoes: restricoes || undefined,
        latitude_centro: lat ?? undefined,
        longitude_centro: lon ?? undefined,
        updated_at: nowIso(),
      });
      report.updated++;
    } else {
      byCodigo.set(codigo, {
        id: safeUuid(),
        codigo,
        nome,
        tipo,
        bairro,
        logradouro,
        metragem_m2: metr,
        status: st,
        ativo,
        restricoes: restricoes || undefined,
        latitude_centro: lat ?? undefined,
        longitude_centro: lon ?? undefined,
        geo_arquivo: undefined,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      report.created++;
    }
  }

  writeAll(Array.from(byCodigo.values()));
  return report;
}