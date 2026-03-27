# Handoff — Sessão 2025-12-29 (Backend/API + PostgreSQL + Prisma)

## Estado atual (evidência)
- Repositório: `adocao-areas-web` (monorepo com frontend + backend).
- Backend: `apps/api` (Fastify v4 + TypeScript + Swagger + Prisma).
- Banco: PostgreSQL 18 (Windows service), porta 5432.
- DB usada: `adocao_areas` (schema `public`).
- Seed executado com sucesso:
  - CSV: `data/import/areas_betim_20_simuladas.csv`
  - Resultado: 20 áreas inseridas/upsert.
  - Evidência: saída do seed retornou `rows_read=20`, `upserted=20`, `total_in_db=20`.

## Decisões técnicas já consolidadas
- Fastify **v4** (manter compatibilidade de plugins).
- Swagger compatível com Fastify v4:
  - `@fastify/swagger` em versão compatível com v4 (ex.: 8.x)
  - `@fastify/swagger-ui` em versão compatível com v4 (ex.: 2.x)
- Prisma fixado em **v6.19.1** (evitar quebra da Prisma 7 / datasource.url).
- Postgres local via serviço Windows (Docker não instalado no ambiente).

## Variáveis de ambiente (apps/api/.env)
- `HOST=0.0.0.0`
- `PORT=3001`
- `CORS_ORIGINS=http://localhost:5173`
- `DATABASE_URL=postgresql://<user>:<pass>@127.0.0.1:5432/adocao_areas?schema=public`

## Como subir o backend (dev)
No diretório `apps/api`:
```bash
npm i
npx prisma generate
npm run dev