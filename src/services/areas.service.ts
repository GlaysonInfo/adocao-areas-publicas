// src/services/areas.service.ts
import type { AreaArquivoMeta, AreaPublica, AreaStatus } from "../domain/area";
import type { ImportReport } from "../storage/areas";
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

/**
 * Fachada de serviço para Áreas.
 *
 * Hoje delega 100% ao storage local (MVP).
 * Amanhã pode trocar internamente para HTTP/API sem quebrar as telas.
 */
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
};
