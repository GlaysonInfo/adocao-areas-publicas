import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { listMyProposals, subscribeProposals } from "../storage/proposals";

export function MyProposalsPage() {
  const { role } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const items = useMemo(() => listMyProposals(role), [role, tick]);

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Minhas Propostas</h1>
            <p className="page__subtitle">Acompanhe o andamento das suas propostas.</p>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Nenhuma proposta encontrada</h3>
            <p>Crie uma nova proposta a partir de uma área disponível.</p>
            <Link className="btn btn--primary" to="/propostas/nova">
              Nova proposta
            </Link>
          </div>
        ) : (
          <div className="list">
            {items.map((p) => (
              <article key={p.id} className="card pad item">
                <div className="item__head">
                  <div>
                    <h3 className="item__title">{p.codigo_protocolo}</h3>
                    <div className="item__meta">
                      <strong>Área:</strong> {p.area_nome}
                    </div>
                    <div className="item__meta">
                      <strong>Status técnico:</strong> {p.kanban_coluna}
                    </div>
                  </div>

                  <div className="item__actions">
                    <Link className="btn btn--subtle" to={`/minhas-propostas/${encodeURIComponent(p.id)}`}>
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