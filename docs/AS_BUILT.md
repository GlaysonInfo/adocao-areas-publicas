# AS-BUILT (estado atual do sistema)

> **Gerado em:** 2026-03-21T10:46:00.493Z

## Objetivo
Este documento registra o estado atual implementado do sistema, com foco em escopo funcional, rotas, telas, regras de negócio e evidências mínimas de validação.

## Como rodar
```bash
npm install
npm run dev
```

## Mapa de rotas (extraído de src/routes/AppRoutes.tsx)
- `*` → **div**
- `/` → **PublicProgramPage**
- `/admin/areas` → **AdminAreasPage**
- `/admin/areas/importar` → **AdminAreasImportPage**
- `/areas` → **AreasPage**
- `/gestor/kanban` → **ManagerKanbanPage**
- `/gestor/propostas/:id` → **ManagerProposalDetailPage**
- `/gestor/solicitacoes-area` → **ManagerAreaRequestsPage**
- `/gestor/solicitacoes-area/:id` → **ManagerAreaRequestDetailPage**
- `/gestor/vistorias` → **ManagerVistoriasPage**
- `/gestor/vistorias/:id` → **ManagerVistoriaDetailPage**
- `/gestor/vistorias/nova` → **ManagerVistoriaNewPage**
- `/login` → **LoginPage**
- `/minhas-propostas` → **MyProposalsPage**
- `/minhas-propostas/:id` → **MyProposalDetailPage**
- `/minhas-propostas/:id/editar` → **MyProposalEditPage**
- `/minhas-solicitacoes-area` → **MyAreaRequestsPage**
- `/propostas/nova` → **ProposalNewPage**
- `/relatorios` → **ReportsPage**
- `/solicitacoes-area/nova` → **AreaRequestNewPage**

## Inventário de telas (src/pages/**/*.tsx)
- `src/pages/admin/AdminAreasImportPage.tsx` (**AdminAreasImportPage**)
- `src/pages/admin/AdminAreasPage.tsx` (**AdminAreasPage**)
- `src/pages/AreaRequestNewPage.tsx` (**AreaRequestNewPage**)
- `src/pages/AreasPage.tsx` (**AreasPage**)
- `src/pages/LoginPage.tsx` (**LoginPage**)
- `src/pages/ManagerAreaRequestDetailPage.tsx` (**ManagerAreaRequestDetailPage**)
- `src/pages/ManagerAreaRequestsPage.tsx` (**ManagerAreaRequestsPage**)
- `src/pages/ManagerKanbanPage.tsx` (**ManagerKanbanPage**)
- `src/pages/ManagerProposalDetailPage.tsx` (**ManagerProposalDetailPage**)
- `src/pages/ManagerVistoriaDetailPage.tsx` (**ManagerVistoriaDetailPage**)
- `src/pages/ManagerVistoriaNewPage.tsx` (**ManagerVistoriaNewPage**)
- `src/pages/ManagerVistoriasPage.tsx` (**ManagerVistoriasPage**)
- `src/pages/MyAreaRequestsPage.tsx` (**MyAreaRequestsPage**)
- `src/pages/MyProposalDetailPage.tsx` (**MyProposalDetailPage**)
- `src/pages/MyProposalsPage.tsx` (**MyProposalsPage**)
- `src/pages/ProposalNewPage.tsx` (**ProposalNewPage**)
- `src/pages/proposals/MyProposalEditPage.tsx` (**MyProposalEditPage**)
- `src/pages/PublicProgramPage.tsx` (**PublicProgramPage**)
- `src/pages/reports/ReportsPage.tsx` (**ReportsPage**)

## Fluxo por perfil
- **Público (sem login):** Início, Áreas, Login
- **Adotante (PF/PJ):** Nova Proposta, Minhas Propostas, Detalhe, Atender Ajustes
- **Gestores:** Kanban, Detalhe da Proposta, movimentações por órgão
- **Admin:** CRUD de Áreas, Importação CSV
- **Relatórios:** visível para **gestor_semad** e **administrador**

## Regras de negócio confirmadas
- **Protocolo único:** `codigo_protocolo` é gerado na criação e não muda em reenvios.
- **Ajustes com motivo obrigatório:** mover para AJUSTES exige `note`.
- **Reenvio após ajustes:** o adotante pode editar e reenviar conforme a regra do storage.
- **Concorrência por área:** apenas **1 proposta aberta por área**.
- **Status da área:**
  - Proposta criada → **em_adocao**
  - Termo assinado → **adotada**
  - Indeferida → **disponivel**

## Evidências de validação
### Snapshot sanitizado do localStorage
> Cole aqui o snapshot gerado pelo snippet indicado em `ARCHITECTURE.md`.

### Checklist de reprodução mínima
1. Admin importa áreas por CSV.
2. Adotante cria proposta para uma área disponível.
3. Gestor SEMAD move Protocolo → Análise SEMAD.
4. Gestor solicita AJUSTES com motivo.
5. Adotante atende ajustes e reenvia.
6. Gestor avança até Termo assinado ou Indeferida.
7. Relatórios são validados com base em eventos.

### Checklist de validação por tela
- Áreas: exibe áreas ativas e bloqueia proposta para área indisponível.
- Nova Proposta: lista áreas disponíveis e ativas.
- Minhas Propostas: exibe item recém-criado.
- Detalhe do Adotante: mostra motivo de ajustes e botão de ação apenas quando aplicável.
- Kanban: registra movimentações e exige motivo em AJUSTES.
- Relatórios: contagens por período batem com eventos.

## Versão do código
- **Branch:** main
- **Commit:** f0d852b5a6c701a5a842985acaa01d8e4b98c50b

### git status (porcelain)
```
M docs/ARCHITECTURE.md
 M docs/AS_BUILT.md
 M docs/HANDOFF.md
 M docs/VALIDATION.md
 M package-lock.json
 M package.json
 M scripts/as-built/generate_as_built.mjs
 M src/pages/ManagerKanbanPage.tsx
 M src/storage/areas.ts
 M src/storage/proposals.ts
?? "O que levar para o novo chat em 28122025.txt"
?? apps/
?? apps_api_fastify_scaffold.zip
?? docker-compose.yml
?? docs/ROADMAP.md
?? scripts/as-built/lib/
?? scripts/as-built/templates/
?? scripts/validate_vistorias.ps1
```

### git diff --stat
```
docs/ARCHITECTURE.md                   |  81 ++--
 docs/AS_BUILT.md                       | 144 ++++++-
 docs/HANDOFF.md                        | 282 ++++++++-----
 docs/VALIDATION.md                     | 732 ++++++++++++++++++++++++++++++++-
 package-lock.json                      | 711 +++++++++++++++++++++++++++++++-
 package.json                           |   3 +-
 scripts/as-built/generate_as_built.mjs | 408 +-----------------
 src/pages/ManagerKanbanPage.tsx        |  86 ++--
 src/storage/areas.ts                   |  30 +-
 src/storage/proposals.ts               | 123 ++----
 10 files changed, 1899 insertions(+), 701 deletions(-)
```

### git log -n 20 --oneline
```
f0d852b docs: session handoff 2025-12-29
bd09b7f chore(docs): add docs:gen script
ee80e6c docs: atualiza arquitetura/handoff/validation (auto)
5519d75 docs: atualiza changelog e as-built
ff1ba42 chore(data): move csv de import para data/import
aa55900 feat(vistoria): laudo estruturado + fluxo e dados de áreas para import
2657a6c feat(reports): gate override_no_vistoria na transição SEMAD->ECOS + contagem no relatório
350ddb2 feat: páginas e storage de solicitações de área
f17af42 docs: refresh as-built
ab50c2a docs: as-built snapshot
```
