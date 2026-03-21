import { mdCodeBlock } from "../lib/markdown-utils.mjs";

export function renderAsBuilt(ctx) {
  return `# AS-BUILT (estado atual do sistema)

> **Gerado em:** ${ctx.now}

## Objetivo
Este documento registra o estado atual implementado do sistema, com foco em escopo funcional, rotas, telas, regras de negócio e evidências mínimas de validação.

## Como rodar
${mdCodeBlock(`npm install\nnpm run dev`, "bash")}

## Mapa de rotas (extraído de src/routes/AppRoutes.tsx)
${ctx.routesList}

## Inventário de telas (src/pages/**/*.tsx)
${ctx.pagesList}

## Fluxo por perfil
- **Público (sem login):** Início, Áreas, Login
- **Adotante (PF/PJ):** Nova Proposta, Minhas Propostas, Detalhe, Atender Ajustes
- **Gestores:** Kanban, Detalhe da Proposta, movimentações por órgão
- **Admin:** CRUD de Áreas, Importação CSV
- **Relatórios:** visível para **gestor_semad** e **administrador**

## Regras de negócio confirmadas
- **Protocolo único:** \`codigo_protocolo\` é gerado na criação e não muda em reenvios.
- **Ajustes com motivo obrigatório:** mover para AJUSTES exige \`note\`.
- **Reenvio após ajustes:** o adotante pode editar e reenviar conforme a regra do storage.
- **Concorrência por área:** apenas **1 proposta aberta por área**.
- **Status da área:**
  - Proposta criada → **em_adocao**
  - Termo assinado → **adotada**
  - Indeferida → **disponivel**

## Evidências de validação
### Snapshot sanitizado do localStorage
> Cole aqui o snapshot gerado pelo snippet indicado em \`ARCHITECTURE.md\`.

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
- **Branch:** ${ctx.git.branch}
- **Commit:** ${ctx.git.head}

### git status (porcelain)
${mdCodeBlock(ctx.git.status || "(limpo)")}

### git diff --stat
${mdCodeBlock(ctx.git.diffStat || "—")}

### git log -n 20 --oneline
${mdCodeBlock(ctx.git.log || "—")}
`;
}
