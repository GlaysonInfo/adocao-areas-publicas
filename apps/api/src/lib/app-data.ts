// apps/api/src/lib/app-data.ts

export const mockAreas = [
  {
    id: "a1",
    codigo: "BETIM-AREA-0001",
    nome: "Praça da Matriz",
    tipo: "Praça",
    bairro: "Centro",
    logradouro: "Av. Principal, s/n",
    metragem_m2: 850,
    status: "disponivel",
    ativo: true,
  },
  {
    id: "a2",
    codigo: "BETIM-AREA-0002",
    nome: "Campo do Bom Retiro",
    tipo: "Campo de Futebol",
    bairro: "Bom Retiro",
    logradouro: "Av. B",
    metragem_m2: 13782,
    status: "em_adocao",
    ativo: true,
  }
];

export const mockProposals = [
  {
    id: "p1",
    codigo_protocolo: "BETIM-2026-0001",
    area_id: "a2",
    area_nome: "Campo do Bom Retiro",
    descricao_plano: "Arborização, paisagismo, limpeza e melhoria da área.",
    kanban_coluna: "decisao",
    owner_role: "adotante_pf",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: []
  }
];

export const mockAreaRequests = [
  {
    id: "ar1",
    codigo_protocolo: "BETIM-SOL-2026-0001",
    status: "em_verificacao",
    owner_role: "adotante_pf",
    localizacao_descritiva: "Área atrás do Hospital Mater Dei Betim",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: []
  }
];

export const mockVistorias = [
  {
    id: "v1",
    proposal_id: "p1",
    fase: "analise_pre_termo",
    status: "agendada",
    agendada_para: new Date().toISOString(),
    local_texto: "Campo do Bom Retiro",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    history: []
  }
];
