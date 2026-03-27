<<<<<<< HEAD
﻿// src/services/vistorias.service.ts
=======
// src/services/vistorias.service.ts
>>>>>>> 0f907c1538084d200f2ef0204655826e8f67f6a6
import type {
  Vistoria,
  VistoriaAnexoMeta,
  VistoriaChecklist,
  VistoriaFase,
  VistoriaLaudo,
  VistoriaStatus,
} from "../domain/vistoria";
import {
  addVistoriaAnexos,
  createVistoria,
  emitVistoriaLaudo,
  getVistoriaById,
  listVistorias,
  listVistoriasByProposal,
  subscribeVistorias,
  updateVistoriaChecklist,
  updateVistoriaSchedule,
  updateVistoriaStatus,
} from "../storage/vistorias";

<<<<<<< HEAD
=======
/**
 * Fachada de serviço para Vistorias.
 */
>>>>>>> 0f907c1538084d200f2ef0204655826e8f67f6a6
export const vistoriasService = {
  subscribe: subscribeVistorias,
  listAll(): Vistoria[] {
    return listVistorias();
  },
  listByProposal(proposalId: string): Vistoria[] {
    return listVistoriasByProposal(proposalId);
  },
  getById(id: string): Vistoria | null {
    return getVistoriaById(id);
  },
  create(input: {
    proposal_id: string;
    fase: VistoriaFase;
    agendada_para: string;
    local_texto: string;
    checklist: VistoriaChecklist;
    observacoes?: string;
    anexos?: VistoriaAnexoMeta[];
  }, actorRole: string) {
    return createVistoria(input, actorRole);
  },
  updateSchedule(id: string, agendadaPara: string, actorRole: string) {
    return updateVistoriaSchedule(id, agendadaPara, actorRole);
  },
  updateChecklist(id: string, checklist: VistoriaChecklist, actorRole: string) {
    return updateVistoriaChecklist(id, checklist, actorRole);
  },
  addAnexos(id: string, files: FileList, tipo: "foto" | "arquivo", actorRole: string) {
    return addVistoriaAnexos(id, files, tipo, actorRole);
  },
  updateStatus(id: string, to: VistoriaStatus, actorRole: string, note?: string) {
    return updateVistoriaStatus(id, to, actorRole, note);
  },
  emitLaudo(id: string, laudo: Omit<VistoriaLaudo, "responsavel_role">, actorRole: string) {
    return emitVistoriaLaudo(id, laudo, actorRole);
  },
};
