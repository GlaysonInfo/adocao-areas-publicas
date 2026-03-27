// apps/api/src/modules/vistorias/vistorias.service.ts
import { prisma } from "../../db/prisma";
import {
  createVistoriaTx,
  executeVistoriaTx,
  getVistoriaById,
  issueLaudoTx,
  listVistoriaEvents,
  listVistorias,
  scheduleVistoriaTx,
  type VistoriaCreateInput,
  type VistoriaExecuteInput,
  type VistoriaIssueLaudoInput,
  type VistoriaListInput,
  type VistoriaScheduleInput,
} from "./vistorias.repo";

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

export function mapVistoriaDto(v: any) {
  return {
    id: v.id,
    proposal_id: v.proposal_id,
    fase: v.fase,
    status: v.status,

    local_texto: v.local_texto,

    geo: v.geo ?? null,
    checklist_json: v.checklist_json ?? null,
    observacoes: v.observacoes ?? null,

    agendada_para: toIso(v.agendada_para),
    executada_em: toIso(v.executada_em),

    laudo_conclusao: v.laudo_conclusao ?? null,
    laudo_recomendacoes: v.laudo_recomendacoes ?? null,
    laudo_emitido_em: toIso(v.laudo_emitido_em),

    created_at: v.created_at.toISOString(),
    updated_at: v.updated_at.toISOString(),
  };
}

export function mapVistoriaEventDto(e: any) {
  return {
    id: e.id,
    vistoria_id: e.vistoria_id,
    type: e.type,
    at: e.at.toISOString(),
    actor_role: e.actor_role,
    payload: e.payload ?? null,
  };
}

export async function createVistoria(input: VistoriaCreateInput) {
  // regra: proposal deve existir
  const proposal = await prisma.proposal.findUnique({ where: { id: input.proposal_id } });
  if (!proposal) throw new ApiError(400, "Proposta inválida.");

  // regra: fase=analise só se proposta ainda não estiver encerrada
  if (input.fase === "analise") {
    if (proposal.closed_status != null) {
      throw new ApiError(400, "Proposta encerrada. Vistoria de análise não permitida.");
    }
  }

  const created = await createVistoriaTx(input);
  return mapVistoriaDto(created);
}

export async function getVistoria(id: string) {
  const v: any = await getVistoriaById(id, true);
  if (!v) throw new ApiError(404, "Vistoria não encontrada.");

  const dto = mapVistoriaDto(v);
  const history = (v.events ?? []).map(mapVistoriaEventDto);

  return { ...dto, history };
}

export async function listAllVistorias(input: VistoriaListInput) {
  const { total, items } = await listVistorias(input);
  return {
    total,
    items: items.map(mapVistoriaDto),
    limit: input.limit,
    offset: input.offset,
  };
}

export async function listEvents(id: string, limit: number, offset: number) {
  // garante que existe
  const exists = await prisma.vistoria.findUnique({ where: { id } });
  if (!exists) throw new ApiError(404, "Vistoria não encontrada.");

  const { total, items } = await listVistoriaEvents(id, limit, offset);
  return {
    items: items.map(mapVistoriaEventDto),
    total,
    limit,
    offset,
  };
}

export async function scheduleVistoria(id: string, input: VistoriaScheduleInput) {
  const v = await prisma.vistoria.findUnique({ where: { id } });
  if (!v) throw new ApiError(404, "Vistoria não encontrada.");

  if (!(v.status === "rascunho" || v.status === "agendada")) {
    throw new ApiError(400, "Transição inválida: só é possível agendar a partir de rascunho/agendada.");
  }

  const updated = await scheduleVistoriaTx(id, input);
  return mapVistoriaDto(updated);
}

export async function executeVistoria(id: string, input: VistoriaExecuteInput) {
  const v = await prisma.vistoria.findUnique({ where: { id } });
  if (!v) throw new ApiError(404, "Vistoria não encontrada.");

  if (!(v.status === "rascunho" || v.status === "agendada")) {
    throw new ApiError(400, "Transição inválida: só é possível executar a partir de rascunho/agendada.");
  }

  const updated = await executeVistoriaTx(id, input);
  return mapVistoriaDto(updated);
}

export async function issueLaudo(id: string, input: VistoriaIssueLaudoInput) {
  const v = await prisma.vistoria.findUnique({ where: { id } });
  if (!v) throw new ApiError(404, "Vistoria não encontrada.");

  if (v.status !== "executada") {
    throw new ApiError(400, "Transição inválida: só é possível emitir laudo quando status=executada.");
  }

  const updated = await issueLaudoTx(id, input);
  return mapVistoriaDto(updated);
}
