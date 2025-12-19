import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listAreaRequests, subscribeAreaRequests } from "../storage/area_requests";

const LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  em_verificacao: "Em verificação",
  aprovada: "Aprovada",
  indeferida: "Indeferida",
};

export function ManagerAreaRequestsPage() {
  const { role } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeAreaRequests(() => setTick((t) => t + 1)), []);
  const all = useMemo(() => listAreaRequests(), [tick]);

  const can_view = role === "administrador" || role === "gestor_semad";

  if (!can_view) {
    return (
      <div className="container">
        <div className="page">
          <div className="card pad">Acesso restrito (somente gestor SEMAD / administrador).</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Solicitações de áreas não cadastradas</h1>
            <p className="page__subtitle">Verificação SisGeo → Aprovação (cadastra área + gera proposta) ou Indeferimento.</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/gestor/kanban">
              Voltar ao Kanban
            </Link>
          </div>
        </header>

        {all.length === 0 ? (
          <div className="card pad">Nenhuma solicitação encontrada.</div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {all.map((r) => (
              <article className="card pad" key={r.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>{r.codigo_protocolo}</strong>
                    <div className="muted">{r.localizacao_descritiva}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="pill">{LABEL[r.status] ?? r.status}</span>
                    <Link className="btn btn--subtle" to={`/gestor/solicitacoes-area/${encodeURIComponent(r.id)}`}>
                      Abrir
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}