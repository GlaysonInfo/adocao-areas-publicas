// src/storage/area_request_reports.ts
import type { AreaRequest, AreaRequestEvent, SisGeoResultado } from "../domain/area_request";
import { listAreaRequests } from "./area_requests";

type RequestEventRow = AreaRequestEvent & {
  request_id: string;
  codigo_protocolo: string;
  status_atual: string;
};

function toMs(iso: string) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

function listRequestEventRows(): RequestEventRow[] {
  const reqs = listAreaRequests();
  const rows: RequestEventRow[] = [];

  for (const r of reqs) {
    for (const ev of r.history ?? []) {
      rows.push({
        ...(ev as any),
        request_id: r.id,
        codigo_protocolo: r.codigo_protocolo,
        status_atual: r.status,
      });
    }
  }

  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return rows;
}

function listRequestEventRowsBetween(fromIso: string, toIso: string): RequestEventRow[] {
  const a = toMs(fromIso);
  const b = toMs(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  return listRequestEventRows().filter((e) => {
    const t = toMs(e.at);
    return Number.isFinite(t) && t >= a && t <= b;
  });
}

function firstEventAt(r: AreaRequest, type: AreaRequestEvent["type"]): string | null {
  const ev = (r.history ?? []).find((e) => e.type === type);
  return ev?.at ?? null;
}

function decisionEvent(r: AreaRequest): (AreaRequestEvent & { type: "decision" }) | null {
  const ev = [...(r.history ?? [])].reverse().find((e) => e.type === "decision");
  return (ev as any) ?? null;
}

function isSemadRole(role: string) {
  return String(role ?? "") === "gestor_semad";
}

/**
 * Métricas de Solicitações de Área (fora do Kanban).
 * Evidência: events em mvp_area_requests_v1[].history
 */
export function computeAreaRequestMetrics(fromIso: string, toIso: string) {
  const reqs = listAreaRequests();

  const startMs = toMs(fromIso);
  const endMs = toMs(toIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return {
      qtd_solicitacoes_criadas: 0,
      qtd_solicitacoes_em_verificacao: 0,
      qtd_solicitacoes_decididas: 0,
      qtd_solicitacoes_deferidas: 0,
      qtd_solicitacoes_indeferidas: 0,
      tempo_medio_verificacao_sisgeo_ms: null as number | null,
      tempo_medio_resposta_solicitacao_ms: null as number | null,
      amostras_verificacao: 0,
      amostras_resposta: 0,
    };
  }

  // eventos no período
  const evs = listRequestEventRowsBetween(fromIso, toIso);

  const qtd_solicitacoes_criadas = evs.filter((e) => e.type === "create").length;
  const qtd_solicitacoes_em_verificacao = evs.filter((e) => e.type === "start_verification").length;

  const decisions = evs.filter((e) => e.type === "decision") as any[];
  const qtd_solicitacoes_decididas = decisions.length;
  const qtd_solicitacoes_deferidas = decisions.filter((e) => e.decision === "approved").length;
  const qtd_solicitacoes_indeferidas = decisions.filter((e) => e.decision === "rejected").length;

  // tempos (por solicitação decidida)
  const dur_verificacao: number[] = [];
  const dur_resposta: number[] = [];

  for (const r of reqs) {
    const created = toMs(r.created_at);
    if (!Number.isFinite(created)) continue;

    const dec = decisionEvent(r);
    if (!dec) continue;

    const decAt = toMs(dec.at);
    if (!Number.isFinite(decAt)) continue;

    // considerar somente decisões dentro do período
    if (decAt < startMs || decAt > endMs) continue;

    // resposta = decisão - criação
    dur_resposta.push(decAt - created);

    // verificação SisGeo = decisão - start_verification (fallback: created_at)
    const startVer = firstEventAt(r, "start_verification");
    const base = startVer ? toMs(startVer) : created;
    if (Number.isFinite(base)) dur_verificacao.push(decAt - base);
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  return {
    qtd_solicitacoes_criadas,
    qtd_solicitacoes_em_verificacao,
    qtd_solicitacoes_decididas,
    qtd_solicitacoes_deferidas,
    qtd_solicitacoes_indeferidas,
    tempo_medio_verificacao_sisgeo_ms: avg(dur_verificacao),
    tempo_medio_resposta_solicitacao_ms: avg(dur_resposta),
    amostras_verificacao: dur_verificacao.length,
    amostras_resposta: dur_resposta.length,
  };
}

/**
 * Produtividade SEMAD (Solicitações): ações do role gestor_semad no event-log.
 * Evidência: history[].actor_role === "gestor_semad"
 */
export function computeSemadProductivityAreaRequests(fromIso: string, toIso: string) {
  const evs = listRequestEventRowsBetween(fromIso, toIso);

  const semadEvents = evs.filter((e) => isSemadRole(e.actor_role));

  const total_actions = semadEvents.length;
  const total_start_verification = semadEvents.filter((e) => e.type === "start_verification").length;
  const total_sisgeo_updates = semadEvents.filter((e) => e.type === "sisgeo_update").length;

  const semadDecisions = semadEvents.filter((e) => e.type === "decision") as any[];
  const total_decisions = semadDecisions.length;
  const total_deferidas = semadDecisions.filter((e) => e.decision === "approved").length;
  const total_indeferidas = semadDecisions.filter((e) => e.decision === "rejected").length;

  const touched = new Set<string>();
  for (const e of semadEvents) touched.add((e as any).request_id);

  // transições simples (estado lógico)
  // start_verification: solicitada→em_verificacao
  // decision: em_verificacao→aprovada/indeferida (ou solicitada→...)
  const transCount = new Map<string, number>();
  for (const e of semadEvents) {
    if (e.type === "start_verification") {
      transCount.set("solicitada→em_verificacao", (transCount.get("solicitada→em_verificacao") ?? 0) + 1);
    }
    if (e.type === "decision") {
      const d = (e as any).decision;
      const key = d === "approved" ? "em_verificacao→aprovada" : "em_verificacao→indeferida";
      transCount.set(key, (transCount.get(key) ?? 0) + 1);
    }
  }

  const transitions = Array.from(transCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));

  return {
    total_actions,
    total_start_verification,
    total_sisgeo_updates,
    total_decisions,
    total_deferidas,
    total_indeferidas,
    requests_touched: touched.size,
    transitions,
  };
}