import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listMyAreaRequests, subscribeAreaRequests } from "../storage/area_requests";

const LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  em_verificacao: "Em verificação (SisGeo)",
  aprovada: "Aprovada",
  indeferida: "Indeferida",
};

export function MyAreaRequestsPage() {
  const { role } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeAreaRequests(() => setTick((t) => t + 1)), []);
  const items = useMemo(() => listMyAreaRequests(role), [role, tick]);

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Minhas solicitações de área</h1>
            <p className="page__subtitle">Acompanhe aprovações/indeferimentos e, quando aprovado, acesse a proposta gerada.</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--primary" to="/solicitacoes-area/nova">
              Nova solicitação
            </Link>
            <Link className="btn" to="/propostas/nova">
              Nova proposta (área já cadastrada)
            </Link>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="card pad">Nenhuma solicitação ainda.</div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {items.map((r) => (
              <article className="card pad" key={r.id}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{r.codigo_protocolo}</strong>
                    <span className="pill">{LABEL[r.status] ?? r.status}</span>
                  </div>

                  <div className="muted">{r.localizacao_descritiva}</div>

                  {r.status === "aprovada" && r.created_proposal_id ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link className="btn btn--subtle" to={`/minhas-propostas/${encodeURIComponent(r.created_proposal_id)}`}>
                        Abrir proposta gerada
                      </Link>
                    </div>
                  ) : null}

                  {r.status === "indeferida" ? (
                    <div className="muted">
                      Motivo:{" "}
                      {(() => {
                        const last = [...(r.history ?? [])].reverse().find((e) => e.type === "decision" && (e as any).decision === "rejected");
                        return (last as any)?.decision_note ?? "—";
                      })()}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}