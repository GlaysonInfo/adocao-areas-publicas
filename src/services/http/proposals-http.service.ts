// src/services/http/proposals-http.service.ts
import type { PropostaAdocao } from "../../domain/proposal";
import { apiRequest } from "../../lib/api";

export const proposalsHttpService = {
  async listAll(): Promise<PropostaAdocao[]> {
    return apiRequest<PropostaAdocao[]>("/proposals");
  },

  async getById(id: string): Promise<PropostaAdocao | null> {
    try {
      return await apiRequest<PropostaAdocao>(`/proposals/${encodeURIComponent(id)}`);
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  },

  async listMine(ownerRole: string | null | undefined): Promise<PropostaAdocao[]> {
    const role = String(ownerRole ?? "").trim();
    if (!role) return [];
    const items = await this.listAll();
    return items.filter((p) => p.owner_role === role);
  },

  async create(input: {
    area_id: string;
    area_nome: string;
    descricao_plano: string;
    owner_role: string;
  }): Promise<PropostaAdocao> {
    return apiRequest<PropostaAdocao>("/proposals", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async move(input: {
    id: string;
    to: PropostaAdocao["kanban_coluna"];
    actor_role: string;
    note?: string;
  }): Promise<PropostaAdocao> {
    return apiRequest<PropostaAdocao>(`/proposals/${encodeURIComponent(input.id)}/move`, {
      method: "POST",
      body: JSON.stringify({
        to: input.to,
        actor_role: input.actor_role,
        note: input.note,
      }),
    });
  },
};