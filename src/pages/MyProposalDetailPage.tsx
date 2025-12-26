import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getProposalById, subscribeProposals } from "../storage/proposals";
import { listVistoriasByProposal, subscribeVistorias } from "../storage/vistorias";

function fmtBR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR");
}

export function MyProposalDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const p = useMemo(() => (id ? getProposalById(id) : null), [id, tick]);

  // vistorias
  const [tickV, setTickV] = useState(0);
  useEffect(() => subscribeVistorias(() => setTickV((t) => t + 1)), []);

  const vistorias = useMemo(() => {
    if (!p?.id) return [];
    return listVistoriasByProposal(p.id);
  }, [p?.id, tickV]);

  if (!p) {
    return (
      <div className="container">
        <div className="card pad">
          <h2 style={{ marginTop: 0 }}>Proposta não encontrada</h2>
          <Link to="/minhas-propostas" className="btn">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  // compat histórico ajustes (novo + legado)
  const lastAdjust = useMemo(() => {
    const hist = Array.isArray(p.history) ? [...p.history] : [];
    const candidates = hist.filter((e: any) => {
      if (e?.type === "request_adjustments") return true;
      if (e?.type === "move" && (e?.to === "ajustes" || e?.to_coluna === "ajustes") && e?.note) return true;
      return false;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a: any, b: any) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
    return candidates[candidates.length - 1];
  }, [p.history]);

  const isInAdjustments = p.kanban_coluna === "ajustes";
  const isOwner = role != null && role === p.owner_role;

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Detalhe da Minha Proposta</h1>
            <p className="page__subtitle">
              Protocolo <strong>{p.codigo_protocolo}</strong> · {p.kanban_coluna}
            </p>
          </div>

          <div className="page__actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--subtle" to="/minhas-propostas">
              Voltar
            </Link>

            {isInAdjustments && isOwner ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate(`/minhas-propostas/${encodeURIComponent(p.id)}/editar`)}
              >
                Atender ajustes e reenviar
              </button>
            ) : null}
          </div>
        </header>

        {isInAdjustments ? (
          <section className="card pad" style={{ borderLeft: "6px solid rgba(234,179,8,.65)" }}>
            <h3 style={{ marginTop: 0 }}>Solicitação de ajustes</h3>

            <p style={{ whiteSpace: "pre-wrap", marginBottom: 10 }}>
              {lastAdjust?.note?.trim()
                ? lastAdjust.note
                : "Há uma solicitação de ajustes para esta proposta. (Motivo não registrado no histórico antigo.)"}
            </p>

            <div className="muted" style={{ marginBottom: 10 }}>
              Solicitado por: <strong>{lastAdjust?.actor_role ?? "—"}</strong> · em{" "}
              <strong>{lastAdjust?.at ?? "—"}</strong>
            </div>

            {!isOwner ? (
              <div className="muted">
                Esta proposta está em ajustes, mas <strong>somente o adotante proponente</strong> pode atender e reenviar.
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="card pad">
          <div className="item__meta">
            <strong>Área:</strong> {p.area_nome}
          </div>
          <div className="item__meta">
            <strong>Status técnico:</strong> {p.kanban_coluna}
          </div>
          <div className="item__meta">
            <strong>Criado em:</strong> {fmtBR(p.created_at)}
          </div>
          <div className="item__meta">
            <strong>Atualizado em:</strong> {fmtBR(p.updated_at)}
          </div>
        </section>

        <div className="grid cols-2" style={{ marginTop: 12 }}>
          <section className="card pad">
            <h3 style={{ marginTop: 0 }}>Plano</h3>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {p.descricao_plano?.trim() ? p.descricao_plano : "—"}
            </p>
          </section>

          <section className="card pad">
            <h3 style={{ marginTop: 0 }}>Documentos</h3>
            {p.documentos?.length ? (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {p.documentos.map((d, i) => (
                  <li key={`${d.tipo}-${i}`}>
                    <strong>{d.tipo}</strong>: {d.file_name} ({Math.round(d.file_size / 1024)} KB)
                    <div className="muted">{d.mime_type}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">Sem documentos cadastrados.</div>
            )}
          </section>
        </div>

        {/* ✅ DEVOLUTIVA — Vistorias */}
        <div className="card pad" style={{ marginTop: 12 }}>
          <h2 className="h2">Vistorias</h2>

          {vistorias.length === 0 ? (
            <div className="muted">Nenhuma vistoria registrada.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {vistorias.map((v: any) => (
                <div key={v.id} className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>
                      {v.fase ?? "—"} · {v.status ?? "—"}
                    </strong>
                    <span className="muted">Agendada: {fmtBR(v.agendada_para)}</span>
                  </div>

                  <div className="muted" style={{ marginTop: 6 }}>
                    Local: {v.local_texto ?? "—"}
                  </div>

                  {v.laudo ? (
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <strong>Laudo:</strong> {v.laudo.conclusao ?? "—"} · emitido em{" "}
                        {fmtBR(v.laudo.emitido_em)}
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        Responsável: {v.laudo.responsavel_role ?? "—"}
                      </div>
                      {v.laudo.recomendacoes ? (
                        <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                          {v.laudo.recomendacoes}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 8 }}>
                      Laudo ainda não emitido.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Histórico</h3>
          {p.history?.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {p.history.map((e) => (
                <li key={e.id}>
                  <strong>{fmtBR(e.at)}</strong> — <strong>{e.actor_role}</strong> — {e.type}
                  {e.from || e.to ? ` (${e.from ?? "—"} → ${e.to ?? "—"})` : ""}
                  {e.note ? ` — ${e.note}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">Sem eventos ainda.</div>
          )}
        </section>
      </div>
    </div>
  );
}