// src/services/areaRequests.service.ts
import type { AreaDraft, AreaRequest, SisGeoResultado } from "../domain/area_request";
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
};
