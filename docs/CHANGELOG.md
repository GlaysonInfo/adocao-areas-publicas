# Changelog (as-built)

> **Gerado em:** 2025-12-19T04:07:59.921Z

## Estado atual (o que funciona)
- Portal com perfis: público, adotante (PF/PJ), gestores (SEMAD/ECOS/Governo), administrador.
- Áreas:
  - CRUD admin + importação CSV + modo de teste (“zerar áreas”).
  - Listagem pública filtrando ativas e disponíveis.
- Propostas:
  - Criação via wizard com protocolo.
  - Bloqueio de proposta concorrente por área.
  - Kanban com transições por perfil e exigência de motivo em AJUSTES.
  - Tela do adotante mostra motivo/orientações no topo e permite atender ajustes.
- Eventos:
  - `history` com eventos para relatórios por período e produtividade.
- Relatórios:
  - Base preparada para cálculo por período (eventos) e SLA (permanência por coluna).

## Lacunas / riscos conhecidos
- Persistência é localStorage (MVP): sem backend, sem autenticação real.
- Sanitização de dados para evidências deve ser sempre aplicada ao exportar snapshots.
- SLA: requer validação estatística e critérios de censura por período bem definidos em UI (metas por coluna).

## Próximos passos (priorizados) + DoD
1) **Relatórios por período 100% por eventos (não estado)**  
   - DoD: selecionar período e obter contagens idempotentes via `history`; testes com replay.
2) **SLA por coluna com metas configuráveis**  
   - DoD: P50/P80/P95 por coluna, violações por meta, itens abertos censurados no fim do período.
3) **Cadastro mínimo real de adotante PF/PJ**  
   - DoD: nome/email/celular/whatsapp persistidos e exibidos em relatórios e detalhes, com sanitização.
4) **Exportações (CSV) com filtros por período/eventos**  
   - DoD: exportar listas e consolidado com rastreabilidade (protocolo, timestamps, ator).
