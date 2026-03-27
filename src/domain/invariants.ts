// src/domain/invariants.ts
import type { AreaPublica } from "./area";
import type { PropostaAdocao } from "./proposal";

export type InvariantCheck = {
  ok: boolean;
  code: string;
  message: string;
  meta?: Record<string, unknown>;
};

export function isProposalClosed(p: Pick<PropostaAdocao, "closed_status" | "closed_at" | "kanban_coluna">) {
  return !!p.closed_status || !!p.closed_at || p.kanban_coluna === "termo_assinado" || p.kanban_coluna === "indeferida";
}

export function getOpenProposalsByArea(proposals: PropostaAdocao[], area_id: string) {
  return proposals.filter((p) => p.area_id === area_id && !isProposalClosed(p));
}

export function checkOnlyOneOpenProposalPerArea(proposals: PropostaAdocao[]): InvariantCheck[] {
  const grouped = new Map<string, PropostaAdocao[]>();

  for (const p of proposals) {
    if (isProposalClosed(p)) continue;
    const arr = grouped.get(p.area_id) ?? [];
    arr.push(p);
    grouped.set(p.area_id, arr);
  }

  const checks: InvariantCheck[] = [];
  for (const [area_id, arr] of grouped.entries()) {
    if (arr.length > 1) {
      checks.push({
        ok: false,
        code: "INV_OPEN_PROPOSALS_PER_AREA",
        message: `Há mais de uma proposta aberta para a área ${area_id}.`,
        meta: {
          area_id,
          proposal_ids: arr.map((p) => p.id),
          count: arr.length,
        },
      });
    }
  }

  return checks;
}

export function expectedAreaStatusFromProposals(area: AreaPublica, proposals: PropostaAdocao[]) {
  const related = proposals.filter((p) => p.area_id === area.id);

  const hasApproved = related.some(
    (p) => p.closed_status === "approved" || p.kanban_coluna === "termo_assinado"
  );
  if (hasApproved) return "adotada" as const;

  const hasOpen = related.some((p) => !isProposalClosed(p));
  if (hasOpen) return "em_adocao" as const;

  return "disponivel" as const;
}

export function checkAreaStatusConsistency(areas: AreaPublica[], proposals: PropostaAdocao[]): InvariantCheck[] {
  const checks: InvariantCheck[] = [];

  for (const area of areas) {
    const expected = expectedAreaStatusFromProposals(area, proposals);
    if (area.status !== expected) {
      checks.push({
        ok: false,
        code: "INV_AREA_STATUS_CONSISTENCY",
        message: `Status inconsistente para a área ${area.codigo}: atual=${area.status}, esperado=${expected}.`,
        meta: {
          area_id: area.id,
          area_codigo: area.codigo,
          current_status: area.status,
          expected_status: expected,
        },
      });
    }
  }

  return checks;
}

export function checkProposalHasHistory(proposals: PropostaAdocao[]): InvariantCheck[] {
  return proposals
    .filter((p) => !Array.isArray(p.history) || p.history.length === 0)
    .map((p) => ({
      ok: false,
      code: "INV_PROPOSAL_HISTORY_REQUIRED",
      message: `A proposta ${p.codigo_protocolo} não possui histórico de eventos.`,
      meta: {
        proposal_id: p.id,
        codigo_protocolo: p.codigo_protocolo,
      },
    }));
}

export function runDomainInvariantChecks(input: {
  areas: AreaPublica[];
  proposals: PropostaAdocao[];
}): InvariantCheck[] {
  return [
    ...checkOnlyOneOpenProposalPerArea(input.proposals),
    ...checkAreaStatusConsistency(input.areas, input.proposals),
    ...checkProposalHasHistory(input.proposals),
  ];
}
