import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getProposalById, subscribeProposals } from "../storage/proposals";

export function MyProposalDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const p = useMemo(() => (id ? getProposalById(id) : null), [id, tick]);

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

  // ✅ compatível com versões antigas e novas do MVP:
  // - novo storage: evento type="request_adjustments" com note/actor_role/at
  // - legado: às vezes o motivo vinha em move->ajustes com note
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

            {/* ✅ botão aparece SOMENTE para o adotante dono e SOMENTE quando está em AJUSTES */}
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

        {/* ✅ bloco de ajustes aparece sempre que estiver em AJUSTES (não depende mais de p.ajustes_note) */}
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
            <strong>Criado em:</strong> {p.created_at}
          </div>
          <div className="item__meta">
            <strong>Atualizado em:</strong> {p.updated_at}
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

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Histórico</h3>
          {p.history?.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {p.history.map((e) => (
                <li key={e.id}>
                  <strong>{e.at}</strong> — <strong>{e.actor_role}</strong> — {e.type}
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