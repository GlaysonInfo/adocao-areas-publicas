// src/domain/kanban.ts
export type KanbanColuna =
  | "protocolo"
  | "analise_semad"
  | "analise_ecos"
  | "ajustes"
  | "decisao"
  | "termo_assinado"
  | "indeferida";

export const KANBAN_COLUMNS: KanbanColuna[] = [
  "protocolo",
  "analise_semad",
  "analise_ecos",
  "ajustes",
  "decisao",
  "termo_assinado",
  "indeferida",
];

export const KANBAN_LABEL: Record<KanbanColuna, string> = {
  protocolo: "Protocolo",
  analise_semad: "Análise SEMAD",
  analise_ecos: "Análise ECOS",
  ajustes: "Ajustes",
  decisao: "Decisão",
  termo_assinado: "Termo Assinado",
  indeferida: "Indeferida",
};

export function isFinalColuna(col: KanbanColuna): boolean {
  return col === "termo_assinado" || col === "indeferida";
}