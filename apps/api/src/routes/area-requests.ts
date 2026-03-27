// apps/api/src/routes/area-requests.ts
import type { FastifyInstance } from "fastify";
import {
  areaRequestListSchema,
  areaRequestSchema,
  createAreaRequestBodySchema,
  decideAreaRequestBodySchema,
  startVerificationBodySchema,
  updateSisGeoBodySchema,
} from "../schemas/area-requests.schema";
import { mockAreaRequests } from "../lib/app-data";

function nextProtocol() {
  return `BETIM-SOL-${new Date().getFullYear()}-${String(mockAreaRequests.length + 1).padStart(4, "0")}`;
}

export async function areaRequestRoutes(app: FastifyInstance) {
  app.get(
    "/area-requests",
    {
      schema: {
        tags: ["area-requests"],
        response: {
          200: areaRequestListSchema,
        },
      },
    },
    async () => {
      return mockAreaRequests;
    }
  );

  app.get(
    "/area-requests/:id",
    {
      schema: {
        tags: ["area-requests"],
        response: {
          200: areaRequestSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const found = mockAreaRequests.find((r) => r.id === id);

      if (!found) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }

      return found;
    }
  );

  app.post(
    "/area-requests",
    {
      schema: {
        tags: ["area-requests"],
        body: createAreaRequestBodySchema,
        response: {
          201: areaRequestSchema,
        },
      },
    },
    async (request, reply) => {
      const body = createAreaRequestBodySchema.parse(request.body);

      const created = {
        id: `ar${mockAreaRequests.length + 1}`,
        codigo_protocolo: body.codigo_protocolo || nextProtocol(),
        status: "solicitada" as const,
        owner_role: body.owner_role,
        lote: body.lote,
        quadra: body.quadra,
        localizacao_descritiva: body.localizacao_descritiva,
        geo: body.geo,
        descricao_intervencao: body.descricao_intervencao,
        documentos: body.documentos ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        history: [
          {
            id: `ev-${Date.now()}`,
            type: "create",
            at: new Date().toISOString(),
            actor_role: body.owner_role,
          },
        ],
      };

      mockAreaRequests.unshift(created);
      return reply.code(201).send(created);
    }
  );

  app.post(
    "/area-requests/:id/start-verification",
    {
      schema: {
        tags: ["area-requests"],
        body: startVerificationBodySchema,
        response: {
          200: areaRequestSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = startVerificationBodySchema.parse(request.body);

      const idx = mockAreaRequests.findIndex((r) => r.id === id);
      if (idx < 0) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }

      const current = mockAreaRequests[idx];
      const updated = {
        ...current,
        status: "em_verificacao" as const,
        updated_at: new Date().toISOString(),
        history: [
          ...(current.history ?? []),
          {
            id: `ev-${Date.now()}`,
            type: "start_verification",
            at: new Date().toISOString(),
            actor_role: body.actor_role,
          },
        ],
      };

      mockAreaRequests[idx] = updated;
      return updated;
    }
  );

  app.post(
    "/area-requests/:id/sisgeo",
    {
      schema: {
        tags: ["area-requests"],
        body: updateSisGeoBodySchema,
        response: {
          200: areaRequestSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateSisGeoBodySchema.parse(request.body);

      const idx = mockAreaRequests.findIndex((r) => r.id === id);
      if (idx < 0) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }

      const current = mockAreaRequests[idx];
      const updated = {
        ...current,
        status: current.status === "solicitada" ? ("em_verificacao" as const) : current.status,
        sisgeo_resultado: body.sisgeo_resultado,
        sisgeo_ref: body.sisgeo_ref,
        sisgeo_note: body.sisgeo_note,
        updated_at: new Date().toISOString(),
        history: [
          ...(current.history ?? []),
          {
            id: `ev-${Date.now()}`,
            type: "sisgeo_update",
            at: new Date().toISOString(),
            actor_role: body.actor_role,
            sisgeo_resultado: body.sisgeo_resultado,
            sisgeo_ref: body.sisgeo_ref,
            note: body.sisgeo_note,
          },
        ],
      };

      mockAreaRequests[idx] = updated;
      return updated;
    }
  );

  app.post(
    "/area-requests/:id/decision",
    {
      schema: {
        tags: ["area-requests"],
        body: decideAreaRequestBodySchema,
        response: {
          200: areaRequestSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = decideAreaRequestBodySchema.parse(request.body);

      const idx = mockAreaRequests.findIndex((r) => r.id === id);
      if (idx < 0) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }

      const current = mockAreaRequests[idx];

      if (body.decision === "rejected") {
        const updated = {
          ...current,
          status: "indeferida" as const,
          updated_at: new Date().toISOString(),
          history: [
            ...(current.history ?? []),
            {
              id: `ev-${Date.now()}`,
              type: "decision",
              at: new Date().toISOString(),
              actor_role: body.actor_role,
              decision: "rejected",
              decision_note: body.decision_note,
            },
          ],
        };

        mockAreaRequests[idx] = updated;
        return updated;
      }

      const updated = {
        ...current,
        status: "aprovada" as const,
        area_draft: body.area_draft,
        created_area_id: current.created_area_id ?? `area-${Date.now()}`,
        created_proposal_id: current.created_proposal_id ?? `proposal-${Date.now()}`,
        updated_at: new Date().toISOString(),
        history: [
          ...(current.history ?? []),
          {
            id: `ev-${Date.now()}`,
            type: "decision",
            at: new Date().toISOString(),
            actor_role: body.actor_role,
            decision: "approved",
            decision_note: body.decision_note,
          },
        ],
      };

      mockAreaRequests[idx] = updated;
      return updated;
    }
  );
}