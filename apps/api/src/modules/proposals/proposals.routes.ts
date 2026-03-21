import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const KanbanColunaZ = z.enum([
  "protocolo",
  "analise_semad",
  "analise_ecos",
  "ajustes",
  "decisao",
  "termo_assinado",
  "indeferida",
]);
type KanbanColuna = z.infer<typeof KanbanColunaZ>;

const ProposalDocumentoInZ = z.object({
  tipo: z.string().min(1),
  file_name: z.string().min(1),
  file_size: z.number().int().nonnegative().optional(),
  mime_type: z.string().optional(),
  last_modified: z.number().int().optional(),
});

const ProposalZ = z.object({
  id: z.string().uuid(),
  codigo_protocolo: z.string(),
  area_id: z.string().uuid(),
  area_nome: z.string(),
  descricao_plano: z.string(),
  kanban_coluna: KanbanColunaZ,
  owner_role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_status: z.enum(["approved", "rejected"]).nullable(),
  closed_at: z.string().nullable(),
});

const ProposalEventZ = z.object({
  id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  type: z.string(),
  at: z.string(),
  actor_role: z.string(),
  from_coluna: KanbanColunaZ.nullable(),
  to_coluna: KanbanColunaZ.nullable(),
  note: z.string().nullable(),
  decision: z.string().nullable(),
  decision_note: z.string().nullable(),
});

const ProposalCreateBodyZ = z
  .object({
    area_id: z.string().uuid(),
    descricao_plano: z.string().min(30),
    documentos: z.array(ProposalDocumentoInZ).default([]),
  })
  .passthrough();

const ProposalMoveBodyZ = z
  .object({
    to: KanbanColunaZ,
    note: z.string().trim().optional(),
  })
  .passthrough();

const ListQueryZ = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  kanban_coluna: KanbanColunaZ.optional(),
});

const ListEventsQueryZ = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function iso(d: Date) {
  return d.toISOString();
}

function isStaffRole(role: string) {
  return (
    role === "administrador" ||
    role === "gestor_semad" ||
    role === "gestor_ecos" ||
    role === "gestor_governo"
  );
}

function canMove(actor_role: string, from: KanbanColuna, to: KanbanColuna) {
  if (from === to) return true;

  const is_admin = actor_role === "administrador";
  const is_semad = actor_role === "gestor_semad";
  const is_ecos = actor_role === "gestor_ecos";
  const is_gov = actor_role === "gestor_governo";

  if (from === "protocolo" && to === "analise_semad") return is_admin || is_semad;

  if (from === "analise_semad") {
    if (to === "analise_ecos") return is_admin || is_semad;
    if (to === "ajustes") return is_admin || is_semad;
    if (to === "indeferida") return is_admin || is_semad;
  }

  if (from === "analise_ecos") {
    if (to === "decisao") return is_admin || is_ecos;
    if (to === "ajustes") return is_admin || is_ecos;
    if (to === "indeferida") return is_admin || is_ecos;
  }

  if (from === "ajustes") {
    if (to === "analise_semad") return is_admin || is_semad || is_ecos;
  }

  if (from === "decisao") {
    if (to === "termo_assinado") return is_admin || is_gov;
    if (to === "ajustes") return is_admin || is_gov;
    if (to === "indeferida") return is_admin || is_gov;
  }

  return false;
}

function isClosed(kanban: KanbanColuna, closed_status: string | null) {
  return (
    closed_status === "approved" ||
    closed_status === "rejected" ||
    kanban === "termo_assinado" ||
    kanban === "indeferida"
  );
}

class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function proposalsRoutes(app: FastifyInstance) {
  const tp = app.withTypeProvider<ZodTypeProvider>();
  const prisma = app.prisma;

  // =========================
  // GET /proposals (list)
  // =========================
  tp.get(
    "/proposals",
    {
      schema: {
        tags: ["proposals"],
        summary: "Listar propostas (adotante: só as próprias; staff: todas)",
        querystring: ListQueryZ,
        response: {
          200: z.object({
            items: z.array(ProposalZ),
            total: z.number().int(),
            limit: z.number().int(),
            offset: z.number().int(),
          }),
        },
      },
    },
    async (req) => {
      const actor = req.auth_user!;
      const q = req.query;

      const where: any = {};
      if (q.kanban_coluna) where.kanban_coluna = q.kanban_coluna;

      if (!isStaffRole(actor.role)) {
        where.owner_user_id = actor.id;
      }

      const [total, items] = await Promise.all([
        prisma.proposal.count({ where }),
        prisma.proposal.findMany({
          where,
          orderBy: { created_at: "desc" },
          take: q.limit,
          skip: q.offset,
        }),
      ]);

      return {
        items: items.map((p) => ({
          id: p.id,
          codigo_protocolo: p.codigo_protocolo,
          area_id: p.area_id,
          area_nome: p.area_nome,
          descricao_plano: p.descricao_plano,
          kanban_coluna: p.kanban_coluna as any,
          owner_role: (p as any).owner_role ?? "unknown",
          created_at: iso(p.created_at),
          updated_at: iso(p.updated_at),
          closed_status: (p.closed_status as any) ?? null,
          closed_at: p.closed_at ? iso(p.closed_at) : null,
        })),
        total,
        limit: q.limit,
        offset: q.offset,
      };
    }
  );

  // =========================
  // GET /proposals/:id (detail)
  // =========================
  tp.get(
    "/proposals/:id",
    {
      schema: {
        tags: ["proposals"],
        summary: "Detalhar proposta (adotante: só a própria; staff: qualquer)",
        params: z.object({ id: z.string().uuid() }),
        response: { 200: ProposalZ },
      },
    },
    async (req, reply) => {
      const actor = req.auth_user!;
      const { id } = req.params;

      const p = await prisma.proposal.findUnique({ where: { id } });
      if (!p) return reply.code(404).send({ message: "Proposta não encontrada." } as any);

      if (!isStaffRole(actor.role)) {
        const ownerId = (p as any).owner_user_id ?? null;
        if (!ownerId || ownerId !== actor.id) {
          return reply
            .code(403)
            .send({ code: "FORBIDDEN_NOT_OWNER", message: "Acesso negado (não é o dono)." } as any);
        }
      }

      return reply.send({
        id: p.id,
        codigo_protocolo: p.codigo_protocolo,
        area_id: p.area_id,
        area_nome: p.area_nome,
        descricao_plano: p.descricao_plano,
        kanban_coluna: p.kanban_coluna as any,
        owner_role: (p as any).owner_role ?? "unknown",
        created_at: iso(p.created_at),
        updated_at: iso(p.updated_at),
        closed_status: (p.closed_status as any) ?? null,
        closed_at: p.closed_at ? iso(p.closed_at) : null,
      });
    }
  );

  // =========================
  // POST /proposals (create)
  // =========================
  tp.post(
    "/proposals",
    {
      schema: {
        tags: ["proposals"],
        summary: "Criar proposta (protocolo) — owner vem do token",
        body: ProposalCreateBodyZ,
        response: { 201: ProposalZ },
      },
    },
    async (req, reply) => {
      const actor = req.auth_user!;
      const b = req.body as z.infer<typeof ProposalCreateBodyZ>;
      const now = new Date();

      try {
        const created = await prisma.$transaction(async (tx) => {
          const area = await tx.area.findUnique({ where: { id: b.area_id } });
          if (!area || area.ativo === false) throw new HttpError(400, "Área inválida/inativa.");
          if (area.status !== "disponivel") throw new HttpError(400, "Área não está disponível.");

          const open = await tx.proposal.findFirst({
            where: {
              area_id: b.area_id,
              closed_status: null,
              NOT: { kanban_coluna: { in: ["termo_assinado", "indeferida"] } as any },
            },
          });
          if (open) throw new HttpError(409, "Já existe proposta em andamento para esta área.");

          const codigo = `PR-${now.getUTCFullYear()}-${String(now.getTime()).slice(-6)}`;

          const p = await tx.proposal.create({
            data: {
              codigo_protocolo: codigo,
              area_id: area.id,
              area_nome: area.nome,
              descricao_plano: b.descricao_plano,
              kanban_coluna: "protocolo",
              owner_role: actor.role,
              owner_user_id: actor.id,
              documentos: {
                create: (b.documentos ?? []).map((d) => ({
                  tipo: d.tipo,
                  file_name: d.file_name,
                  file_size: d.file_size ?? null,
                  mime_type: d.mime_type ?? null,
                  last_modified: d.last_modified != null ? BigInt(d.last_modified) : null,
                })),
              },
              events: {
                create: {
                  type: "create",
                  at: now,
                  actor_role: actor.role,
                  actor_user_id: actor.id,
                  from_coluna: null,
                  to_coluna: "protocolo",
                  note: null,
                },
              },
            } as any,
          });

          await tx.area.update({ where: { id: area.id }, data: { status: "em_adocao" } });
          return p;
        });

        return reply.code(201).send({
          id: created.id,
          codigo_protocolo: created.codigo_protocolo,
          area_id: created.area_id,
          area_nome: created.area_nome,
          descricao_plano: created.descricao_plano,
          kanban_coluna: created.kanban_coluna as any,
          owner_role: (created as any).owner_role ?? "unknown",
          created_at: iso(created.created_at),
          updated_at: iso(created.updated_at),
          closed_status: (created.closed_status as any) ?? null,
          closed_at: created.closed_at ? iso(created.closed_at) : null,
        });
      } catch (e: any) {
        if (e instanceof HttpError) {
          return reply.code(e.status).send({ message: e.message, code: e.code } as any);
        }
        throw e;
      }
    }
  );

  // =========================
  // POST /proposals/:id/move
  // =========================
  tp.post(
    "/proposals/:id/move",
    {
      schema: {
        tags: ["proposals"],
        summary: "Mover proposta no Kanban (staff)",
        params: z.object({ id: z.string().uuid() }),
        body: ProposalMoveBodyZ,
        response: { 200: ProposalZ },
      },
    },
    async (req, reply) => {
      const actor = req.auth_user!;
      if (!isStaffRole(actor.role)) {
        return reply.code(403).send({ code: "FORBIDDEN_MOVE_PROPOSAL", message: "Role not allowed" } as any);
      }

      const { id } = req.params;
      const b = req.body as z.infer<typeof ProposalMoveBodyZ>;
      const now = new Date();

      try {
        const updated = await prisma.$transaction(async (tx) => {
          const cur = await tx.proposal.findUnique({ where: { id } });
          if (!cur) throw new HttpError(404, "Proposta não encontrada.");

          const from = cur.kanban_coluna as KanbanColuna;
          const to = b.to as KanbanColuna;

          if (isClosed(from, (cur.closed_status as any) ?? null) && to !== from) {
            throw new HttpError(400, "Proposta encerrada. Não pode mover.");
          }

          if (!canMove(actor.role, from, to)) {
            throw new HttpError(403, "Role not allowed", "FORBIDDEN_MOVE_PROPOSAL");
          }

          const note = b.note?.trim() ? b.note.trim() : null;

          if (to === "ajustes" && !note) throw new HttpError(400, "Motivo de ajustes é obrigatório.");
          if (to === "indeferida" && !note) throw new HttpError(400, "Motivo do indeferimento é obrigatório.");

          const isSemadToEcos = from === "analise_semad" && to === "analise_ecos" && actor.role === "gestor_semad";
          if (isSemadToEcos && !note) {
            throw new HttpError(400, "SEMAD → ECOS sem laudo: informe motivo (note) para registrar override_no_vistoria.");
          }

          if (isSemadToEcos) {
            await tx.proposalEvent.create({
              data: {
                proposal_id: id,
                type: "override_no_vistoria",
                at: now,
                actor_role: actor.role,
                actor_user_id: actor.id,
                from_coluna: from as any,
                to_coluna: to as any,
                note: note,
              } as any,
            });
          }

          await tx.proposalEvent.create({
            data: {
              proposal_id: id,
              type: "move",
              at: now,
              actor_role: actor.role,
              actor_user_id: actor.id,
              from_coluna: from as any,
              to_coluna: to as any,
              note,
            } as any,
          });

          if (to === "ajustes") {
            await tx.proposalEvent.create({
              data: {
                proposal_id: id,
                type: "request_adjustments",
                at: now,
                actor_role: actor.role,
                actor_user_id: actor.id,
                from_coluna: from as any,
                to_coluna: to as any,
                note: note!,
              } as any,
            });
          }

          let closed_status: "approved" | "rejected" | null = (cur.closed_status as any) ?? null;
          let closed_at: Date | null = cur.closed_at ?? null;

          if (to === "termo_assinado") {
            closed_status = "approved";
            closed_at = now;

            await tx.proposalEvent.create({
              data: {
                proposal_id: id,
                type: "decision",
                at: now,
                actor_role: actor.role,
                actor_user_id: actor.id,
                from_coluna: from as any,
                to_coluna: to as any,
                decision: "approved",
                decision_note: null,
                note: null,
              } as any,
            });

            await tx.area.update({ where: { id: cur.area_id }, data: { status: "adotada" } });
          }

          if (to === "indeferida") {
            closed_status = "rejected";
            closed_at = now;

            await tx.proposalEvent.create({
              data: {
                proposal_id: id,
                type: "decision",
                at: now,
                actor_role: actor.role,
                actor_user_id: actor.id,
                from_coluna: from as any,
                to_coluna: to as any,
                decision: "rejected",
                decision_note: note,
                note: null,
              } as any,
            });

            await tx.area.update({ where: { id: cur.area_id }, data: { status: "disponivel" } });
          }

          const p = await tx.proposal.update({
            where: { id },
            data: { kanban_coluna: to as any, closed_status: closed_status as any, closed_at },
          });

          return p;
        });

        return reply.send({
          id: updated.id,
          codigo_protocolo: updated.codigo_protocolo,
          area_id: updated.area_id,
          area_nome: updated.area_nome,
          descricao_plano: updated.descricao_plano,
          kanban_coluna: updated.kanban_coluna as any,
          owner_role: (updated as any).owner_role ?? "unknown",
          created_at: iso(updated.created_at),
          updated_at: iso(updated.updated_at),
          closed_status: (updated.closed_status as any) ?? null,
          closed_at: updated.closed_at ? iso(updated.closed_at) : null,
        });
      } catch (e: any) {
        if (e instanceof HttpError) {
          return reply.code(e.status).send({ message: e.message, code: e.code } as any);
        }
        throw e;
      }
    }
  );

  // =========================
  // GET /proposals/:id/events
  // =========================
  tp.get(
    "/proposals/:id/events",
    {
      schema: {
        tags: ["proposals"],
        summary: "Listar event-log da proposta (adotante: só a própria; staff: qualquer)",
        params: z.object({ id: z.string().uuid() }),
        querystring: ListEventsQueryZ,
        response: {
          200: z.object({
            items: z.array(ProposalEventZ),
            total: z.number().int(),
            limit: z.number().int(),
            offset: z.number().int(),
          }),
        },
      },
    },
    async (req, reply) => {
      const actor = req.auth_user!;
      const { id } = req.params;
      const q = req.query;

      const p = await prisma.proposal.findUnique({
        where: { id },
        select: { id: true, owner_user_id: true },
      });
      if (!p) return reply.code(404).send({ message: "Proposta não encontrada." } as any);

      if (!isStaffRole(actor.role)) {
        if (!p.owner_user_id || p.owner_user_id !== actor.id) {
          return reply
            .code(403)
            .send({ code: "FORBIDDEN_NOT_OWNER", message: "Acesso negado (não é o dono)." } as any);
        }
      }

      const [total, items] = await Promise.all([
        prisma.proposalEvent.count({ where: { proposal_id: id } }),
        prisma.proposalEvent.findMany({
          where: { proposal_id: id },
          orderBy: { at: "asc" },
          take: q.limit,
          skip: q.offset,
        }),
      ]);

      return {
        items: items.map((e) => ({
          id: e.id,
          proposal_id: e.proposal_id,
          type: e.type,
          at: iso(e.at),
          actor_role: e.actor_role,
          from_coluna: (e.from_coluna as any) ?? null,
          to_coluna: (e.to_coluna as any) ?? null,
          note: e.note ?? null,
          decision: e.decision ?? null,
          decision_note: e.decision_note ?? null,
        })),
        total,
        limit: q.limit,
        offset: q.offset,
      };
    }
  );
}