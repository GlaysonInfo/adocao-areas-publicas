// apps/api/src/modules/vistorias/vistorias.repo.ts
import { prisma } from "../../db/prisma";
import type { Prisma } from "@prisma/client";

export type VistoriaListInput = {
  proposal_id?: string;
  fase?: "analise" | "vigencia";
  status?: "rascunho" | "agendada" | "executada" | "laudo_emitido" | "cancelada";
  limit: number;
  offset: number;
};

export type VistoriaCreateInput = {
  proposal_id: string;
  fase: "analise" | "vigencia";
  local_texto: string;
  checklist_json?: unknown;
  observacoes?: string;
  actor_role: string;
};

export type VistoriaScheduleInput = {
  agendada_para: Date;
  actor_role: string;
  note?: string;
};

export type VistoriaExecuteInput = {
  local_texto: string;
  geo?: unknown;
  checklist_json?: unknown;
  observacoes?: string;
  actor_role: string;
  note?: string;
};

export type VistoriaIssueLaudoInput = {
  conclusao: "favoravel" | "favoravel_com_ressalvas" | "desfavoravel";
  recomendacoes?: string;
  actor_role: string;
  note?: string;
};

export async function listVistorias(input: VistoriaListInput) {
  const where: Prisma.VistoriaWhereInput = {};
  if (input.proposal_id) where.proposal_id = input.proposal_id;
  if (input.fase) where.fase = input.fase;
  if (input.status) where.status = input.status;

  const [total, items] = await Promise.all([
    prisma.vistoria.count({ where }),
    prisma.vistoria.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
  ]);

  return { total, items };
}

export async function getVistoriaById(id: string, withHistory: boolean) {
  if (!withHistory) {
    const v = await prisma.vistoria.findUnique({ where: { id } });
    return v;
  }

  const v = await prisma.vistoria.findUnique({
    where: { id },
    include: { events: { orderBy: { at: "asc" } } },
  });
  return v;
}

export async function listVistoriaEvents(vistoria_id: string, limit: number, offset: number) {
  const [total, items] = await Promise.all([
    prisma.vistoriaEvent.count({ where: { vistoria_id } }),
    prisma.vistoriaEvent.findMany({
      where: { vistoria_id },
      orderBy: { at: "asc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return { total, items };
}

export async function createVistoriaTx(input: VistoriaCreateInput) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const created = await tx.vistoria.create({
      data: {
        proposal_id: input.proposal_id,
        fase: input.fase,
        status: "rascunho",
        local_texto: input.local_texto,
        checklist_json: input.checklist_json ?? undefined,
        observacoes: input.observacoes ?? undefined,
      },
    });

    await tx.vistoriaEvent.create({
      data: {
        vistoria_id: created.id,
        type: "create",
        at: now,
        actor_role: input.actor_role,
        payload: {
          fase: input.fase,
          status: "rascunho",
        },
      },
    });

    return created;
  });
}

export async function scheduleVistoriaTx(id: string, input: VistoriaScheduleInput) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.vistoria.update({
      where: { id },
      data: {
        status: "agendada",
        agendada_para: input.agendada_para,
      },
    });

    await tx.vistoriaEvent.create({
      data: {
        vistoria_id: id,
        type: "schedule",
        at: now,
        actor_role: input.actor_role,
        payload: {
          agendada_para: input.agendada_para.toISOString(),
          note: input.note ?? null,
        },
      },
    });

    return updated;
  });
}

export async function executeVistoriaTx(id: string, input: VistoriaExecuteInput) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.vistoria.update({
      where: { id },
      data: {
        status: "executada",
        executada_em: now,
        local_texto: input.local_texto,
        geo: input.geo ?? undefined,
        checklist_json: input.checklist_json ?? undefined,
        observacoes: input.observacoes ?? undefined,
      },
    });

    await tx.vistoriaEvent.create({
      data: {
        vistoria_id: id,
        type: "execute",
        at: now,
        actor_role: input.actor_role,
        payload: {
          executada_em: now.toISOString(),
          geo: input.geo ?? null,
          note: input.note ?? null,
        },
      },
    });

    return updated;
  });
}

export async function issueLaudoTx(id: string, input: VistoriaIssueLaudoInput) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.vistoria.update({
      where: { id },
      data: {
        status: "laudo_emitido",
        laudo_conclusao: input.conclusao,
        laudo_recomendacoes: input.recomendacoes ?? null,
        laudo_emitido_em: now,
      },
    });

    await tx.vistoriaEvent.create({
      data: {
        vistoria_id: id,
        type: "issue_laudo",
        at: now,
        actor_role: input.actor_role,
        payload: {
          conclusao: input.conclusao,
          recomendacoes: input.recomendacoes ?? null,
          emitido_em: now.toISOString(),
          note: input.note ?? null,
        },
      },
    });

    return updated;
  });
}