export function renderRoadmap(ctx) {
  return `# ROADMAP (as-built)

> **Gerado em:** ${ctx.now}

## Estado atual
- Portal com perfis: público, adotante, gestores e administrador.
- Áreas com CRUD admin, importação CSV e listagem pública.
- Propostas com protocolo, bloqueio por área, fluxo de ajustes e Kanban.
- Event-log em \`history\` para relatórios por período e produtividade.
- Relatórios preparados para consolidado e SLA por permanência em coluna.

## Lacunas e riscos conhecidos
- Persistência em \`localStorage\` ainda caracteriza o sistema como MVP.
- Não há autenticação real de backend.
- Evidências devem ser sempre sanitizadas.
- SLA depende de critérios estatísticos e recortes temporais bem definidos.

## Prioridades altas
1. **Backend com banco relacional**
   - DoD: API funcional com persistência real e migrações versionadas.
2. **Autenticação e autorização no servidor**
   - DoD: roles validadas no backend e logs de ator por evento.
3. **Substituição de \`src/storage/*\` por camada de API**
   - DoD: front-end consome endpoints reais.
4. **Event-log persistente server-side**
   - DoD: toda mudança de estado gera evento auditável.
5. **Upload real de documentos**
   - DoD: anexos armazenados fora do navegador, com metadados persistidos.

## Prioridades médias
1. Substituir o README padrão por documentação do produto.
2. Formalizar o modelo de dados das entidades.
3. Padronizar nomenclatura de eventos e transições.
4. Criar testes para Kanban, relatórios e importação CSV.

## Prioridades estratégicas
1. Integrar georreferenciamento e mapa.
2. Integrar notificações por e-mail.
3. Preparar exportações institucionais e relatórios gerenciais.
4. Separar melhor regras de negócio da interface.

## Estado-alvo de produção
- Front-end React/Vite consumindo API.
- Event-log server-side como fonte de verdade.
- Banco relacional persistindo entidades e eventos.
- Anexos em object storage.
- Ambientes dev, stage e prod com CI/CD.

## Critérios de sucesso
- Persistência cross-device comprovada.
- Relatórios e SLA reproduzíveis por replay de eventos.
- Auditoria server-side com ator, timestamp e tipo de evento.
- Upload real de anexos.
- Deploy reproduzível com testes e migrações.
`;
}
