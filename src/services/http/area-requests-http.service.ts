// src/services/http/area-requests-http.service.ts
import type { AreaDraft, AreaRequest, SisGeoResultado } from "../../domain/area_request";
import { apiRequest } from "../../lib/api";

export const areaRequestsHttpService = {
  async listAll(): Promise<AreaRequest[]> {
    return apiRequest<AreaRequest[]>("/area-requests");
  },

  async getById(id: string): Promise<AreaRequest | null> {
    try {
      return await apiRequest<AreaRequest>(`/area-requests/${encodeURIComponent(id)}`);
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  },

  async listMine(ownerRole: string | null | undefined): Promise<AreaRequest[]> {
    const role = String(ownerRole ?? "").trim();
    if (!role) return [];
    const items = await this.listAll();
    return items.filter((r) => r.owner_role === role);
  },

  async create(input: AreaRequest): Promise<AreaRequest> {
    return apiRequest<AreaRequest>("/area-requests", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async startVerification(id: string, actor_role: string): Promise<AreaRequest> {
    return apiRequest<AreaRequest>(`/area-requests/${encodeURIComponent(id)}/start-verification`, {
      method: "POST",
      body: JSON.stringify({ actor_role }),
    });
  },

  async updateSisGeo(
    id: string,
    input: { sisgeo_resultado: SisGeoResultado; sisgeo_ref?: string; sisgeo_note?: string },
    actor_role: string
  ): Promise<AreaRequest> {
    return apiRequest<AreaRequest>(`/area-requests/${encodeURIComponent(id)}/sisgeo`, {
      method: "POST",
      body: JSON.stringify({
        actor_role,
        ...input,
      }),
    });
  },

  async decide(
    id: string,
    input:
      | { decision: "approved"; decision_note?: string; area_draft: AreaDraft }
      | { decision: "rejected"; decision_note: string },
    actor_role: string
  ): Promise<AreaRequest> {
    return apiRequest<AreaRequest>(`/area-requests/${encodeURIComponent(id)}/decision`, {
      method: "POST",
      body: JSON.stringify({
        actor_role,
        ...input,
      }),
    });
  },
};