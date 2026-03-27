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
Próximos passos (priorizados) + DoD — versão “produção” (baseado no estado atual)

Premissas observadas (estado atual):

Frontend (React/Vite) com fluxos completos: Áreas, Propostas/Kanban, Solicitações de área, Vistorias, Relatórios.

Regras e métricas dependem de event-log (history/events) e persistem em localStorage.

Necessário: backend + persistência + deploy + anexos reais + auditoria server-side.

P0 — Bloqueadores de produção (ordem recomendada)
1) Backend API + Contratos + Validação de entrada (Impacto 5 | Risco 5 | Custo 4)

Entregáveis (repo):

apps/api/ (ou /api se não usar monorepo)

OpenAPI (openapi.json) ou rota /docs

Middleware de validação (Zod) + erros padronizados

DoD (mensurável):

GET /health retorna 200

GET /version retorna commit SHA + env

Todos endpoints retornam erro em formato único (ex.: { code, message, traceId })

1 suíte de testes de contrato (smoke) cobrindo rotas principais

2) Persistência com Postgres + Migrações (Impacto 5 | Risco 5 | Custo 3)

Entregáveis (repo):

infra/docker-compose.yml (postgres + adminer/pgadmin opcional)

ORM/migrations: Prisma ou Drizzle (1 escolha)

Schema inicial com tabelas mínimas:

areas

proposals, proposal_events

vistorias, vistoria_events

area_requests, area_request_events

users, sessions (ou refresh tokens)

attachments (metadados)

DoD (mensurável):

db:migrate cria schema do zero (sem intervenção manual)

db:reset recria schema e executa seed mínimo

Índices para período/evento existem (por at, proposal_id, status)

Backup/restore testado em staging (evidência: log + timestamp)

3) Auth real + RBAC server-side (Impacto 5 | Risco 4 | Custo 3)

Entregáveis (repo):

apps/api/src/modules/auth/*

apps/api/src/middlewares/rbac.ts

Modelo users com role (adotante_pf/pj, gestor_*, admin)

DoD (mensurável):

Login gera sessão/token; role vem do backend

Rotas protegidas por role (API e UI)

Eventos gravam actor_id + actor_role server-side (não confiando no cliente)

Testes: 1 caso por role negado/permitido em endpoint crítico

4) Event-log canônico no backend (append-only) (Impacto 5 | Risco 4 | Custo 3)

Entregáveis (repo):

Escrita de eventos em tabelas *_events (append-only)

Regras de negócio no backend (fonte de verdade)

DoD (mensurável):

Toda transição relevante gera evento (create/move/decision/override_no_vistoria/etc.)

Relatórios por período rodam apenas por replay do event-log

Idempotência: replay do mesmo conjunto de eventos ⇒ mesmas contagens (teste automatizado)

P1 — Funcionalidades para uso real
5) Anexos reais (S3/R2/Storage gerenciado) (Impacto 4 | Risco 3 | Custo 4)

Entregáveis (repo):

apps/api/src/modules/attachments/*

Provider S3 compatível (AWS S3 / Cloudflare R2 / Supabase Storage)

DoD (mensurável):

Upload multipart funciona + grava metadados no DB

Download via URL assinada (expiração) ou proxy autenticado

Validações de tipo e tamanho (bloqueio)

Evidência: anexos persistem entre dispositivos/sessões

6) Relatórios/CSV server-side (Impacto 4 | Risco 3 | Custo 3)

Entregáveis (repo):

apps/api/src/modules/reports/*

Endpoints para consolidado + listas + CSV

DoD (mensurável):

/reports?from&to reproduz as mesmas métricas que hoje (por evento)

CSV exporta rastreabilidade (protocolo, timestamps, ator, motivo quando aplicável)

Teste: janela de tempo fixa ⇒ saída determinística

7) Migração localStorage → DB (import controlado) (Impacto 4 | Risco 4 | Custo 3)

Entregáveis (repo):

Script CLI: apps/api/scripts/import_localstorage_dump.ts

Endpoint interno (admin) opcional: POST /admin/import

DoD (mensurável):

Import valida schema + invariantes (1 proposta aberta por área, etc.)

Import é idempotente (rodar 2x não duplica)

Relatório de migração (contagens antes/depois + erros)

P2 — Operação, qualidade e governança
8) CI/CD + ambientes (staging/prod) (Impacto 4 | Risco 2 | Custo 2)

Entregáveis (repo):

GitHub Actions: lint/test/build/migrate(dry-run)

Deploy staging automático; prod com aprovação

DoD (mensurável):

PR bloqueia merge se falhar: lint + test + build

Staging atualiza a cada merge na main

Prod com tag/versionamento (release)

9) Observabilidade (logs, erros, métricas) (Impacto 4 | Risco 2 | Custo 2)

Entregáveis (repo):

Logs estruturados (JSON) com traceId

Sentry (erros) + métricas básicas

DoD (mensurável):

Toda request tem traceId

Erro crítico gera evento observável (Sentry) com rota + usuário/role

Dashboard mínimo: taxa de erro + p95 latência

10) Segurança mínima (Impacto 5 | Risco 3 | Custo 2)

Entregáveis (repo):

Rate limit, CORS, headers, CSRF (se cookie), sanitização

Policy de permissões por recurso (RBAC + ownership)

DoD (mensurável):

Tentativa de acesso cruzado (adotante A lendo dados do adotante B) falha

Upload bloqueia tipos proibidos e tamanhos acima do limite

Auditoria server-side cobre ações críticas (quem/quando/o quê)

Estrutura recomendada no repositório (para “fechar” o projeto)
Opção A (recomendada): monorepo

apps/web/ (atual)

apps/api/ (novo)

packages/shared/ (schemas Zod + tipos compartilhados)

infra/ (compose, scripts)

docs/ (as-built + roadmap)

DoD (mensurável): build e deploy independentes de web e api.

Decisão de banco (médio porte em 2025) — regra objetiva

Escolher PostgreSQL se ≥ 3 condições verdadeiras:

integridade relacional e constraints importam

relatórios por período e consultas analíticas são core

event-log auditável é core

anexos + metadados + busca por filtros/joins é core

evolução do schema precisa ser controlada por migrações

Resultado por aderência ao problema atual: PostgreSQL = escolha padrão.

Hospedagem (alvo mínimo) + evidências exigidas

Frontend: Vercel/Netlify/Cloudflare Pages
Backend: Render/Fly/Cloud Run/Railway (qualquer com logs e healthcheck)
DB: Postgres gerenciado (Supabase/Neon/RDS/Cloud SQL/Render)
Storage: S3/R2 (para anexos)
CDN: implícita no provider do frontend

DoD (mensurável):

https://app.dominio (prod) + https://staging.app.dominio

https://api.dominio/health (prod) + staging

Backup automático do DB + restore testado

Logs acessíveis e erro rastreável por traceId

Domínio (registro + DNS + SSL) — evidência final

Registro: Registro.br (se .br) ou provedor padrão (Cloudflare Registrar etc.)
DNS: app, api, staging-app, staging-api
SSL: automático via provedor (TLS gerenciado)

DoD (mensurável):

URL pública com HTTPS em produção e staging

Cert válido + redirecionamento HTTP→HTTPS

Ambiente staging isolado (DB e buckets separados)

Próxima ação concreta (sequência mínima para iniciar P0)

Criar apps/api/ com Node+TS (Fastify ou NestJS)

Adicionar infra/docker-compose.yml (Postgres)

Implementar schema + migrations (Prisma/Drizzle)

Implementar Auth + RBAC + GET /health

Portar regras críticas do storage/* para backend (event-log)

Se for escolhido monorepo, o próximo commit pode ser:

chore(repo): add apps/api + infra postgres + shared schemas (P0 scaffold)
