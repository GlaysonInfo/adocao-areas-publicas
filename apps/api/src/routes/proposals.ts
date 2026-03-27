// apps/api/src/routes/proposals.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createProposalBodySchema, proposalListSchema, proposalSchema } from "../schemas/proposals.schema";
import { mockProposals } from "../lib/app-data";

const moveProposalBodySchema = z.object({
  to: z.enum([
    "protocolo",
    "analise_semad",
    "analise_ecos",
    "ajustes",
    "decisao",
    "termo_assinado",
    "indeferida",
  ]),
  actor_role: z.string().min(1),
  note: z.string().optional(),
});

function nextProtocol() {
  return `BETIM-${new Date().getFullYear()}-${String(mockProposals.length + 1).padStart(4, "0")}`;
}

export async function proposalRoutes(app: FastifyInstance) {
  app.get(
    "/proposals",
    {
      schema: {
        tags: ["proposals"],
        response: {
          200: proposalListSchema,
        },
      },
    },
    async () => {
      return mockProposals;
    }
  );

  app.get(
    "/proposals/:id",
    {
      schema: {
        tags: ["proposals"],
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: proposalSchema,
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const found = mockProposals.find((p) => p.id === id);

      if (!found) {
        return reply.code(404).send({ message: "Proposta não encontrada." });
      }

      return found;
    }
  );

  app.post(
    "/proposals",
    {
      schema: {
        tags: ["proposals"],
        body: createProposalBodySchema,
        response: {
          201: proposalSchema,
        },
      },
    },
    async (request, reply) => {
      const body = createProposalBodySchema.parse(request.body);

      const created = {
        id: `p${mockProposals.length + 1}`,
        codigo_protocolo: nextProtocol(),
        area_id: body.area_id,
        area_nome: body.area_nome,
        descricao_plano: body.descricao_plano,
        kanban_coluna: "protocolo" as const,
        owner_role: body.owner_role,
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

      mockProposals.unshift(created);
      return reply.code(201).send(created);
    }
  );

  app.post(
    "/proposals/:id/move",
    {
      schema: {
        tags: ["proposals"],
        params: z.object({
          id: z.string(),
        }),
        body: moveProposalBodySchema,
        response: {
          200: proposalSchema,
          404: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = moveProposalBodySchema.parse(request.body);

      const idx = mockProposals.findIndex((p) => p.id === id);
      if (idx < 0) {
        return reply.code(404).send({ message: "Proposta não encontrada." });
      }

      const current = mockProposals[idx];
      const moved = {
        ...current,
        kanban_coluna: body.to,
        updated_at: new Date().toISOString(),
        history: [
          ...(current.history ?? []),
          {
            id: `ev-${Date.now()}`,
            type: "move",
            at: new Date().toISOString(),
            actor_role: body.actor_role,
            from: current.kanban_coluna,
            to: body.to,
            note: body.note,
          },
        ],
      };

      mockProposals[idx] = moved;
      return moved;
    }
  );
}
