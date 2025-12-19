// src/pages/ManagerKanbanPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { KanbanColuna } from "../domain/proposal";
import { listProposals, moveProposal } from "../storage/proposals";
import { useAuth } from "../auth/AuthContext";

type Action = { label: string; to: KanbanColuna };

const columns: { key: KanbanColuna; label: string }[] = [
  { key: "protocolo", label: "Protocolo" },
  { key: "analise_semad", label: "Análise SEMAD" },
  { key: "analise_ecos", label: "Análise ECOS" },
  { key: "ajustes", label: "Ajustes" },
  { key: "decisao", label: "Decisão" },
  { key: "termo_assinado", label: "Termo Assinado" },
];

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

function packDrag(id: string, from: KanbanColuna) {
  return `${id}|${from}`;
}

function unpackDrag(payload: string): { id: string; from: KanbanColuna } | null {
  const [id, from] = payload.split("|");
  if (!id || !from) return null;
  return { id, from: from as KanbanColuna };
}

function askAjustesNote(): string | null {
  const txt = window.prompt(
    "Explique detalhadamente o motivo da solicitação de ajustes (esta mensagem será exibida ao adotante):",
    ""
  );
  if (txt == null) return null; // cancelou
  const t = txt.trim();
  if (!t) return null;
  return t;
}

export function ManagerKanbanPage() {
  const { role } = useAuth();
  const [tick, setTick] = useState(0);
  const [dragOverCol, setDragOverCol] = useState<KanbanColuna | null>(null);

  const items = useMemo(() => listProposals(), [tick]);

  const grouped = useMemo(() => {
    const map = new Map<KanbanColuna, typeof items>();
    for (const c of columns) map.set(c.key, []);
    for (const p of items) {
      const key = p.kanban_coluna as KanbanColuna;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [items]);

  const doMove = (id: string, from: KanbanColuna, to: KanbanColuna) => {
    if (!canMove(role, from, to)) {
      alert("Transição não permitida para este perfil/etapa.");
      return;
    }

    let note: string | undefined;

    if (to === "ajustes") {
      const txt = askAjustesNote();
      if (!txt) return; // exige motivo
      note = txt;
    }

    try {
      moveProposal(id, to, role ?? "gestor", note);
      setTick((x) => x + 1);
    } catch (e: any) {
      alert(e?.message ?? "Erro ao mover proposta.");
    }
  };

  return (
    <div className="container container--wide">
      <h2 style={{ marginBottom: 6 }}>Kanban do Gestor</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Perfil atual: <strong>{role ?? "—"}</strong>
      </p>

      <div className="card kanbanShell">
        <div className="kanbanBoardWrap" aria-label="Quadro Kanban">
          <div className="kanbanBoard">
            {columns.map((col) => {
              const colItems = grouped.get(col.key) ?? [];

              return (
                <section
                  key={col.key}
                  className={`kanbanCol ${dragOverCol === col.key ? "is-dragover" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCol(col.key);
                  }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);

                    const payload = e.dataTransfer.getData("text/plain");
                    const data = unpackDrag(payload);
                    if (!data) return;

                    doMove(data.id, data.from, col.key);
                  }}
                  aria-label={`Coluna ${col.label}`}
                >
                  <div className="kanbanColHeader">
                    <div className="kanbanColTitle">{col.label}</div>
                    <div className="kanbanColCount">{colItems.length}</div>
                  </div>

                  <div className="kanbanColBody">
                    {colItems.length === 0 ? (
                      <div className="kanbanEmpty">Sem itens</div>
                    ) : (
                      colItems.map((p) => {
                        const fromCol = p.kanban_coluna as KanbanColuna;
                        const acts = actionsFor(role, fromCol);

                        return (
                          <article key={p.id} className="kanbanCard">
                            <div
                              className="kanbanCardHandle"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", packDrag(p.id, fromCol));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              title="Arraste para mover entre colunas"
                            >
                              {p.codigo_protocolo}
                            </div>

                            <div className="kanbanCardMeta">{p.area_nome}</div>

                            <div className="kanbanCardActions">
                              <Link to={`/gestor/propostas/${encodeURIComponent(p.id)}`}>Abrir</Link>

                              {acts.map((a) => (
                                <button
                                  key={`${p.id}_${fromCol}_${a.to}`}
                                  type="button"
                                  className="btn btn--sm"
                                  onClick={() => doMove(p.id, fromCol, a.to)}
                                >
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}