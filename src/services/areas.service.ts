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

const AREAS_CACHE_KEY = "mvp_areas_v1";

const cacheAreas = (items: AreaPublica[]) => localStorage.setItem(AREAS_CACHE_KEY, JSON.stringify(items));

const withHttpOrLocal = async <T>(localFn: () => T, httpFn: () => Promise<T>): Promise<T> =>
  useHttpApiEnabled() ? httpFn() : Promise.resolve(localFn());

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
    return withHttpOrLocal(listAreas, areasHttpService.listAll.bind(areasHttpService));
  },

  async listPublicAsync(): Promise<AreaPublica[]> {
    return withHttpOrLocal(listAreasPublic, areasHttpService.listPublic.bind(areasHttpService));
  },

  async getByIdAsync(id: string): Promise<AreaPublica | null> {
    return withHttpOrLocal(() => getAreaById(id), () => areasHttpService.getById(id));
  },

  async getByCodigoAsync(codigo: string): Promise<AreaPublica | null> {
    return withHttpOrLocal(() => getAreaByCodigo(codigo), () => areasHttpService.getByCodigo(codigo));
  },

  async syncFromApi(): Promise<AreaPublica[]> {
    if (!useHttpApiEnabled()) return listAreas();

    const items = await areasHttpService.listAll();
    cacheAreas(items);
    return items;
  },
};
