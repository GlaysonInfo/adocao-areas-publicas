# HANDOFF (contexto mínimo para novo chat)

## Objetivo
Portal de adoção de áreas (adotante / gestores / admin), com Kanban + relatórios + fluxo de ajustes.

## Perfis
- adotante_pf, adotante_pj
- gestor_semad, gestor_ecos, gestor_governo
- administrador

## Regras críticas (validar no storage)
- Bloqueio: 1 proposta aberta por área (sem concorrência)
- Status da área:
  - Protocolo/criação => em_adoção
  - Termo assinado => adotada
  - Indeferida => disponível
- Ajustes: órgão solicita com motivo obrigatório; adotante atende e reenvia; protocolo permanece o mesmo.

## Onde olhar
- Rotas: src/routes/AppRoutes.tsx
- Kanban: src/pages/ManagerKanbanPage.tsx + storage/proposals.ts
- Ajustes: MyProposalDetailPage + MyProposalEditPage + storage/proposals.ts
- Relatórios: src/pages/reports/ReportsPage.tsx

## Próximos passos (placeholder)
- Relatórios por período baseados em eventos + SLA por coluna (P50/P80/P95 + violações).
