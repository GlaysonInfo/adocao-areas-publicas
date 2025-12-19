export type AdotanteRole = "adotante_pf" | "adotante_pj";

export type AdotantePerfil = {
  id: string;
  role: AdotanteRole;

  nome_razao: string;
  email: string;

  celular: string;     // obrigatório (pra contato)
  whatsapp?: string;   // opcional (se diferente do celular)

  created_at: string;
  updated_at: string;
};

export type AdotanteContatoSnapshot = {
  nome_razao: string;
  email: string;
  celular: string;
  whatsapp?: string;
  role: AdotanteRole;
};