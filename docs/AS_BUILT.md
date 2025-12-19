# AS-BUILT (estado atual do sistema)

> **Gerado em:** 2025-12-19T04:50:01.249Z

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
- `/login` → **LoginPage**
- `/minhas-propostas` → **MyProposalsPage**
- `/minhas-propostas/:id` → **MyProposalDetailPage**
- `/minhas-propostas/:id/editar` → **MyProposalEditPage**
- `/propostas/nova` → **ProposalNewPage**
- `/relatorios` → **ReportsPage**

## Inventário de telas (src/pages/**/*.tsx)
- `src/pages/admin/AdminAreasImportPage.tsx` (**AdminAreasImportPage**)
- `src/pages/admin/AdminAreasPage.tsx` (**AdminAreasPage**)
- `src/pages/AreasPage.tsx` (**AreasPage**)
- `src/pages/LoginPage.tsx` (**LoginPage**)
- `src/pages/ManagerKanbanPage.tsx` (**ManagerKanbanPage**)
- `src/pages/ManagerProposalDetailPage.tsx` (**ManagerProposalDetailPage**)
- `src/pages/MyProposalDetailPage.tsx` (**MyProposalDetailPage**)
- `src/pages/MyProposalsPage.tsx` (**MyProposalsPage**)
- `src/pages/ProposalNewPage.tsx` (**ProposalNewPage**)
- `src/pages/proposals/MyProposalEditPage.tsx` (**MyProposalEditPage**)
- `src/pages/PublicProgramPage.tsx` (**PublicProgramPage**)
- `src/pages/reports/ReportsPage.tsx` (**ReportsPage**)

## Fluxo por perfil (resumo)
- **Público (sem login):** Início, Áreas, Login
- **Adotante (PF/PJ):** Nova Proposta, Minhas Propostas, Detalhe, Atender Ajustes (quando em AJUSTES)
- **Gestores:** Kanban, Detalhe da Proposta (gestor), movimentações por órgão
- **Admin:** CRUD Áreas, Importação CSV, (Relatórios se habilitado)
- **Relatórios:** visível para **gestor_semad** e **administrador**

## Regras de negócio implementadas (pontos críticos)
- **Protocolo único:** `codigo_protocolo` é gerado na criação e **não muda** em reenvios.
- **Ajustes com motivo obrigatório:** qualquer órgão ao mover para AJUSTES exige `note`.
- **Reenvio após ajustes:** adotante pode editar plano/anexos e reenviar; o fluxo volta para análise conforme regra do storage.
- **Concorrência por área:** **1 proposta aberta por área** (bloqueia concorrentes).
- **Status da área (automático):**
  - Proposta criada (Protocolo) → área **em_adocao**
  - Termo assinado → área **adotada**
  - Indeferida → área **disponivel**

## Evidências (colar aqui)
### Snapshot sanitizado do localStorage
> Cole aqui o snapshot gerado pelo script do browser (ver seção “Snapshot sanitizado” em ARCHITECTURE.md).

### Checklist de reprodução mínima
1) Admin: importar áreas via CSV (ou “zerar áreas (teste CSV)” e importar)
2) Adotante: criar proposta para uma área **disponível**
3) Gestor SEMAD: mover Protocolo → Análise SEMAD
4) Gestor: solicitar AJUSTES **com motivo**
5) Adotante: abrir detalhe → “Atender ajustes” → substituir anexos/editar plano → reenviar
6) Gestor: avançar no Kanban até Termo assinado ou Indeferida
7) Relatórios: validar período e produtividade (SEMAD) com base em eventos

### Checklist de validação (por tela)
- Áreas: exibe áreas ativas; não permite iniciar proposta quando área não está disponível
- Nova Proposta: lista todas as áreas **disponíveis** e ativas
- Minhas Propostas: aparece imediatamente após criar (via subscribe)
- Detalhe do Adotante: mostra motivo de AJUSTES no topo; botão “Atender ajustes” só quando aplicável e dono
- Kanban: movimentações registram eventos; AJUSTES exige motivo
- Relatórios: contagens por período devem bater com eventos (create/move/request_adjustments/decision)

## Versão (git)
- **Branch:** main
- **Commit:** ab50c2a2719d85307fdeae997c1f296e1ea33f6f

### git status (porcelain)
```
?? "O que levar para o novo chat.txt"
```

### git diff --stat
```

```

### git log -n 20 --oneline
```
ab50c2a docs: as-built snapshot
```
