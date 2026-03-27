import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { prisma } from "../../db/prisma";
import { AreaCreateBodyZ, AreaPatchBodyZ, AreaZ, AreasListQueryZ } from "./areas.schemas";

export const areasRoutes: FastifyPluginAsync = async (app) => {
  // ✅ garanta inferência Zod nas rotas deste módulo
  const tp: any = app.withTypeProvider<ZodTypeProvider>();

  tp.get(
    "/areas",
    {
      schema: {
        tags: ["areas"],
        summary: "Listar áreas (com filtros)",
        querystring: AreasListQueryZ,
        response: {
          200: z.object({
            items: z.array(AreaZ),
            total: z.number().int(),
            limit: z.number().int(),
            offset: z.number().int(),
          }),
        },
      },
    },
    async (req) => {
      const q = req.query;

      const where: any = {};
      if (q.status) where.status = q.status;
      if (q.tipo) where.tipo = q.tipo;
      if (typeof q.ativo === "boolean") where.ativo = q.ativo;

      if (q.q && q.q.trim()) {
        const term = q.q.trim();
        where.OR = [
          { codigo: { contains: term, mode: "insensitive" } },
          { nome: { contains: term, mode: "insensitive" } },
          { bairro: { contains: term, mode: "insensitive" } },
        ];
      }

      const [total, items] = await Promise.all([
        prisma.area.count({ where }),
        prisma.area.findMany({
          where,
          orderBy: { updated_at: "desc" },
          take: q.limit,
          skip: q.offset,
        }),
      ]);

      return {
        items: items.map((a) => ({
          ...a,
          created_at: a.created_at.toISOString(),
          updated_at: a.updated_at.toISOString(),
        })),
        total,
        limit: q.limit,
        offset: q.offset,
      };
    }
  );

  tp.get(
    "/areas/:id",
    {
      schema: {
        tags: ["areas"],
        summary: "Detalhar área por id",
        params: z.object({ id: z.string().uuid() }),
        response: { 200: AreaZ },
      },
    },
    async (req, reply) => {
      const a = await prisma.area.findUnique({ where: { id: req.params.id } });
      if (!a) return reply.code(404).send({ message: "Área não encontrada." });

      return {
        ...a,
        created_at: a.created_at.toISOString(),
        updated_at: a.updated_at.toISOString(),
      };
    }
  );

  tp.post(
    "/areas",
    {
      schema: {
        tags: ["areas"],
        summary: "Criar área",
        body: AreaCreateBodyZ,
        response: { 201: AreaZ },
      },
    },
    async (req, reply) => {
      const b = req.body;

      const created = await prisma.area.create({
        data: {
          codigo: b.codigo,
          nome: b.nome,
          tipo: b.tipo,
          bairro: b.bairro,
          logradouro: b.logradouro ?? null,
          metragem_m2: b.metragem_m2,
          status: b.status ?? "disponivel",
          ativo: b.ativo ?? true,
          restricoes: b.restricoes ?? null,
          geo_arquivo: b.geo_arquivo ?? null,
        },
      });

      return reply.code(201).send({
        ...created,
        created_at: created.created_at.toISOString(),
        updated_at: created.updated_at.toISOString(),
      });
    }
  );

  tp.patch(
    "/areas/:id",
    {
      schema: {
        tags: ["areas"],
        summary: "Atualizar parcialmente",
        params: z.object({ id: z.string().uuid() }),
        body: AreaPatchBodyZ,
        response: { 200: AreaZ },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const b = req.body;

      const exists = await prisma.area.findUnique({ where: { id } });
      if (!exists) return reply.code(404).send({ message: "Área não encontrada." });

      const updated = await prisma.area.update({
        where: { id },
        data: {
          codigo: b.codigo ?? undefined,
          nome: b.nome ?? undefined,
          tipo: b.tipo ?? undefined,
          bairro: b.bairro ?? undefined,
          logradouro: b.logradouro ?? undefined,
          metragem_m2: b.metragem_m2 ?? undefined,
          status: b.status ?? undefined,
          ativo: b.ativo ?? undefined,
          restricoes: b.restricoes ?? undefined,
          geo_arquivo: b.geo_arquivo ?? undefined,
        },
      });

      return {
        ...updated,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      };
    }
  );

  tp.delete(
    "/areas/:id",
    {
      schema: {
        tags: ["areas"],
        summary: "Desativar área (soft delete: ativo=false)",
        params: z.object({ id: z.string().uuid() }),
        response: { 204: z.any() },
      },
    },
    async (req, reply) => {
      const { id } = req.params;

      const exists = await prisma.area.findUnique({ where: { id } });
      if (!exists) return reply.code(404).send({ message: "Área não encontrada." });

      await prisma.area.update({ where: { id }, data: { ativo: false } });
      return reply.code(204).send();
    }
  );
};
