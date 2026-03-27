# AS-BUILT (estado atual do sistema)

> **Gerado em:** 2026-03-21T12:57:37.169Z

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
- **Commit:** a23a950ecef87a0294025c3fc6828b00a5c48443

### git status (porcelain)
```
M docs/ARCHITECTURE.md
 M docs/AS_BUILT.md
 M docs/ROADMAP.md
 M src/pages/AreaRequestNewPage.tsx
 M src/pages/AreasPage.tsx
 M src/pages/ManagerAreaRequestDetailPage.tsx
 M src/pages/ManagerAreaRequestsPage.tsx
 M src/pages/ManagerKanbanPage.tsx
 M src/pages/ManagerProposalDetailPage.tsx
 M src/pages/ManagerVistoriaDetailPage.tsx
 M src/pages/ManagerVistoriaNewPage.tsx
 M src/pages/ManagerVistoriasPage.tsx
 M src/pages/MyAreaRequestsPage.tsx
 M src/pages/MyProposalDetailPage.tsx
 M src/pages/MyProposalsPage.tsx
 M src/pages/ProposalNewPage.tsx
 M src/pages/admin/AdminAreasImportPage.tsx
 M src/pages/admin/AdminAreasPage.tsx
 M src/pages/reports/ReportsPage.tsx
?? src/services/
```

### git diff --stat
```
docs/ARCHITECTURE.md                       |   2 +-
 docs/AS_BUILT.md                           |  68 +++++++-----
 docs/ROADMAP.md                            |   2 +-
 src/pages/AreaRequestNewPage.tsx           |  37 +++----
 src/pages/AreasPage.tsx                    |  69 ++++++------
 src/pages/ManagerAreaRequestDetailPage.tsx |  87 +++++++--------
 src/pages/ManagerAreaRequestsPage.tsx      |  19 ++--
 src/pages/ManagerKanbanPage.tsx            |  94 +++++++++-------
 src/pages/ManagerProposalDetailPage.tsx    | 109 ++++++++++---------
 src/pages/ManagerVistoriaDetailPage.tsx    | 167 ++++++++++++++---------------
 src/pages/ManagerVistoriaNewPage.tsx       |  57 +++++-----
 src/pages/ManagerVistoriasPage.tsx         |  25 ++---
 src/pages/MyAreaRequestsPage.tsx           |  25 ++---
 src/pages/MyProposalDetailPage.tsx         |  23 ++--
 src/pages/MyProposalsPage.tsx              |  13 +--
 src/pages/ProposalNewPage.tsx              |  16 +--
 src/pages/admin/AdminAreasImportPage.tsx   |  12 ++-
 src/pages/admin/AdminAreasPage.tsx         |  88 +++++++--------
 src/pages/reports/ReportsPage.tsx          |  59 +++++-----
 19 files changed, 503 insertions(+), 469 deletions(-)
```

### git log -n 20 --oneline
```
a23a950 refactor(domain): centraliza status, transitions e invariants
f0d852b docs: session handoff 2025-12-29
bd09b7f chore(docs): add docs:gen script
ee80e6c docs: atualiza arquitetura/handoff/validation (auto)
5519d75 docs: atualiza changelog e as-built
ff1ba42 chore(data): move csv de import para data/import
aa55900 feat(vistoria): laudo estruturado + fluxo e dados de áreas para import
2657a6c feat(reports): gate override_no_vistoria na transição SEMADECOS + contagem no relatório
350ddb2 feat: páginas e storage de solicitações de área
f17af42 docs: refresh as-built
ab50c2a docs: as-built snapshot
```
