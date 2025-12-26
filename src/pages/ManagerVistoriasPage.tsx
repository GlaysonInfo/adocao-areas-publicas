import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { subscribeVistorias, listVistorias } from "../storage/vistorias";

function stripAccents(s: string) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesSmart(hay: string, needle: string) {
  const H = stripAccents(hay);
  const N = stripAccents(needle);
  if (!N.trim()) return true;
  return H.includes(N.trim());
}

function fmtBR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR");
}

export function ManagerVistoriasPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // tick de storage
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeVistorias(() => setTick((t) => t + 1)), []);

  // dados (fonte: storage/localStorage)
  const all = useMemo(() => listVistorias(), [tick]);

  // estado dos filtros (inicial vindo da URL)
  const [proposalId, setProposalId] = useState<string>(sp.get("proposal_id") ?? "");
  const [fase, setFase] = useState<string>(sp.get("fase") ?? "");
  const [status, setStatus] = useState<string>(sp.get("status") ?? "");
  const [q, setQ] = useState<string>(sp.get("q") ?? "");

  // opções dinâmicas (derivadas do localStorage)
  const fases = useMemo(() => {
    const set = new Set<string>();
    for (const v of all as any[]) {
      const f = String((v as any)?.fase ?? "").trim();
      if (f) set.add(f);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const v of all as any[]) {
      const s = String((v as any)?.status ?? "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all]);

  // aplicar/limpar filtros = atualizar URL (evidência: reproduzível só pela querystring + localStorage)
  function applyFilters() {
    const next = new URLSearchParams();
    if (proposalId.trim()) next.set("proposal_id", proposalId.trim());
    if (fase.trim()) next.set("fase", fase.trim());
    if (status.trim()) next.set("status", status.trim());
    if (q.trim()) next.set("q", q.trim());
    setSp(next, { replace: true });
  }

  function clearFilters() {
    setProposalId("");
    setFase("");
    setStatus("");
    setQ("");
    setSp(new URLSearchParams(), { replace: true });
  }

  // resultado filtrado (somente leitura do all)
  const filtered = useMemo(() => {
    const pid = proposalId.trim();
    const f = fase.trim();
    const s = status.trim();
    const qq = q.trim();

    return (all as any[])
      .filter((v) => {
        if (pid && String(v?.proposal_id ?? "") !== pid) return false;
        if (f && String(v?.fase ?? "") !== f) return false;
        if (s && String(v?.status ?? "") !== s) return false;
        if (qq && !includesSmart(String(v?.local_texto ?? ""), qq)) return false;
        return true;
      })
      .sort((a, b) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")));
  }, [all, proposalId, fase, status, q]);

  const itemsCount = filtered.length;

  const newVistoriaUrl = useMemo(() => {
    const pid = proposalId.trim();
    return pid
      ? `/gestor/vistorias/nova?proposal_id=${encodeURIComponent(pid)}`
      : "/gestor/vistorias/nova";
  }, [proposalId]);

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Vistorias</h1>
            <p className="page__subtitle">Filtro por proposta, fase, status e busca por local.</p>
          </div>

          <div className="page__actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--primary" to={newVistoriaUrl}>
              Nova vistoria
            </Link>
            <button type="button" className="btn btn--subtle" onClick={() => setTick((t) => t + 1)}>
              Atualizar
            </button>
          </div>
        </header>

        <section className="card pad">
          <div className="grid cols-4" style={{ alignItems: "end", gap: 12 }}>
            <label style={{ fontWeight: 800 }}>
              proposal_id (opcional)
              <input
                value={proposalId}
                onChange={(e) => setProposalId(e.target.value)}
                placeholder="Cole o proposal_id aqui"
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              />
            </label>

            <label style={{ fontWeight: 800 }}>
              fase
              <select
                value={fase}
                onChange={(e) => setFase(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <option value="">(todas)</option>
                {fases.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontWeight: 800 }}>
              status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <option value="">(todos)</option>
                {statuses.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontWeight: 800 }}>
              busca por local
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex.: praça, canteiro, avenida..."
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="btn" onClick={applyFilters}>
              Aplicar filtro
            </button>
            <button type="button" className="btn btn--subtle" onClick={clearFilters}>
              Limpar
            </button>

            <div style={{ marginLeft: "auto", opacity: 0.8, alignSelf: "center" }}>
              Itens: <strong>{itemsCount}</strong>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 12 }} className="grid" aria-label="Lista de vistorias">
          {filtered.map((v: any) => (
            <div key={v.id} className="card pad">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>
                    {v.codigo_protocolo ?? "—"} · {v.status ?? "—"}
                  </strong>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Área: {v.area_nome ?? "—"}
                  </div>
                  <div className="muted">Agendada: {fmtBR(v.agendada_para)}</div>
                  <div className="muted">Local: {v.local_texto ?? "—"}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <Link className="btn btn--subtle" to={`/gestor/vistorias/${encodeURIComponent(v.id)}`}>
                    Abrir
                  </Link>
                  {v.proposal_id ? (
                    <button
                      type="button"
                      className="btn btn--subtle"
                      onClick={() => navigate(`/gestor/propostas/${encodeURIComponent(v.proposal_id)}`)}
                    >
                      Ver proposta
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="card pad">
              <div className="muted">Sem itens para os filtros atuais.</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}