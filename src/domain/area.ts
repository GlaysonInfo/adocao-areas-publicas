// src/domain/area.ts
export type AreaStatus = "disponivel" | "em_adocao" | "adotada";

export type AreaArquivoMeta = {
  file_name: string;
  file_size: number;
  mime_type: string;
  last_modified: number;
};

export type AreaPublica = {
  /** id interno (uuid) */
  id: string;

  /** código externo/legado/importação (ex.: BETIM-PRACA-0001) */
  codigo: string;

  nome: string;
  tipo: string; // ex.: "Praça", "Parque", "Canteiro" (mantive string para flexibilidade)
  bairro: string;
  logradouro: string;
  metragem_m2: number;

  /** disponível / em adoção / adotada */
  status: AreaStatus;

  /** ativar/inativar no portal */
  ativo: boolean;

  /** restrições e observações públicas */
  restricoes?: string;

  /** opcional: ponto central para futura integração SIG */
  latitude_centro?: number;
  longitude_centro?: number;

  /** opcional: metadado do arquivo KML/KMZ */
  geo_arquivo?: AreaArquivoMeta;

  created_at: string;
  updated_at: string;
};