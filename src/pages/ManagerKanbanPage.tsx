// src/pages/ManagerKanbanPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { KanbanColuna } from "../domain/proposal";
import { getAllowedTransitionsFrom, requiresNoteForProposalTransition } from "../domain/transitions";
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

const TRANSITION_LABELS: Partial<Record<string, string>> = {
  "protocolo->analise_semad": "Iniciar análise (SEMAD)",
  "analise_semad->analise_ecos": "Encaminhar p/ ECOS",
  "analise_semad->ajustes": "Solicitar ajustes",
  "analise_ecos->decisao": "Encaminhar p/ decisão",
  "analise_ecos->ajustes": "Solicitar ajustes",
  "ajustes->analise_semad": "Retomar análise (SEMAD)",
  "decisao->termo_assinado": "Aprovar (termo assinado)",
  "decisao->indeferida": "Indeferir",
  "decisao->ajustes": "Solicitar ajustes",
};

function actionsFor(role: string | null, col: KanbanColuna): Action[] {
  return getAllowedTransitionsFrom(col, role).map((rule) => ({
    to: rule.to,
    label: TRANSITION_LABELS[`${rule.from}->${rule.to}`] ?? `Mover para ${rule.to}`,
  }));
}

function canMove(role: string | null, from: KanbanColuna, to: KanbanColuna) {
  return getAllowedTransitionsFrom(from, role).some((a) => a.to === to);
}

function packDrag(id: string, from: KanbanColuna) {
  return `${id}|${from}`;
}

function unpackDrag(payload: string): { id: string; from: KanbanColuna } | null {
  const [id, from] = payload.split("|");
  if (!id || !from) return null;
  return { id, from: from as KanbanColuna };
}

function askRequiredNote(from: KanbanColuna, to: KanbanColuna): string | null {
  const requires = requiresNoteForProposalTransition(from, to);
  if (!requires) return "";

  const isAjustes = to === "ajustes";
  const isIndeferida = to === "indeferida";

  const message = isAjustes
    ? "Explique detalhadamente o motivo da solicitação de ajustes (esta mensagem será exibida ao adotante):"
    : isIndeferida
      ? "Informe a justificativa do indeferimento:"
      : "Informe a justificativa desta transição:";

  const txt = window.prompt(message, "");
  if (txt == null) return null;
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

    if (requiresNoteForProposalTransition(from, to)) {
      const txt = askRequiredNote(from, to);
      if (txt == null) return;
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
