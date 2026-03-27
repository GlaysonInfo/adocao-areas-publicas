import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { proposalsService } from "../services";
import { useHttpApiEnabled } from "../lib/feature-flags";
import { displayText } from "../lib/text";

export function MyProposalsPage() {
  const { role } = useAuth();
  const httpEnabled = useHttpApiEnabled();

  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [httpItems, setHttpItems] = useState<any[]>([]);

  useEffect(() => proposalsService.subscribe(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    if (!httpEnabled) {
      setHttpItems([]);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        await proposalsService.syncFromApi();
        const data = await proposalsService.listMineAsync(role);
        if (alive) setHttpItems(data);
      } catch (err) {
        console.error("Falha ao carregar minhas propostas via API:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [httpEnabled, role, tick]);

  const items = useMemo(() => {
    if (httpEnabled) return httpItems;
    return proposalsService.listMine(role);
  }, [httpEnabled, httpItems, role, tick]);

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Minhas Propostas</h1>
            <p className="page__subtitle">
              Acompanhe o andamento das suas propostas.
              {httpEnabled ? " · modo API" : " · modo local"}
              {loading ? " · carregando..." : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--primary" to="/propostas/nova">
              Nova proposta (área cadastrada)
            </Link>
            <Link className="btn btn--subtle" to="/solicitacoes-area/nova">
              Nova solicitação (área não cadastrada)
            </Link>
            <Link className="btn" to="/minhas-solicitacoes-area">
              Minhas solicitações
            </Link>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Nenhuma proposta encontrada</h3>
            <p>
              Crie uma nova proposta a partir de uma área disponível ou protocole uma solicitação quando a área não estiver
              cadastrada.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btn--primary" to="/propostas/nova">
                Nova proposta
              </Link>
              <Link className="btn btn--subtle" to="/solicitacoes-area/nova">
                Nova solicitação
              </Link>
            </div>
          </div>
        ) : (
          <div className="list">
            {items.map((p) => (
              <article key={p.id} className="card pad item">
                <div className="proposalRow">
                  <div className="proposalRow__main">
                    <h3 className="item__title">{displayText(p.codigo_protocolo)}</h3>

                    <div className="item__meta">
                      <strong>Área:</strong> {displayText(p.area_nome)}
                    </div>
                    <div className="item__meta">
                      <strong>Status técnico:</strong> {displayText(p.kanban_coluna)}
                    </div>
                  </div>

                  <div className="proposalRow__actions">
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