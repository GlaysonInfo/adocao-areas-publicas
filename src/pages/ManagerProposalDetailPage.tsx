// src/pages/ManagerProposalDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { KanbanColuna } from "../domain/proposal";
import { useAuth } from "../auth/AuthContext";
import { proposalsService, vistoriasService } from "../services";

// âœ… para verificar se existe laudo emitido na proposta

type Action = { label: string; to: KanbanColuna };

const STATUS_LABEL: Record<KanbanColuna, string> = {
  protocolo: "Protocolo",
  analise_semad: "AnÃ¡lise SEMAD",
  analise_ecos: "AnÃ¡lise ECOS",
  ajustes: "Ajustes",
  decisao: "DecisÃ£o",
  termo_assinado: "Termo Assinado",
  indeferida: "Indeferida",
};

function actionsFor(role: string | null, col: KanbanColuna): Action[] {
  const is_admin = role === "administrador";
  const is_semad = role === "gestor_semad";
  const is_ecos = role === "gestor_ecos";
  const is_gov = role === "gestor_governo";

  if (col === "protocolo" && (is_admin || is_semad)) {
    return [{ label: "Iniciar anÃ¡lise (SEMAD)", to: "analise_semad" }];
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
      { label: "Encaminhar p/ decisÃ£o", to: "decisao" },
      { label: "Solicitar ajustes", to: "ajustes" },
      { label: "Indeferir", to: "indeferida" },
    ];
  }

  if (col === "ajustes" && (is_admin || is_semad || is_ecos)) {
    return [{ label: "Retomar anÃ¡lise (SEMAD)", to: "analise_semad" }];
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
  if (!iso) return "â€”";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function askAjustesNote(): string | null {
  const txt = window.prompt(
    "Explique detalhadamente o motivo/orientaÃ§Ãµes para ajustes (isso serÃ¡ exibido ao adotante):",
    ""
  );
  if (txt == null) return null;
  const t = txt.trim();
  if (!t) return null;
  return t;
}

function askIndeferimentoNote(): string | null {
  const txt = window.prompt("Motivo do indeferimento (serÃ¡ exibido ao adotante):", "");
  if (txt == null) return null;
  const t = txt.trim();
  if (!t) return null;
  return t;
}

function askOverrideNoVistoriaReason(gateTo: KanbanColuna): string | null {
  const ok = window.confirm(
    `AtenÃ§Ã£o: nÃ£o foi encontrado LAUDO DE VISTORIA emitido para esta proposta.\n\n` +
      `VocÃª estÃ¡ prestes a avanÃ§ar para "${gateTo}".\n\n` +
      `Deseja fazer OVERRIDE (seguir sem vistoria)?\n` +
      `â€¢ SerÃ¡ registrado para governanÃ§a/auditoria.\n` +
      `â€¢ Motivo serÃ¡ obrigatÃ³rio.`
  );
  if (!ok) return null;

  const motivo = (window.prompt("Motivo do override (obrigatÃ³rio):", "") ?? "").trim();
  if (!motivo) return null;

  return motivo;
}

export function ManagerProposalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [tickP, setTickP] = useState(0);
  const [tickV, setTickV] = useState(0);

  useEffect(() => proposalsService.subscribe(() => setTickP((t) => t + 1)), []);
  useEffect(() => vistoriasService.subscribe(() => setTickV((t) => t + 1)), []);

  const p = useMemo(() => {
    if (!id) return null;
    return proposalsService.getById(id);
  }, [id, tickP]);

  const vistoriasDaProposta = useMemo(() => {
    if (!p?.id) return [];
    return vistoriasService.listAll().filter((v: any) => String(v?.proposal_id ?? "") === p.id);
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
          <h2 style={{ marginTop: 0 }}>Proposta nÃ£o encontrada</h2>
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
      alert("TransiÃ§Ã£o nÃ£o permitida para este perfil/etapa.");
      return;
    }

    let note: string | undefined;
    let extraEvents: any[] | undefined;

    // âœ… motivo obrigatÃ³rio (ajustes)
    if (to === "ajustes") {
      const txt = askAjustesNote();
      if (!txt) return;
      note = txt;
    }

    // âœ… motivo obrigatÃ³rio (indeferida)
    if (to === "indeferida") {
      const txt = askIndeferimentoNote();
      if (!txt) return;
      note = txt;
    }

    // âœ… GATE: decisao/termo_assinado sem laudo â†’ override + motivo obrigatÃ³rio
    const gateTargets: KanbanColuna[] = ["decisao", "termo_assinado"];
    const isGateTarget = gateTargets.includes(to);

    if (isGateTarget && !hasLaudoEmitido) {
      const motivo = askOverrideNoVistoriaReason(to);
      if (!motivo) {
        alert("Override cancelado ou motivo nÃ£o informado.");
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
      proposalsService.move(p.id, to, role ?? "unknown", note, extraEvents);
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
              Protocolo <strong>{p.codigo_protocolo}</strong> Â· Etapa: <strong>{STATUS_LABEL[col] ?? col}</strong> Â· Perfil:{" "}
              <strong>{role ?? "â€”"}</strong>
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

        {/* âœ… INFO: evidÃªncia de vistoria / laudo */}
        <section className="card pad" style={{ marginBottom: 12 }}>
          <div className="grid cols-2">
            <div>
              <strong>Vistorias vinculadas:</strong> {vistoriasDaProposta.length}
              <div className="muted" style={{ marginTop: 6 }}>
                Laudo emitido: <strong>{hasLaudoEmitido ? "SIM" : "NÃƒO"}</strong>
              </div>
            </div>
            <div>
              {latestLaudo ? (
                <div className="muted">
                  Ãšltimo laudo emitido em: <strong>{fmt(latestLaudo?.laudo?.emitido_em ?? latestLaudo?.updated_at ?? latestLaudo?.created_at)}</strong>
                </div>
              ) : (
                <div className="muted">Nenhum laudo emitido ainda.</div>
              )}
            </div>
          </div>
        </section>

        {/* Motivo de ajustes visÃ­vel tambÃ©m para o gestor */}
        {lastAjustesNote ? (
          <section className="card pad" style={{ borderLeft: "6px solid rgba(245,158,11,.7)" }}>
            <h3 style={{ marginTop: 0 }}>Motivo / orientaÃ§Ãµes de ajustes</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{lastAjustesNote}</div>
          </section>
        ) : null}

        <section className="card pad" aria-label="AÃ§Ãµes">
          <h3 style={{ marginTop: 0 }}>AÃ§Ãµes</h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canScheduleVistoria ? (
              <Link className="btn btn--subtle" to={`/gestor/vistorias/nova?proposal_id=${encodeURIComponent(p.id)}`}>
                Agendar vistoria
              </Link>
            ) : null}

            {acts.length === 0 ? (
              <span className="muted">Sem aÃ§Ãµes disponÃ­veis para esta etapa/perfil.</span>
            ) : (
              acts.map((a) => (
                <button key={a.to} type="button" className="btn" onClick={() => doMove(a.to)}>
                  {a.label}
                </button>
              ))
            )}
          </div>

          <div className="muted" style={{ marginTop: 10 }}>
            ObservaÃ§Ã£o: ao avanÃ§ar para <code>decisao</code> ou <code>termo_assinado</code> sem laudo emitido, o sistema exigirÃ¡
            confirmaÃ§Ã£o + motivo e registrarÃ¡ <code>override_no_vistoria</code> no event-log.
          </div>
        </section>

        <section className="card pad" aria-label="Resumo">
          <div className="grid cols-1">
            <div>
              <div>
                <strong>Ãrea:</strong> {p.area_nome}
              </div>
              <div>
                <strong>Status tÃ©cnico:</strong> {p.kanban_coluna}
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

        <section className="grid cols-2" aria-label="ConteÃºdo">
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Plano</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{p.descricao_plano?.trim() ? p.descricao_plano : "â€”"}</div>
          </div>

          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Documentos</h3>
            {p.documentos?.length ? (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {p.documentos.map((d: any, i: number) => (
                  <li key={`${d.tipo}-${i}`}>
                    <strong>{d.tipo}:</strong> {d.file_name} ({Math.round((d.file_size ?? 0) / 1024)} KB)
                    <div className="muted">{d.mime_type || "â€”"}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">Sem documentos cadastrados.</div>
            )}
          </div>
        </section>

        <section className="card pad" aria-label="HistÃ³rico">
          <h3 style={{ marginTop: 0 }}>HistÃ³rico</h3>

          {history.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {history.map((ev: any, i: number) => {
                const type = String(ev?.type ?? ev?.action ?? "evento");
                const actor = String(ev?.actor_role ?? ev?.actor ?? ev?.by ?? "â€”");
                const at = String(ev?.at ?? ev?.created_at ?? ev?.ts ?? "");

                const from = ev?.from ?? ev?.meta?.gate_from ?? ev?.gate_from;
                const to = ev?.to ?? ev?.meta?.gate_to ?? ev?.gate_to;

                return (
                  <li key={i}>
                    <strong>{fmt(at)}</strong> â€” <strong>{actor}</strong> â€” {type}
                    {from || to ? ` (${from ?? "â€”"} â†’ ${to ?? "â€”"})` : ""}

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






