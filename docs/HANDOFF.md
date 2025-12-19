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
1) Modelo mínimo de Vistoria (MVP) — mensurável e orientado a evidências
1.1 Entidade principal

vistoria (armazenada em localStorage):

id

proposal_id (FK lógica)

fase: "analise" | "vigencia"

analise: antes do termo

vigencia: após termo/adoção vigente

status: "rascunho" | "agendada" | "executada" | "laudo_emitido" | "cancelada" (opcional)

local_texto (obrigatório)

geo?: { lat, lng, accuracy_m?, captured_at } (opcional, capturado via navegador)

agendada_para? (ISO)

executada_em? (ISO)

checklist_json (MVP: objeto livre)

observacoes?

laudo? (pode ser embutido no MVP):

conclusao: "favoravel" | "favoravel_com_ressalvas" | "desfavoravel"

recomendacoes?

emitido_em

created_at, updated_at

history[] (event-log)

1.2 Event-log (fonte de verdade)

Cada evento deve ter (no mínimo):

id, type, at, actor_role

payload específico quando aplicável

Eventos mínimos:

create

schedule (inclui agendada_para)

execute (inclui executada_em e geo?)

issue_laudo (inclui conclusao e recomendacoes?)

Por que assim? Porque permite SLA e produtividade depois sem inferência visual.

2) Regras de transição (testáveis)
2.1 Transições válidas

create → status = rascunho

schedule:

pré-condição: status ∈ {rascunho, agendada}

pós-condição: status = agendada e agendada_para definido

execute:

pré-condição: status ∈ {rascunho, agendada}

pós-condição: status = executada e executada_em definido

issue_laudo:

pré-condição: status = executada

pós-condição: status = laudo_emitido e laudo.emitido_em definido

2.2 Integridade com proposta

Vistoria sempre referencia proposal_id.

Em fase “analise”, vínculo primário é a proposta em analise_semad (ou no mínimo “em andamento”).

Em fase “vigencia”, permitir vistoria mesmo com proposta encerrada (term assinado), mas ainda vinculada ao mesmo proposal_id.

3) Arquivos a criar/alterar (WEB)
3.1 Novos arquivos

Domínio

src/domain/vistoria.ts

Storage (localStorage + subscribe)

src/storage/vistorias.ts

key sugerida: mvp_vistorias_v1

funções mínimas:

listVistoriasByProposal(proposal_id)

getVistoriaById(id)

createVistoria(input, actor_role)

scheduleVistoria(id, agendada_para, actor_role)

executeVistoria(id, {local_texto, geo?, checklist_json?, observacoes?}, actor_role)

issueLaudo(id, {conclusao, recomendacoes?}, actor_role)

subscribeVistorias(cb)

Páginas (Gestor)

src/pages/vistorias/ManagerVistoriasPage.tsx (lista por proposta)

src/pages/vistorias/ManagerVistoriaNewPage.tsx

src/pages/vistorias/ManagerVistoriaDetailPage.tsx

3.2 Alterar páginas existentes

Gestor

src/pages/ManagerProposalDetailPage.tsx

botão/aba: “Vistorias” → abre /gestor/vistorias?proposal_id=...

ou embed simples: lista de vistorias + CTA “Nova vistoria”

Adotante

src/pages/MyProposalDetailPage.tsx

seção “Vistorias” (somente leitura):

status atual (rascunho/agendada/executada/laudo_emitido)

se laudo_emitido, exibir conclusao, emitido_em, recomendacoes

isso é a devolutiva verificável

3.3 Rotas

src/routes/AppRoutes.tsx (dentro de <RequireManager/>)

/gestor/vistorias

/gestor/vistorias/nova

/gestor/vistorias/:id

(Opcional: link no menu para gestor, mas o mais consistente é entrar via detalhe da proposta.)

4) Critérios de aceite (somente por evidência em localStorage)

Criar vistoria:

existe um item em mvp_vistorias_v1 com proposal_id = X

history contém create

Agendar:

status = "agendada" e agendada_para definido

history contém schedule

Executar:

status = "executada" e executada_em definido

history contém execute

Emitir laudo:

status = "laudo_emitido" e laudo.emitido_em definido

history contém issue_laudo com conclusao

Devolutiva (adotante):

em /minhas-propostas/:id, a seção Vistorias reflete exatamente os campos acima (sem cálculo “por tela”).