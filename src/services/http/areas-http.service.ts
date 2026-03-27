// src/services/http/areas-http.service.ts
import type { AreaPublica } from "../../domain/area";
import { apiRequest } from "../../lib/api";

export const areasHttpService = {
  async listAll(): Promise<AreaPublica[]> {
    return apiRequest<AreaPublica[]>("/areas");
  },

  async getById(id: string): Promise<AreaPublica | null> {
    const items = await this.listAll();
    return items.find((a) => a.id === id) ?? null;
  },

  async getByCodigo(codigo: string): Promise<AreaPublica | null> {
    const items = await this.listAll();
    return items.find((a) => a.codigo === codigo) ?? null;
  },

  async listPublic(): Promise<AreaPublica[]> {
    const items = await this.listAll();
    return items.filter((a) => a.ativo !== false);
  },
};
