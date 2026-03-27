// src/dev/repair-local-storage.ts
import { listAreas } from "../storage/areas";
import { listAreaRequests } from "../storage/area_requests";
import { listVistorias } from "../storage/vistorias";
import { listProposals } from "../storage/proposals";

const KEYS = {
  areas: "mvp_areas_v1",
  proposals: "mvp_proposals_v1",
  areaRequests: "mvp_area_requests_v1",
  vistorias: "mvp_vistorias_v1",
} as const;

export type RepairLocalStorageResult = {
  areas: number;
  proposals: number;
  areaRequests: number;
  vistorias: number;
};

export function repairLocalStorage(): RepairLocalStorageResult {
  const areas = listAreas();
  const proposals = listProposals();
  const areaRequests = listAreaRequests();
  const vistorias = listVistorias();

  localStorage.setItem(KEYS.areas, JSON.stringify(areas));
  localStorage.setItem(KEYS.proposals, JSON.stringify(proposals));
  localStorage.setItem(KEYS.areaRequests, JSON.stringify(areaRequests));
  localStorage.setItem(KEYS.vistorias, JSON.stringify(vistorias));

  return {
    areas: areas.length,
    proposals: proposals.length,
    areaRequests: areaRequests.length,
    vistorias: vistorias.length,
  };
}

declare global {
  interface Window {
    __repairLocalStorage?: () => RepairLocalStorageResult;
  }
}

if (typeof window !== "undefined") {
  window.__repairLocalStorage = repairLocalStorage;
}