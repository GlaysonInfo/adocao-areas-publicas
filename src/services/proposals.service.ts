// src/services/proposals.service.ts
import type { KanbanColuna, PropostaAdocao } from "../domain/proposal";
import type { ProposalExtraEventInput } from "../storage/proposals";
import { useHttpApiEnabled } from "../lib/feature-flags";
import { proposalsHttpService } from "./http/proposals-http.service";
import {
  adopterUpdateAndResubmitFromAdjustments,
  computeConsolidatedByPeriod,
  computeSemadProductivity,
  computeSlaByColumn,
  createProposal,
  getProposalById,
  listMyProposals,
  listProposalEvents,
  listProposalEventsBetween,
  listProposals,
  moveProposal,
  resubmitAfterAdjustments,
  subscribeProposals,
} from "../storage/proposals";

const PROPOSALS_CACHE_KEY = "mvp_proposals_v1";

const cacheProposals = (items: PropostaAdocao[]) => localStorage.setItem(PROPOSALS_CACHE_KEY, JSON.stringify(items));

const withHttpOrLocal = async <T>(localFn: () => T, httpFn: () => Promise<T>): Promise<T> =>
  useHttpApiEnabled() ? httpFn() : Promise.resolve(localFn());

export const proposalsService = {
  subscribe: subscribeProposals,

  listAll(): PropostaAdocao[] {
    return listProposals();
  },

  listMine(ownerRole: string | null | undefined): PropostaAdocao[] {
    return listMyProposals(ownerRole);
  },

  getById(id: string): PropostaAdocao | null {
    return getProposalById(id);
  },

  create(input: PropostaAdocao, actorRole: string) {
    return createProposal(input, actorRole);
  },

  move(
    id: string,
    to: KanbanColuna,
    actorRole: string,
    note?: string,
    extraEvents?: ProposalExtraEventInput[]
  ) {
    return moveProposal(id, to, actorRole, note, extraEvents);
  },

  resubmitFromAdjustments(
    id: string,
    input: {
      descricao_plano?: string;
      carta_intencao?: FileList | null;
      projeto_resumo?: FileList | null;
    },
    actorRole: string
  ) {
    return adopterUpdateAndResubmitFromAdjustments(id, input, actorRole);
  },

  quickResubmit(id: string, actorRole: string) {
    return resubmitAfterAdjustments(id, actorRole);
  },

  listEvents() {
    return listProposalEvents();
  },

  listEventsBetween(fromIso: string, toIso: string) {
    return listProposalEventsBetween(fromIso, toIso);
  },

  computeConsolidated(fromIso: string, toIso: string) {
    return computeConsolidatedByPeriod(fromIso, toIso);
  },

  computeSemadProductivity(fromIso: string, toIso: string) {
    return computeSemadProductivity(fromIso, toIso);
  },

  computeSlaByColumn(fromIso: string, toIso: string) {
    return computeSlaByColumn(fromIso, toIso);
  },

  async listAllAsync(): Promise<PropostaAdocao[]> {
    return withHttpOrLocal(listProposals, proposalsHttpService.listAll.bind(proposalsHttpService));
  },

  async listMineAsync(ownerRole: string | null | undefined): Promise<PropostaAdocao[]> {
    if (!ownerRole?.trim()) return [];
    return withHttpOrLocal(() => listMyProposals(ownerRole), () => proposalsHttpService.listMine(ownerRole));
  },

  async getByIdAsync(id: string): Promise<PropostaAdocao | null> {
    return withHttpOrLocal(() => getProposalById(id), () => proposalsHttpService.getById(id));
  },

  async createAsync(input: { area_id: string; area_nome: string; descricao_plano: string; owner_role: string }): Promise<PropostaAdocao> {
    if (!useHttpApiEnabled()) {
      const now = new Date().toISOString();
      const proposal: PropostaAdocao = {
        id: `local_${Date.now()}`,
        codigo_protocolo: `LOCAL-${Date.now()}`,
        area_id: input.area_id,
        area_nome: input.area_nome,
        descricao_plano: input.descricao_plano,
        kanban_coluna: "protocolo",
        documentos: [],
        owner_role: input.owner_role,
        created_at: now,
        updated_at: now,
        history: [],
      };
      return createProposal(proposal, input.owner_role);
    }

    const created = await proposalsHttpService.create(input);
    const items = await proposalsHttpService.listAll();
    cacheProposals(items);
    return created;
  },

  async moveAsync(input: { id: string; to: KanbanColuna; actor_role: string; note?: string }): Promise<PropostaAdocao> {
    if (!useHttpApiEnabled()) {
      return moveProposal(input.id, input.to, input.actor_role, input.note);
    }

    const moved = await proposalsHttpService.move(input);
    const items = await proposalsHttpService.listAll();
    cacheProposals(items);
    return moved;
  },

  async syncFromApi(): Promise<PropostaAdocao[]> {
    if (!useHttpApiEnabled()) return listProposals();

    const items = await proposalsHttpService.listAll();
    cacheProposals(items);
    return items;
  },
};
