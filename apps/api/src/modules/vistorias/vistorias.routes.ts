// apps/api/src/modules/vistorias/vistorias.routes.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import {
  PaginationQueryZ,
  VistoriaCreateBodyZ,
  VistoriaDetailZ,
  VistoriaEventsResponseZ,
  VistoriaExecuteBodyZ,
  VistoriaIssueLaudoBodyZ,
  VistoriaScheduleBodyZ,
  VistoriaZ,
  VistoriasListQueryZ,
  VistoriasListResponseZ,
} from "./vistorias.schemas";

import {
  ApiError,
  createVistoria,
  executeVistoria,
  getVistoria,
  issueLaudo,
  listAllVistorias,
  listEvents,
  scheduleVistoria,
} from "./vistorias.service";

export async function vistoriasRoutes(app: FastifyInstance) {
  const tp: any = app.withTypeProvider<ZodTypeProvider>();

  // LIST
  tp.get(
    "/vistorias",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Listar vistorias (filtros por proposal_id/fase/status)",
        querystring: VistoriasListQueryZ,
        response: { 200: VistoriasListResponseZ },
      },
    },
    async (req) => {
      const q = req.query;
      return listAllVistorias({
        proposal_id: q.proposal_id,
        fase: q.fase,
        status: q.status,
        limit: q.limit,
        offset: q.offset,
      });
    }
  );

  // CREATE
  tp.post(
    "/vistorias",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Criar vistoria (rascunho) + evento create",
        body: VistoriaCreateBodyZ,
        response: { 201: VistoriaZ },
      },
    },
    async (req, reply) => {
      try {
        const b = req.body;
        const out = await createVistoria({
          proposal_id: b.proposal_id,
          fase: b.fase,
          local_texto: b.local_texto,
          checklist_json: b.checklist_json,
          observacoes: b.observacoes,
          actor_role: b.actor_role,
        });
        return reply.code(201).send(out);
      } catch (e: any) {
        if (e instanceof ApiError) return reply.code(e.statusCode).send({ message: e.message });
        throw e;
      }
    }
  );

  // DETAIL (com history embutido)
  tp.get(
    "/vistorias/:id",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Detalhar vistoria (inclui history ordenado)",
        params: z.object({ id: z.string().uuid() }),
        response: { 200: VistoriaDetailZ },
      },
    },
    async (req, reply) => {
      try {
        return await getVistoria(req.params.id);
      } catch (e: any) {
        if (e instanceof ApiError) return reply.code(e.statusCode).send({ message: e.message });
        throw e;
      }
    }
  );

  // EVENTS (listagem paginada do event-log)
  tp.get(
    "/vistorias/:id/events",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Listar event-log da vistoria (fonte de verdade)",
        params: z.object({ id: z.string().uuid() }),
        querystring: PaginationQueryZ,
        response: { 200: VistoriaEventsResponseZ },
      },
    },
    async (req, reply) => {
      try {
        const q = req.query;
        return await listEvents(req.params.id, q.limit, q.offset);
      } catch (e: any) {
        if (e instanceof ApiError) return reply.code(e.statusCode).send({ message: e.message });
        throw e;
      }
    }
  );

  // SCHEDULE
  tp.post(
    "/vistorias/:id/schedule",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Agendar vistoria (status=agendada) + evento schedule",
        params: z.object({ id: z.string().uuid() }),
        body: VistoriaScheduleBodyZ,
        response: { 200: VistoriaZ },
      },
    },
    async (req, reply) => {
      try {
        const b = req.body;
        const out = await scheduleVistoria(req.params.id, {
          agendada_para: new Date(b.agendada_para),
          actor_role: b.actor_role,
          note: b.note,
        });
        return out;
      } catch (e: any) {
        if (e instanceof ApiError) return reply.code(e.statusCode).send({ message: e.message });
        throw e;
      }
    }
  );

  // EXECUTE
  tp.post(
    "/vistorias/:id/execute",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Executar vistoria (status=executada) + evento execute",
        params: z.object({ id: z.string().uuid() }),
        body: VistoriaExecuteBodyZ,
        response: { 200: VistoriaZ },
      },
    },
    async (req, reply) => {
      try {
        const b = req.body;
        const out = await executeVistoria(req.params.id, {
          local_texto: b.local_texto,
          geo: b.geo,
          checklist_json: b.checklist_json,
          observacoes: b.observacoes,
          actor_role: b.actor_role,
          note: b.note,
        });
        return out;
      } catch (e: any) {
        if (e instanceof ApiError) return reply.code(e.statusCode).send({ message: e.message });
        throw e;
      }
    }
  );

  // ISSUE LAUDO
  tp.post(
    "/vistorias/:id/issue-laudo",
    {
      schema: {
        tags: ["vistorias"],
        summary: "Emitir laudo (status=laudo_emitido) + evento issue_laudo",
        params: z.object({ id: z.string().uuid() }),
        body: VistoriaIssueLaudoBodyZ,
        response: { 200: VistoriaZ },
      },
    },
    async (req, reply) => {
      try {
        const b = req.body;
        const out = await issueLaudo(req.params.id, {
          conclusao: b.conclusao,
          recomendacoes: b.recomendacoes,
          actor_role: b.actor_role,
          note: b.note,
        });
        return out;
      } catch (e: any) {
        if (e instanceof ApiError) return reply.code(e.statusCode).send({ message: e.message });
        throw e;
      }
    }
  );
}
