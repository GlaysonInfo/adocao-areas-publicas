// src/pages/AreasPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AreaPublica } from "../domain/area";
import { useAuth } from "../auth/AuthContext";
import { listAreasPublic } from "../storage/areas";

type AreaStatus = AreaPublica["status"];

function isAdopterRole(role: string | null) {
  return role === "adotante_pf" || role === "adotante_pj";
}

function statusLabel(s: AreaStatus) {
  if (s === "disponivel") return "Disponível";
  if (s === "em_adocao") return "Em adoção";
  if (s === "adotada") return "Adotada";
  return String(s);
}

function statusBadge(s: AreaStatus) {
  if (s === "disponivel") return { text: "Disponível", cls: "badge badge--success" };
  if (s === "em_adocao") return { text: "Em adoção", cls: "badge badge--warning" };
  if (s === "adotada") return { text: "Adotada", cls: "badge badge--neutral" };
  return { text: String(s), cls: "badge badge--neutral" };
}

export function AreasPage() {
  const { role } = useAuth();
  const canStart = isAdopterRole(role);

  const [searchParams] = useSearchParams();

  // fonte única de verdade: storage (inclui áreas criadas pelo admin)
  const [areas, setAreas] = useState<AreaPublica[]>(() => listAreasPublic());

  // recarrega ao entrar na página (ou quando mudar querystring)
  useEffect(() => {
    setAreas(listAreasPublic());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const [tipo, setTipo] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [bairro, setBairro] = useState<string>("todos");

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const a of areas) set.add(String(a.tipo || "—"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [areas]);

  const bairros = useMemo(() => {
    const set = new Set<string>();
    for (const a of areas) set.add(String(a.bairro || "—"));
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
            <h1 className="page__title">Áreas</h1>
            <p className="page__subtitle">
              Consulta de áreas públicas e áreas verdes (lista sem SIG). Use os filtros para localizar a área desejada.
            </p>
          </div>

          <div className="page__actions" aria-label="Ações da página">
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
                <option value="disponivel">Disponível</option>
                <option value="em_adocao">Em adoção</option>
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
              Você está com perfil de gestor/administrador. A criação de proposta é feita por perfis de adotante.
            </p>
          ) : null}
        </section>

        <section aria-label="Lista de áreas" style={{ marginTop: 14 }}>
          {filtradas.length === 0 ? (
            <div className="card pad">
              <h3>Nenhuma área encontrada</h3>
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

                        {/* Meta em linhas separadas (evita “grudar”) */}
                        <div className="item__meta">
                          <strong>Tipo:</strong> {String(a.tipo)}{" "}
                          <span aria-hidden="true">·</span>{" "}
                          <strong>Status:</strong> {statusLabel(a.status as AreaStatus)}
                        </div>

                        <div className="item__meta">
                          <strong>Bairro:</strong> {a.bairro} <span aria-hidden="true">·</span>{" "}
                          <strong>Metragem:</strong> {a.metragem_m2} m²
                        </div>

                        {a.logradouro ? (
                          <div className="item__meta">
                            <strong>Logradouro:</strong> {a.logradouro}
                          </div>
                        ) : null}
                      </div>

                      {/* Badges com espaçamento */}
                      <div className="badges" aria-label="Etiquetas da área" style={{ display: "flex", gap: 8 }}>
                        <span className={badge.cls}>{badge.text}</span>
                        <span className="badge badge--neutral">{String(a.tipo)}</span>
                      </div>
                    </div>

                    {a.restricoes ? (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ margin: 0 }}>
                          <strong>Restrições:</strong> {a.restricoes}
                        </p>
                      </div>
                    ) : null}

                    {/* Rodapé do card (CTA não sobrepõe texto) */}
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
                            Iniciar proposta para esta área
                          </Link>
                        ) : (
                          <span className="muted">Faça login como adotante para iniciar proposta.</span>
                        )
                      ) : (
                        <span className="muted">Área não disponível para iniciar proposta.</span>
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