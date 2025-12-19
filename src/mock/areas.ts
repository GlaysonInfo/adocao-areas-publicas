// src/mock/areas.ts
import type { AreaPublica } from "../domain/area";

export const mock_areas: Partial<AreaPublica>[] = [
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
    restricoes: "Não permite estruturas permanentes.",
  },
  {
    id: "a2",
    codigo: "BETIM-AREA-0002",
    nome: "Canteiro Av. das Palmeiras",
    tipo: "Canteiro",
    bairro: "Jardim",
    logradouro: "Av. das Palmeiras, 1200",
    metragem_m2: 420,
    status: "em_adocao",
    ativo: true,
    restricoes: "Manter visibilidade de sinalização viária.",
  },
];