// src/pages/ManagerProposalDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { KanbanColuna } from "../domain/proposal";
import { getProposalById, moveProposal, subscribeProposals } from "../storage/proposals";
import { useAuth } from "../auth/AuthContext";

// ✅ para verificar se existe laudo emitido na proposta
import { listVistorias, subscribeVistorias } from "../storage/vistorias";

type Action = { label: string; to: KanbanColuna };

const STATUS_LABEL: Record<KanbanColuna, string> = {
  protocolo: "Protocolo",
  analise_semad: "Análise SEMAD",
  analise_ecos: "Análise ECOS",
  ajustes: "Ajustes",
  decisao: "Decisão",
  termo_assinado: "Termo Assinado",
  indeferida: "Indeferida",
};

function actionsFor(role: string | null, col: KanbanColuna): Action[] {
  const is_admin = role === "administrador";
  const is_semad = role === "gestor_semad";
  const is_ecos = role === "gestor_ecos";
  const is_gov = role === "gestor_governo";

  if (col === "protocolo" && (is_admin || is_semad)) {
    return [{ label: "Iniciar análise (SEMAD)", to: "analise_semad" }];
  }

  if (col === "analise_semad" && (is_admin || is_semad)) {
    return [
      { label: "Encaminhar p/ ECOS", to: "analise_ecos" },
      { label: "Solicitar ajustes", to: "ajustes" },
      { label: "Indeferir", to: "indeferida" },
    ];
  }

  if (col === "analise_ecos" && (is_admin || is_ecos)) {
    return [
      { label: "Encaminhar p/ decisão", to: "decisao" },
      { label: "Solicitar ajustes", to: "ajustes" },
      { label: "Indeferir", to: "indeferida" },
    ];
  }

  if (col === "ajustes" && (is_admin || is_semad || is_ecos)) {
    return [{ label: "Retomar análise (SEMAD)", to: "analise_semad" }];
  }

  if (col === "decisao" && (is_admin || is_gov)) {
    return [
      { label: "Aprovar (termo assinado)", to: "termo_assinado" },
      { label: "Solicitar ajustes", to: "ajustes" },
      { label: "Indeferir", to: "indeferida" },
    ];
  }

  return [];
}

function canMove(role: string | null, from: KanbanColuna, to: KanbanColuna) {
  if (from === to) return true;
  return actionsFor(role, from).some((a) => a.to === to);
}

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function askAjustesNote(): string | null {
  const txt = window.prompt(
    "Explique detalhadamente o motivo/orientações para ajustes (isso será exibido ao adotante):",
    ""
  );
  if (txt == null) return null;
  const t = txt.trim();
  if (!t) return null;
  return t;
}

function askIndeferimentoNote(): string | null {
  const txt = window.prompt("Motivo do indeferimento (será exibido ao adotante):", "");
  if (txt == null) return null;
  const t = txt.trim();
  if (!t) return null;
  return t;
}

function askOverrideNoVistoriaReason(gateTo: KanbanColuna): string | null {
  const ok = window.confirm(
    `Atenção: não foi encontrado LAUDO DE VISTORIA emitido para esta proposta.\n\n` +
      `Você está prestes a avançar para "${gateTo}".\n\n` +
      `Deseja fazer OVERRIDE (seguir sem vistoria)?\n` +
      `• Será registrado para governança/auditoria.\n` +
      `• Motivo será obrigatório.`
  );
  if (!ok) return null;

  const motivo = (window.prompt("Motivo do override (obrigatório):", "") ?? "").trim();
  if (!motivo) return null;

  return motivo;
}

export function ManagerProposalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [tickP, setTickP] = useState(0);
  const [tickV, setTickV] = useState(0);

  useEffect(() => subscribeProposals(() => setTickP((t) => t + 1)), []);
  useEffect(() => subscribeVistorias(() => setTickV((t) => t + 1)), []);

  const p = useMemo(() => {
    if (!id) return null;
    return getProposalById(id);
  }, [id, tickP]);

  const vistoriasDaProposta = useMemo(() => {
    if (!p?.id) return [];
    return listVistorias().filter((v: any) => String(v?.proposal_id ?? "") === p.id);
  }, [p?.id, tickV]);

  const hasLaudoEmitido = useMemo(() => {
    return vistoriasDaProposta.some((v: any) => String(v?.status ?? "") === "laudo_emitido");
  }, [vistoriasDaProposta]);

  const latestLaudo = useMemo(() => {
    const laudos = vistoriasDaProposta
      .filter((v: any) => String(v?.status ?? "") === "laudo_emitido")
      .sort((a: any, b: any) => String(b?.updated_at ?? b?.created_at ?? "").localeCompare(String(a?.updated_at ?? a?.created_at ?? "")));
    return laudos[0] ?? null;
  }, [vistoriasDaProposta]);

  if (!p) {
    return (
      <div className="container">
        <div className="card pad">
          <h2 style={{ marginTop: 0 }}>Proposta não encontrada</h2>
          <button type="button" className="btn" onClick={() => navigate("/gestor/kanban")}>
            Voltar ao Kanban
          </button>
        </div>
      </div>
    );
  }

  const col = p.kanban_coluna as KanbanColuna;
  const acts = actionsFor(role, col);
  const history = (p?.history ?? []) as any[];

  const lastAjustesNote = useMemo(() => {
    const hist = Array.isArray(p.history) ? [...p.history] : [];
    const candidates = hist.filter((e: any) => {
      if (e?.type === "request_adjustments") return true;
      if (e?.type === "move" && e?.to === "ajustes" && e?.note) return true;
      return false;
    });

    if (candidates.length === 0) return undefined;
    candidates.sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
    return candidates[candidates.length - 1]?.note?.trim() ? candidates[candidates.length - 1].note : undefined;
  }, [p.history]);

  const doMove = (to: KanbanColuna) => {
    if (!canMove(role, col, to)) {
      alert("Transição não permitida para este perfil/etapa.");
      return;
    }

    let note: string | undefined;
    let extraEvents: any[] | undefined;

    // ✅ motivo obrigatório (ajustes)
    if (to === "ajustes") {
      const txt = askAjustesNote();
      if (!txt) return;
      note = txt;
    }

    // ✅ motivo obrigatório (indeferida)
    if (to === "indeferida") {
      const txt = askIndeferimentoNote();
      if (!txt) return;
      note = txt;
    }

    // ✅ GATE: decisao/termo_assinado sem laudo → override + motivo obrigatório
    const gateTargets: KanbanColuna[] = ["decisao", "termo_assinado"];
    const isGateTarget = gateTargets.includes(to);

    if (isGateTarget && !hasLaudoEmitido) {
      const motivo = askOverrideNoVistoriaReason(to);
      if (!motivo) {
        alert("Override cancelado ou motivo não informado.");
        return;
      }

      extraEvents = [
        {
          type: "override_no_vistoria",
          at: new Date().toISOString(),
          actor_role: role ?? "unknown",
          note: motivo,
          meta: { gate_from: col, gate_to: to },
        },
      ];
    }

    try {
      // moveProposal(id, to, actor_role, note?, extraEvents?)
      moveProposal(p.id, to, role ?? "unknown", note, extraEvents);
      setTickP((t) => t + 1);
    } catch (e: any) {
      alert(e?.message ?? "Falha ao mover proposta.");
    }
  };

  const canScheduleVistoria = role === "gestor_semad" || role === "administrador";

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Detalhe da Proposta (Gestor)</h1>
            <p className="page__subtitle">
              Protocolo <strong>{p.codigo_protocolo}</strong> · Etapa: <strong>{STATUS_LABEL[col] ?? col}</strong> · Perfil:{" "}
              <strong>{role ?? "—"}</strong>
            </p>
          </div>

          <div className="page__actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn--subtle" onClick={() => setTickP((t) => t + 1)}>
              Atualizar
            </button>

            <Link className="btn btn--subtle" to={`/gestor/vistorias?proposal_id=${encodeURIComponent(p.id)}`}>
              Vistorias
            </Link>

            <Link className="btn btn--primary" to="/gestor/kanban">
              Voltar ao Kanban
            </Link>
          </div>
        </header>

        {/* ✅ INFO: evidência de vistoria / laudo */}
        <section className="card pad" style={{ marginBottom: 12 }}>
          <div className="grid cols-2">
            <div>
              <strong>Vistorias vinculadas:</strong> {vistoriasDaProposta.length}
              <div className="muted" style={{ marginTop: 6 }}>
                Laudo emitido: <strong>{hasLaudoEmitido ? "SIM" : "NÃO"}</strong>
              </div>
            </div>
            <div>
              {latestLaudo ? (
                <div className="muted">
                  Último laudo emitido em: <strong>{fmt(latestLaudo?.laudo?.emitido_em ?? latestLaudo?.updated_at ?? latestLaudo?.created_at)}</strong>
                </div>
              ) : (
                <div className="muted">Nenhum laudo emitido ainda.</div>
              )}
            </div>
          </div>
        </section>

        {/* Motivo de ajustes visível também para o gestor */}
        {lastAjustesNote ? (
          <section className="card pad" style={{ borderLeft: "6px solid rgba(245,158,11,.7)" }}>
            <h3 style={{ marginTop: 0 }}>Motivo / orientações de ajustes</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{lastAjustesNote}</div>
          </section>
        ) : null}

        <section className="card pad" aria-label="Ações">
          <h3 style={{ marginTop: 0 }}>Ações</h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canScheduleVistoria ? (
              <Link className="btn btn--subtle" to={`/gestor/vistorias/nova?proposal_id=${encodeURIComponent(p.id)}`}>
                Agendar vistoria
              </Link>
            ) : null}

            {acts.length === 0 ? (
              <span className="muted">Sem ações disponíveis para esta etapa/perfil.</span>
            ) : (
              acts.map((a) => (
                <button key={a.to} type="button" className="btn" onClick={() => doMove(a.to)}>
                  {a.label}
                </button>
              ))
            )}
          </div>

          <div className="muted" style={{ marginTop: 10 }}>
            Observação: ao avançar para <code>decisao</code> ou <code>termo_assinado</code> sem laudo emitido, o sistema exigirá
            confirmação + motivo e registrará <code>override_no_vistoria</code> no event-log.
          </div>
        </section>

        <section className="card pad" aria-label="Resumo">
          <div className="grid cols-1">
            <div>
              <div>
                <strong>Área:</strong> {p.area_nome}
              </div>
              <div>
                <strong>Status técnico:</strong> {p.kanban_coluna}
              </div>
            </div>

            <div>
              <div>
                <strong>Criado em:</strong> {fmt(p.created_at)}
              </div>
              <div>
                <strong>Atualizado em:</strong> {fmt(p.updated_at)}
              </div>
            </div>
          </div>
        </section>

        <section className="grid cols-2" aria-label="Conteúdo">
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Plano</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{p.descricao_plano?.trim() ? p.descricao_plano : "—"}</div>
          </div>

          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Documentos</h3>
            {p.documentos?.length ? (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {p.documentos.map((d: any, i: number) => (
                  <li key={`${d.tipo}-${i}`}>
                    <strong>{d.tipo}:</strong> {d.file_name} ({Math.round((d.file_size ?? 0) / 1024)} KB)
                    <div className="muted">{d.mime_type || "—"}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">Sem documentos cadastrados.</div>
            )}
          </div>
        </section>

        <section className="card pad" aria-label="Histórico">
          <h3 style={{ marginTop: 0 }}>Histórico</h3>

          {history.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {history.map((ev: any, i: number) => {
                const type = String(ev?.type ?? ev?.action ?? "evento");
                const actor = String(ev?.actor_role ?? ev?.actor ?? ev?.by ?? "—");
                const at = String(ev?.at ?? ev?.created_at ?? ev?.ts ?? "");

                const from = ev?.from ?? ev?.meta?.gate_from ?? ev?.gate_from;
                const to = ev?.to ?? ev?.meta?.gate_to ?? ev?.gate_to;

                return (
                  <li key={i}>
                    <strong>{fmt(at)}</strong> — <strong>{actor}</strong> — {type}
                    {from || to ? ` (${from ?? "—"} → ${to ?? "—"})` : ""}

                    {ev?.note ? (
                      <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                        <em>{String(ev.note)}</em>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="muted">Sem eventos ainda.</div>
          )}
        </section>
      </div>
    </div>
  );
}