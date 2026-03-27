// src/services/areas.service.ts
import type { AreaArquivoMeta, AreaPublica, AreaStatus } from "../domain/area";
import type { ImportReport } from "../storage/areas";
import { useHttpApiEnabled } from "../lib/feature-flags";
import { areasHttpService } from "./http/areas-http.service";
import {
  clearAreasForImportTesting,
  createArea,
  getAreaByCodigo,
  getAreaById,
  importAreasFromCSV,
  listAreas,
  listAreasPublic,
  setAreaActive,
  setAreaGeoFile,
  setAreaStatus,
  subscribeAreas,
  upsertArea,
} from "../storage/areas";

export type { ImportReport };

const AREAS_KEY = "mvp_areas_v1";
const AREAS_SEEDED = "mvp_areas_seeded_v1";
const AREAS_DISABLE_SEED = "mvp_areas_disable_seed_v1";

function writeAreasCache(items: AreaPublica[]) {
  localStorage.setItem(AREAS_DISABLE_SEED, "1");
  localStorage.setItem(AREAS_SEEDED, "1");
  localStorage.setItem(AREAS_KEY, JSON.stringify(items));
}

export const areasService = {
  subscribe: subscribeAreas,

  listAll(): AreaPublica[] {
    return listAreas();
  },

  listPublic(): AreaPublica[] {
    return listAreasPublic();
  },

  getById(id: string): AreaPublica | null {
    return getAreaById(id);
  },

  getByCodigo(codigo: string): AreaPublica | null {
    return getAreaByCodigo(codigo);
  },

  create(input: Omit<AreaPublica, "id" | "created_at" | "updated_at">) {
    return createArea(input);
  },

  upsert(area: AreaPublica) {
    return upsertArea(area);
  },

  setActive(id: string, ativo: boolean) {
    return setAreaActive(id, ativo);
  },

  setStatus(id: string, status: AreaStatus) {
    return setAreaStatus(id, status);
  },

  setGeoFile(id: string, file: AreaArquivoMeta | undefined) {
    return setAreaGeoFile(id, file);
  },

  importFromCSV(csvText: string): ImportReport {
    return importAreasFromCSV(csvText);
  },

  clearForImportTesting() {
    return clearAreasForImportTesting();
  },

  async listAllAsync(): Promise<AreaPublica[]> {
    if (!useHttpApiEnabled()) return listAreas();
    return areasHttpService.listAll();
  },

  async listPublicAsync(): Promise<AreaPublica[]> {
    if (!useHttpApiEnabled()) return listAreasPublic();
    return areasHttpService.listPublic();
  },

  async getByIdAsync(id: string): Promise<AreaPublica | null> {
    if (!useHttpApiEnabled()) return getAreaById(id);
    return areasHttpService.getById(id);
  },

  async getByCodigoAsync(codigo: string): Promise<AreaPublica | null> {
    if (!useHttpApiEnabled()) return getAreaByCodigo(codigo);
    return areasHttpService.getByCodigo(codigo);
  },

  async syncFromApi(): Promise<AreaPublica[]> {
    if (!useHttpApiEnabled()) return listAreas();
    const items = await areasHttpService.listAll();
    writeAreasCache(items);
    return items;
  },
};
