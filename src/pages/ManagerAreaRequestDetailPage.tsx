import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

import { decideAreaRequest, getAreaRequestById, setAreaDraft, startVerification, subscribeAreaRequests, updateSisGeo } from "../storage/area_requests";
import type { SisGeoResultado } from "../domain/area_request";

const LABEL: Record<string, string> = {
  solicitada: "Solicitada",
  em_verificacao: "Em verificação",
  aprovada: "Aprovada",
  indeferida: "Indeferida",
};

const SISGEO_OPTIONS: { value: SisGeoResultado; label: string }[] = [
  { value: "publica_disponivel", label: "Pública e disponível" },
  { value: "publica_indisponivel", label: "Pública e indisponível" },
  { value: "nao_publica", label: "Não é pública" },
  { value: "nao_encontrada", label: "Não encontrada no SisGeo" },
  { value: "uso_incompativel", label: "Uso pretendido incompatível" },
];

function num(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ManagerAreaRequestDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => subscribeAreaRequests(() => setTick((t) => t + 1)), []);

  const r = useMemo(() => (id ? getAreaRequestById(id) : null), [id, tick]);

  const can_view = role === "administrador" || role === "gestor_semad";

  const [sisgeo_resultado, setSisgeoResultado] = useState<SisGeoResultado>("publica_disponivel");
  const [sisgeo_ref, setSisgeoRef] = useState("");
  const [sisgeo_note, setSisgeoNote] = useState("");

  const [area_codigo, setAreaCodigo] = useState("");
  const [area_nome, setAreaNome] = useState("");
  const [area_tipo, setAreaTipo] = useState("—");
  const [area_bairro, setAreaBairro] = useState("—");
  const [area_logradouro, setAreaLogradouro] = useState("—");
  const [area_metragem, setAreaMetragem] = useState<number>(0);

  useEffect(() => {
    if (!r) return;

    if (r.sisgeo_resultado) setSisgeoResultado(r.sisgeo_resultado);
    if (r.sisgeo_ref) setSisgeoRef(r.sisgeo_ref);
    if (r.sisgeo_note) setSisgeoNote(r.sisgeo_note);

    if (r.area_draft) {
      setAreaCodigo(r.area_draft.codigo);
      setAreaNome(r.area_draft.nome);
      setAreaTipo(r.area_draft.tipo);
      setAreaBairro(r.area_draft.bairro);
      setAreaLogradouro(r.area_draft.logradouro);
      setAreaMetragem(r.area_draft.metragem_m2);
    } else {
      const fallbackCode = `AREA-${String(r.codigo_protocolo ?? "").replaceAll("-", "")}`;
      setAreaCodigo(fallbackCode.slice(0, 24));
      setAreaNome(`Área solicitada (${r.codigo_protocolo})`);
      setAreaTipo("—");
      setAreaBairro("—");
      setAreaLogradouro("—");
      setAreaMetragem(0);
    }
  }, [r?.id]);

  if (!can_view) {
    return (
      <div className="container">
        <div className="page">
          <div className="card pad">Acesso restrito (somente gestor SEMAD / administrador).</div>
        </div>
      </div>
    );
  }

  if (!r) {
    return (
      <div className="container">
        <div className="page">
          <div className="card pad">Solicitação não encontrada.</div>
        </div>
      </div>
    );
  }

  const actor_role = role ?? "gestor_semad";
  const is_closed = r.status === "aprovada" || r.status === "indeferida";

  const saveSisgeo = () => {
    try {
      updateSisGeo(r.id, { sisgeo_resultado, sisgeo_ref: sisgeo_ref.trim() || undefined, sisgeo_note: sisgeo_note.trim() || undefined }, actor_role);
      alert("SisGeo atualizado.");
    } catch (e: any) {
      alert(e?.message ?? "Erro ao atualizar SisGeo.");
    }
  };

  const saveAreaDraft = () => {
    try {
      setAreaDraft(r.id, {
        codigo: area_codigo.trim(),
        nome: area_nome.trim(),
        tipo: area_tipo.trim(),
        bairro: area_bairro.trim(),
        logradouro: area_logradouro.trim(),
        metragem_m2: num(area_metragem),
      });
      alert("Cadastro da área (rascunho) salvo.");
    } catch (e: any) {
      alert(e?.message ?? "Erro ao salvar rascunho.");
    }
  };

  const doStartVerification = () => {
    try {
      startVerification(r.id, actor_role);
    } catch (e: any) {
      alert(e?.message ?? "Erro ao iniciar verificação.");
    }
  };

  const doReject = () => {
    const note = window.prompt("Motivo do indeferimento (será exibido ao adotante):", "");
    if (note == null) return;
    const t = note.trim();
    if (!t) return;

    try {
      decideAreaRequest(r.id, { decision: "rejected", decision_note: t }, actor_role);
      navigate("/gestor/solicitacoes-area", { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Erro ao indeferir.");
    }
  };

  const doApprove = () => {
    try {
      const next = decideAreaRequest(
        r.id,
        {
          decision: "approved",
          decision_note: "Aprovada após verificação SisGeo.",
          area_draft: {
            codigo: area_codigo.trim(),
            nome: area_nome.trim(),
            tipo: area_tipo.trim(),
            bairro: area_bairro.trim(),
            logradouro: area_logradouro.trim(),
            metragem_m2: num(area_metragem),
          },
        },
        actor_role
      );

      if (next.created_proposal_id) {
        navigate(`/gestor/propostas/${encodeURIComponent(next.created_proposal_id)}`, { replace: true });
        return;
      }
      navigate("/gestor/solicitacoes-area", { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Erro ao aprovar.");
    }
  };

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Solicitação {r.codigo_protocolo}</h1>
            <p className="page__subtitle">{LABEL[r.status] ?? r.status}</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/gestor/solicitacoes-area">Voltar</Link>
            {r.created_proposal_id ? (
              <Link className="btn btn--subtle" to={`/gestor/propostas/${encodeURIComponent(r.created_proposal_id)}`}>
                Abrir proposta gerada
              </Link>
            ) : null}
          </div>
        </header>

        <div className="card pad" style={{ display: "grid", gap: 12 }}>
          <div><strong>Localização:</strong> <span className="muted">{r.localizacao_descritiva}</span></div>
          {r.geo ? (
            <div className="muted">Coordenadas: lat={r.geo.lat} lng={r.geo.lng} (≈{r.geo.accuracy_m ?? "—"}m) em {r.geo.captured_at}</div>
          ) : (
            <div className="muted">Sem coordenadas.</div>
          )}
          <div>
            <strong>Intervenção:</strong>
            <div className="muted">{r.descricao_intervencao}</div>
          </div>

          {!is_closed && r.status === "solicitada" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn--subtle" type="button" onClick={doStartVerification}>
                Iniciar verificação
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid" style={{ gap: 12, marginTop: 12 }}>
          <div className="card pad" style={{ display: "grid", gap: 10 }}>
            <h2 className="h2">Verificação SisGeo</h2>

            <label>
              Resultado
              <select className="input" value={sisgeo_resultado} onChange={(e) => setSisgeoResultado(e.target.value as any)} disabled={is_closed}>
                {SISGEO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label>
              Referência SisGeo (opcional)
              <input className="input" value={sisgeo_ref} onChange={(e) => setSisgeoRef(e.target.value)} disabled={is_closed} />
            </label>

            <label>
              Observação (opcional)
              <textarea className="input" rows={3} value={sisgeo_note} onChange={(e) => setSisgeoNote(e.target.value)} disabled={is_closed} />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn--subtle" type="button" onClick={saveSisgeo} disabled={is_closed}>
                Salvar SisGeo
              </button>
            </div>
          </div>

          <div className="card pad" style={{ display: "grid", gap: 10 }}>
            <h2 className="h2">Cadastro da área (para aprovação)</h2>

            <label>Código da área
              <input className="input" value={area_codigo} onChange={(e) => setAreaCodigo(e.target.value)} disabled={is_closed} />
            </label>
            <label>Nome
              <input className="input" value={area_nome} onChange={(e) => setAreaNome(e.target.value)} disabled={is_closed} />
            </label>
            <label>Tipo
              <input className="input" value={area_tipo} onChange={(e) => setAreaTipo(e.target.value)} disabled={is_closed} />
            </label>
            <label>Bairro
              <input className="input" value={area_bairro} onChange={(e) => setAreaBairro(e.target.value)} disabled={is_closed} />
            </label>
            <label>Logradouro
              <input className="input" value={area_logradouro} onChange={(e) => setAreaLogradouro(e.target.value)} disabled={is_closed} />
            </label>
            <label>Metragem (m²)
              <input className="input" inputMode="decimal" value={String(area_metragem)} onChange={(e) => setAreaMetragem(num(e.target.value))} disabled={is_closed} />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn--subtle" type="button" onClick={saveAreaDraft} disabled={is_closed}>
                Salvar rascunho
              </button>

              <button className="btn btn--primary" type="button" onClick={doApprove} disabled={is_closed}>
                Aprovar (cadastra área + gera proposta)
              </button>

              <button className="btn" type="button" onClick={doReject} disabled={is_closed}>
                Indeferir
              </button>
            </div>
          </div>
        </div>

        <div className="card pad" style={{ marginTop: 12 }}>
          <h2 className="h2">Histórico</h2>
          {r.history?.length ? (
            <ul className="list">
              {r.history.map((e) => (
                <li key={e.id}>
                  <strong>{e.at}</strong> — <strong>{e.actor_role}</strong> — {e.type}
                  {"decision" in e ? ((e as any).decision_note ? ` — ${(e as any).decision_note}` : "") : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">Sem eventos ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}