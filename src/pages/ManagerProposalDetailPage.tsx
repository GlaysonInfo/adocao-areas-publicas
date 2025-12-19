// src/pages/ManagerProposalDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { KanbanColuna } from "../domain/proposal";
import { getProposalById, moveProposal, subscribeProposals } from "../storage/proposals";
import { useAuth } from "../auth/AuthContext";

type Action = { label: string; to: KanbanColuna };

const STATUS_LABEL: Record<KanbanColuna, string> = {
  protocolo: "Protocolo",
  analise_semad: "Análise SEMAD",
  analise_ecos: "Análise ECOS",
  ajustes: "Ajustes",
  decisao: "Decisão",
  termo_assinado: "Termo Assinado",
};

function actionsFor(role: string | null, col: KanbanColuna): Action[] {
  const is_admin = role === "administrador";
  const is_semad = role === "gestor_semad";
  const is_ecos = role === "gestor_ecos";
  const is_gov = role === "gestor_governo";

  if (col === "protocolo" && (is_admin || is_semad)) {
    return [{ label: "Iniciar análise (SEMAD)", to: "analise_semad" }];
  }

  if (col === "analise_semad" && (is_admin || is_semad)) {
    return [
      { label: "Encaminhar p/ ECOS", to: "analise_ecos" },
      { label: "Solicitar ajustes", to: "ajustes" },
    ];
  }

  if (col === "analise_ecos" && (is_admin || is_ecos)) {
    return [
      { label: "Encaminhar p/ decisão", to: "decisao" },
      { label: "Solicitar ajustes", to: "ajustes" },
    ];
  }

  if (col === "ajustes" && (is_admin || is_semad || is_ecos)) {
    return [{ label: "Retomar análise (SEMAD)", to: "analise_semad" }];
  }

  if (col === "decisao" && (is_admin || is_gov)) {
    return [
      { label: "Aprovar (termo assinado)", to: "termo_assinado" },
      { label: "Solicitar ajustes", to: "ajustes" },
    ];
  }

  return [];
}

function canMove(role: string | null, from: KanbanColuna, to: KanbanColuna) {
  if (from === to) return true;
  return actionsFor(role, from).some((a) => a.to === to);
}

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function askAjustesNote(): string | null {
  const txt = window.prompt(
    "Explique detalhadamente o motivo/orientações para ajustes (isso será exibido ao adotante):",
    ""
  );
  if (txt == null) return null;
  const t = txt.trim();
  if (!t) return null;
  return t;
}

export function ManagerProposalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [tick, setTick] = useState(0);

  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const p = useMemo(() => {
    if (!id) return null;
    return getProposalById(id);
  }, [id, tick]);

  const history = (p?.history ?? []) as any[];

  const lastAjustesNote = useMemo(() => {
    if (!p) return undefined;

    // 1) se existir campo direto
    const direct = (p as any).ajustes_note;
    if (direct && String(direct).trim()) return String(direct).trim();

    // 2) senão, pega do histórico (último move para "ajustes" com note)
    for (let i = history.length - 1; i >= 0; i--) {
      const ev = history[i] as any;
      const action = ev.action ?? ev.type; // tolera variações antigas
      const to = ev.to;
      const note = ev.note;
      if ((action === "move" || action === "mover") && to === "ajustes" && note) {
        const t = String(note).trim();
        if (t) return t;
      }
    }
    return undefined;
  }, [p, history.length]);

  if (!p) {
    return (
      <div className="container">
        <div className="card pad">
          <h2 style={{ marginTop: 0 }}>Proposta não encontrada</h2>
          <button type="button" className="btn" onClick={() => navigate("/gestor/kanban")}>
            Voltar ao Kanban
          </button>
        </div>
      </div>
    );
  }

  const col = p.kanban_coluna as KanbanColuna;
  const acts = actionsFor(role, col);

  const doMove = (to: KanbanColuna) => {
    if (!canMove(role, col, to)) {
      alert("Transição não permitida para este perfil/etapa.");
      return;
    }

    let note: string | undefined;

    if (to === "ajustes") {
      const txt = askAjustesNote();
      if (!txt) return; // exige motivo
      note = txt;
    }

    moveProposal(p.id, to, role ?? "gestor", note);
    setTick((t) => t + 1);
  };

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Detalhe da Proposta (Gestor)</h1>
            <p className="page__subtitle">
              Protocolo <strong>{p.codigo_protocolo}</strong> · Etapa:{" "}
              <strong>{STATUS_LABEL[col] ?? col}</strong> · Perfil:{" "}
              <strong>{role ?? "—"}</strong>
            </p>
          </div>

          <div className="page__actions">
            <button type="button" className="btn btn--subtle" onClick={() => setTick((t) => t + 1)}>
              Atualizar
            </button>
            <Link className="btn btn--primary" to="/gestor/kanban">
              Voltar ao Kanban
            </Link>
          </div>
        </header>

        {/* IMPORTANTE: motivo de ajustes visível também para gestor */}
        {lastAjustesNote ? (
          <section className="card pad" style={{ borderLeft: "6px solid rgba(245,158,11,.7)" }}>
            <h3 style={{ marginTop: 0 }}>Motivo / orientações de ajustes</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{lastAjustesNote}</div>
          </section>
        ) : null}

        <section className="card pad" aria-label="Ações">
          <h3 style={{ marginTop: 0 }}>Ações</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {acts.length === 0 ? (
              <span className="muted">Sem ações disponíveis para esta etapa/perfil.</span>
            ) : (
              acts.map((a) => (
                <button key={a.to} type="button" className="btn" onClick={() => doMove(a.to)}>
                  {a.label}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card pad" aria-label="Resumo">
          <div className="grid cols-2">
            <div>
              <div>
                <strong>Área:</strong> {p.area_nome}
              </div>
              <div>
                <strong>Status técnico:</strong> {p.kanban_coluna}
              </div>
            </div>

            <div>
              <div>
                <strong>Criado em:</strong> {fmt(p.created_at)}
              </div>
              <div>
                <strong>Atualizado em:</strong> {fmt(p.updated_at)}
              </div>
            </div>
          </div>
        </section>

        <section className="grid cols-2" aria-label="Conteúdo">
          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Plano</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {p.descricao_plano?.trim() ? p.descricao_plano : "—"}
            </div>
          </div>

          <div className="card pad">
            <h3 style={{ marginTop: 0 }}>Documentos</h3>
            {p.documentos?.length ? (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {p.documentos.map((d: any, i: number) => (
                  <li key={`${d.tipo}-${i}`}>
                    <strong>{d.tipo}:</strong> {d.file_name} ({Math.round((d.file_size ?? 0) / 1024)} KB){" "}
                    <div className="muted">{d.mime_type || "—"}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">Sem documentos cadastrados.</div>
            )}
          </div>
        </section>

        <section className="card pad" aria-label="Histórico">
          <h3 style={{ marginTop: 0 }}>Histórico</h3>
          {history.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {history.map((ev: any, i: number) => (
                <li key={i}>
                  <strong>{fmt(ev.at ?? ev.created_at ?? ev.ts)}</strong> —{" "}
                  <strong>{ev.actor ?? ev.by ?? "—"}</strong> —{" "}
                  {ev.action ?? ev.type ?? "evento"}
                  {ev.from && ev.to ? ` (${ev.from} → ${ev.to})` : ""}
                  {ev.note ? (
                    <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                      <em>{String(ev.note)}</em>
                    </div>
                  ) : null}
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