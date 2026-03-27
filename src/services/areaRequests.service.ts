// src/services/areaRequests.service.ts
import type { AreaDraft, AreaRequest, SisGeoResultado } from "../domain/area_request";
import { useHttpApiEnabled } from "../lib/feature-flags";
import { areaRequestsHttpService } from "./http/area-requests-http.service";
import {
  createAreaRequest,
  decideAreaRequest,
  getAreaRequestById,
  listAreaRequests,
  listMyAreaRequests,
  setAreaDraft,
  startVerification,
  subscribeAreaRequests,
  updateSisGeo,
} from "../storage/area_requests";
import {
  computeAreaRequestMetrics,
  computeSemadProductivityAreaRequests,
} from "../storage/area_request_reports";

const KEY = "mvp_area_requests_v1";

function writeCache(items: AreaRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const areaRequestsService = {
  subscribe: subscribeAreaRequests,

  listAll(): AreaRequest[] {
    return listAreaRequests();
  },

  listMine(ownerRole: string | null | undefined): AreaRequest[] {
    return listMyAreaRequests(ownerRole);
  },

  getById(id: string): AreaRequest | null {
    return getAreaRequestById(id);
  },

  create(input: AreaRequest, actorRole: string) {
    return createAreaRequest(input, actorRole);
  },

  startVerification(id: string, actorRole: string) {
    return startVerification(id, actorRole);
  },

  updateSisGeo(
    id: string,
    input: { sisgeo_resultado: SisGeoResultado; sisgeo_ref?: string; sisgeo_note?: string },
    actorRole: string
  ) {
    return updateSisGeo(id, input, actorRole);
  },

  setAreaDraft(id: string, draft: AreaDraft) {
    return setAreaDraft(id, draft);
  },

  decide(
    id: string,
    input:
      | { decision: "approved"; decision_note?: string; area_draft: AreaDraft }
      | { decision: "rejected"; decision_note: string },
    actorRole: string
  ) {
    return decideAreaRequest(id, input, actorRole);
  },

  computeMetrics(fromIso: string, toIso: string) {
    return computeAreaRequestMetrics(fromIso, toIso);
  },

  computeSemadProductivity(fromIso: string, toIso: string) {
    return computeSemadProductivityAreaRequests(fromIso, toIso);
  },

  async listAllAsync(): Promise<AreaRequest[]> {
    if (!useHttpApiEnabled()) return listAreaRequests();
    return areaRequestsHttpService.listAll();
  },

  async listMineAsync(ownerRole: string | null | undefined): Promise<AreaRequest[]> {
    if (!useHttpApiEnabled()) return listMyAreaRequests(ownerRole);
    return areaRequestsHttpService.listMine(ownerRole);
  },

  async getByIdAsync(id: string): Promise<AreaRequest | null> {
    if (!useHttpApiEnabled()) return getAreaRequestById(id);
    return areaRequestsHttpService.getById(id);
  },

  async createAsync(input: AreaRequest, actorRole: string): Promise<AreaRequest> {
    if (!useHttpApiEnabled()) return createAreaRequest(input, actorRole);
    const created = await areaRequestsHttpService.create(input);
    await this.syncFromApi();
    return created;
  },

  async startVerificationAsync(id: string, actorRole: string): Promise<AreaRequest> {
    if (!useHttpApiEnabled()) return startVerification(id, actorRole);
    const updated = await areaRequestsHttpService.startVerification(id, actorRole);
    await this.syncFromApi();
    return updated;
  },

  async updateSisGeoAsync(
    id: string,
    input: { sisgeo_resultado: SisGeoResultado; sisgeo_ref?: string; sisgeo_note?: string },
    actorRole: string
  ): Promise<AreaRequest> {
    if (!useHttpApiEnabled()) return updateSisGeo(id, input, actorRole);
    const updated = await areaRequestsHttpService.updateSisGeo(id, input, actorRole);
    await this.syncFromApi();
    return updated;
  },

  async decideAsync(
    id: string,
    input:
      | { decision: "approved"; decision_note?: string; area_draft: AreaDraft }
      | { decision: "rejected"; decision_note: string },
    actorRole: string
  ): Promise<AreaRequest> {
    if (!useHttpApiEnabled()) return decideAreaRequest(id, input, actorRole);
    const updated = await areaRequestsHttpService.decide(id, input, actorRole);
    await this.syncFromApi();
    return updated;
  },

  async syncFromApi(): Promise<AreaRequest[]> {
    if (!useHttpApiEnabled()) return listAreaRequests();
    const items = await areaRequestsHttpService.listAll();
    writeCache(items);
    return items;
  },
};