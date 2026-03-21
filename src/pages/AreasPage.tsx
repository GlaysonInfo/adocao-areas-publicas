// src/pages/AreasPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AreaPublica } from "../domain/area";
import { useAuth } from "../auth/AuthContext";
import { areasService } from "../services";

type AreaStatus = AreaPublica["status"];

function isAdopterRole(role: string | null) {
  return role === "adotante_pf" || role === "adotante_pj";
}

function statusLabel(s: AreaStatus) {
  if (s === "disponivel") return "DisponÃ­vel";
  if (s === "em_adocao") return "Em adoÃ§Ã£o";
  if (s === "adotada") return "Adotada";
  return String(s);
}

function statusBadge(s: AreaStatus) {
  if (s === "disponivel") return { text: "DisponÃ­vel", cls: "badge badge--success" };
  if (s === "em_adocao") return { text: "Em adoÃ§Ã£o", cls: "badge badge--warning" };
  if (s === "adotada") return { text: "Adotada", cls: "badge badge--neutral" };
  return { text: String(s), cls: "badge badge--neutral" };
}

export function AreasPage() {
  const { role } = useAuth();
  const canStart = isAdopterRole(role);

  const [searchParams] = useSearchParams();

  // fonte Ãºnica de verdade: storage (inclui Ã¡reas criadas pelo admin)
  const [areas, setAreas] = useState<AreaPublica[]>(() => areasService.listPublic());

  // recarrega ao entrar na pÃ¡gina (ou quando mudar querystring)
  useEffect(() => {
    setAreas(areasService.listPublic());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const [tipo, setTipo] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [bairro, setBairro] = useState<string>("todos");

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const a of areas) set.add(String(a.tipo || "â€”"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [areas]);

  const bairros = useMemo(() => {
    const set = new Set<string>();
    for (const a of areas) set.add(String(a.bairro || "â€”"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [areas]);

  const filtradas = useMemo(() => {
    return areas.filter((a) => {
      const okTipo = tipo === "todos" ? true : String(a.tipo) === tipo;
      const okStatus = status === "todos" ? true : String(a.status) === status;
      const okBairro = bairro === "todos" ? true : String(a.bairro) === bairro;
      return okTipo && okStatus && okBairro;
    });
  }, [areas, tipo, status, bairro]);

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Ãreas</h1>
            <p className="page__subtitle">
              Consulta de Ã¡reas pÃºblicas e Ã¡reas verdes (lista sem SIG). Use os filtros para localizar a Ã¡rea desejada.
            </p>
          </div>

          <div className="page__actions" aria-label="AÃ§Ãµes da pÃ¡gina">
            <button
              type="button"
              className="btn btn--subtle"
              onClick={() => {
                setTipo("todos");
                setStatus("todos");
                setBairro("todos");
              }}
            >
              Limpar filtros
            </button>

            {canStart ? (
              <Link className="btn btn--primary" to="/propostas/nova">
                Nova proposta
              </Link>
            ) : null}
          </div>
        </header>

        <section className="card pad" aria-label="Filtros de busca">
          <div className="filters">
            <div className="field">
              <label htmlFor="f_tipo">Tipo</label>
              <select id="f_tipo" className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="todos">Todos</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="f_status">Status</label>
              <select id="f_status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="disponivel">DisponÃ­vel</option>
                <option value="em_adocao">Em adoÃ§Ã£o</option>
                <option value="adotada">Adotada</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="f_bairro">Bairro</label>
              <select id="f_bairro" className="select" value={bairro} onChange={(e) => setBairro(e.target.value)}>
                <option value="todos">Todos</option>
                {bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="sr-only" htmlFor="f_count">
                Contagem
              </label>
              <div id="f_count" className="badge badge--neutral" style={{ justifyContent: "center" }}>
                {filtradas.length} resultado(s)
              </div>
            </div>
          </div>

          {!canStart ? (
            <p className="muted" style={{ marginTop: 12 }}>
              VocÃª estÃ¡ com perfil de gestor/administrador. A criaÃ§Ã£o de proposta Ã© feita por perfis de adotante.
            </p>
          ) : null}
        </section>

        <section aria-label="Lista de Ã¡reas" style={{ marginTop: 14 }}>
          {filtradas.length === 0 ? (
            <div className="card pad">
              <h3>Nenhuma Ã¡rea encontrada</h3>
              <p>Tente ajustar os filtros.</p>
            </div>
          ) : (
            <div className="list">
              {filtradas.map((a) => {
                const badge = statusBadge(a.status as AreaStatus);
                const isDisponivel = a.status === "disponivel";

                return (
                  <article key={a.id} className="card pad item">
                    <div className="item__head">
                      <div style={{ minWidth: 0 }}>
                        <h3 className="item__title" style={{ marginBottom: 6 }}>
                          {a.nome}
                        </h3>

                        {/* Meta em linhas separadas (evita â€œgrudarâ€) */}
                        <div className="item__meta">
                          <strong>Tipo:</strong> {String(a.tipo)}{" "}
                          <span aria-hidden="true">Â·</span>{" "}
                          <strong>Status:</strong> {statusLabel(a.status as AreaStatus)}
                        </div>

                        <div className="item__meta">
                          <strong>Bairro:</strong> {a.bairro} <span aria-hidden="true">Â·</span>{" "}
                          <strong>Metragem:</strong> {a.metragem_m2} mÂ²
                        </div>

                        {a.logradouro ? (
                          <div className="item__meta">
                            <strong>Logradouro:</strong> {a.logradouro}
                          </div>
                        ) : null}
                      </div>

                      {/* Badges com espaÃ§amento */}
                      <div className="badges" aria-label="Etiquetas da Ã¡rea" style={{ display: "flex", gap: 8 }}>
                        <span className={badge.cls}>{badge.text}</span>
                        <span className="badge badge--neutral">{String(a.tipo)}</span>
                      </div>
                    </div>

                    {a.restricoes ? (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ margin: 0 }}>
                          <strong>RestriÃ§Ãµes:</strong> {a.restricoes}
                        </p>
                      </div>
                    ) : null}

                    {/* RodapÃ© do card (CTA nÃ£o sobrepÃµe texto) */}
                    <div
                      className="item__actions"
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {isDisponivel ? (
                        canStart ? (
                          <Link className="btn btn--primary" to={`/propostas/nova?area_id=${encodeURIComponent(a.id)}`}>
                            Iniciar proposta para esta Ã¡rea
                          </Link>
                        ) : (
                          <span className="muted">FaÃ§a login como adotante para iniciar proposta.</span>
                        )
                      ) : (
                        <span className="muted">Ãrea nÃ£o disponÃ­vel para iniciar proposta.</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}





