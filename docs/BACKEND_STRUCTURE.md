# Backend Structure

## Objetivo
Consolidar o backend em `apps/api` sem quebrar o frontend atual, separando claramente:

- rotas legadas compatíveis com o frontend atual;
- rotas `v1` para a API modular com Prisma;
- módulos por domínio para evoluir regras de negócio e autenticação.

## Estrutura recomendada

```text
apps/api/
  prisma/
    schema.prisma
    migrations/
  src/
    db/
      prisma.ts
    middlewares/
      authenticate.ts
      rbac.ts
    modules/
      auth/
      areas/
      proposals/
      vistorias/
    plugins/
      env.ts
      error-handler.ts
    routes/
      health.ts
      version.ts
      areas.ts
      proposals.ts
      area-requests.ts
      vistorias.ts
    index.ts
    server.ts
```

## Regra de convivência

- `/areas`, `/proposals`, `/area-requests`, `/vistorias`: camada legada para compatibilidade com o frontend atual.
- `/v1/auth`, `/v1/areas`, `/v1/proposals`, `/v1/vistorias`: camada modular para o backend real.
- `area-requests` ainda está em estágio legado/mock e deve ser o próximo módulo a migrar para `src/modules/area-requests/`.

## Ordem de evolução

1. Migrar `area-requests` para módulo Prisma.
2. Adaptar o frontend para consumir `/v1`.
3. Centralizar DTOs e contratos HTTP por recurso.
4. Adicionar testes de integração por módulo.
5. Remover gradualmente as rotas legadas após a migração do frontend.

## Convenções

- `routes/`: compatibilidade ou endpoints transversais simples.
- `modules/<dominio>/`: rotas, schemas, regras e acesso a dados do domínio.
- `middlewares/`: autenticação e autorização reaproveitáveis.
- `plugins/`: configuração, observabilidade e tratamento global.
- `db/`: acesso compartilhado ao Prisma.
