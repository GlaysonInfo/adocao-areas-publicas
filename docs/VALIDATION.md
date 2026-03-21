# VALIDATION — Evidências e reprodução

> Documento de validação funcional do MVP, com foco em reprodução manual, evidências mínimas e critérios objetivos de aceite.

## 1. Objetivo
Este documento registra como validar manualmente o comportamento atual do sistema, com base em:
- fluxo principal do adotante
- movimentação do Kanban
- persistência em `localStorage`
- atualização automática do status das áreas
- coerência entre eventos e relatórios

## 2. Escopo validado
A validação cobre, no mínimo, os seguintes pontos:
- importação de áreas por CSV
- listagem de áreas disponíveis
- criação de proposta
- bloqueio de concorrência por área
- movimentação por perfil no Kanban
- solicitação de ajustes com motivo obrigatório
- atendimento de ajustes pelo adotante
- atualização de status da área
- relatórios baseados em eventos
- consistência do `localStorage`

## 3. Pré-condições
Antes de iniciar a validação, garantir que:

1. a aplicação esteja executando localmente
2. o navegador esteja com acesso ao DevTools
3. a base esteja limpa ou em estado conhecido
4. exista ao menos um CSV válido para importação de áreas
5. os perfis de teste estejam disponíveis:
   - adotante_pf ou adotante_pj
   - gestor_semad
   - gestor_ecos
   - gestor_governo
   - administrador

## 4. Ambiente da validação
Preencher antes ou depois da execução.

- Data da validação:
- Responsável:
- Branch:
- Commit:
- Navegador:
- URL local:
- Observações do ambiente:

---

## 5. Evidência A — Snapshot sanitizado do localStorage

### 5.1 Finalidade
Registrar o estado persistido do MVP sem expor dados sensíveis.

### 5.2 Passos
1. Abrir o portal no navegador.
2. Abrir DevTools → Console.
3. Executar o snippet abaixo.
4. Colar o resultado na seção “Resultado coletado”.

### 5.3 Snippet sanitizado
```js
(() => {
  const REDACT = [
    { name: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { name: "phone", re: /\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}-?\d{4}\b/g },
    { name: "cpf", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
    { name: "cnpj", re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g }
  ];

  const sanitizeString = (s) => {
    let out = String(s ?? "");
    for (const r of REDACT) out = out.replace(r.re, "[REDACTED]");
    return out;
  };

  const sanitize = (v) => {
    if (v == null) return v;
    if (typeof v === "string") return sanitizeString(v);
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.map(sanitize);
    if (typeof v === "object") {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = sanitize(val);
      return o;
    }
    return sanitizeString(v);
  };

  const keys = Object.keys(localStorage).sort();
  const dump = {};

  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw == null) continue;

    let parsed = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {}

    dump[k] = sanitize(parsed);
  }

  const md = `## Resultado coletado — localStorage (sanitizado)
  {
    "carandai:areas": [
        {
            "id_area": "a-001",
            "nome": "Praça Central",
            "logradouro": "Praça Barão de Santa CecÃ­lia",
            "bairro": "Centro",
            "status": "DISPONIVEL"
        },
        {
            "id_area": "a-002",
            "nome": "Canteiro Av. das Palmeiras",
            "logradouro": "Av. das Palmeiras",
            "bairro": "Centro",
            "status": "DISPONIVEL"
        },
        {
            "id_area": "a-003",
            "nome": "Praça do Bairro Novo",
            "logradouro": "Rua das Flores",
            "bairro": "Bairro Novo",
            "status": "DISPONIVEL"
        }
    ],
    "carandai:events": [
        {
            "id_proposta": "p-85125a3ab94b98",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "DECISAO_ADMIN",
            "to_status": "TERMO_COOPERACAO",
            "actor_role": "gestor_semma",
            "note": "OK",
            "id_evento": "e-55f9caf24e3108",
            "created_at": 1767740557047
        },
        {
            "id_proposta": "p-85125a3ab94b98",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "ANALISE_SEMMA",
            "to_status": "DECISAO_ADMIN",
            "actor_role": "gestor_semma",
            "note": "OK",
            "id_evento": "e-899e4407014ee8",
            "created_at": 1767740548959
        },
        {
            "id_proposta": "p-85125a3ab94b98",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "PROTOCOLO",
            "to_status": "ANALISE_SEMMA",
            "actor_role": "gestor_semma",
            "note": "OK",
            "id_evento": "e-a540803dce55",
            "created_at": 1767740542177
        },
        {
            "id_proposta": "p-85125a3ab94b98",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "INTERESSE",
            "to_status": "PROTOCOLO",
            "actor_role": "gestor_adm_publica",
            "note": "",
            "id_evento": "e-82b24179104538",
            "created_at": 1767739489585
        },
        {
            "id_proposta": "p-e746333da4462",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "DECISAO_ADMIN",
            "to_status": "TERMO_ASSINADO",
            "actor_role": "gestor_adm_publica",
            "note": "Aprovado",
            "id_evento": "e-30fb2a8ca9d9a8",
            "created_at": 1767739468038
        },
        {
            "id_proposta": "p-e746333da4462",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "ANALISE_SEMMA",
            "to_status": "DECISAO_ADMIN",
            "actor_role": "gestor_adm_publica",
            "note": "",
            "id_evento": "e-de4645a376a4d",
            "created_at": 1767739461572
        },
        {
            "id_proposta": "p-5b3186db135ba",
            "type": "NOTE",
            "action": "criar",
            "from_status": null,
            "to_status": "INTERESSE",
            "actor_role": "adotante_pf",
            "note": "Proposta criada.",
            "id_evento": "e-ede3b20af0559",
            "created_at": 1767739379752
        },
        {
            "id_proposta": "p-85125a3ab94b98",
            "type": "NOTE",
            "action": "criar",
            "from_status": null,
            "to_status": "INTERESSE",
            "actor_role": "adotante_pf",
            "note": "Proposta criada.",
            "id_evento": "e-b3aa6a41b68f5",
            "created_at": 1767739328875
        },
        {
            "id_proposta": "p-e746333da4462",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "PROTOCOLO",
            "to_status": "ANALISE_SEMMA",
            "actor_role": "gestor_semma",
            "note": "",
            "id_evento": "e-8e2d8d9e6059b8",
            "created_at": 1767739292124
        },
        {
            "id_proposta": "p-e746333da4462",
            "type": "TRANSITION",
            "action": "mover",
            "from_status": "INTERESSE",
            "to_status": "PROTOCOLO",
            "actor_role": "gestor_semma",
            "note": "",
            "id_evento": "e-bdf0f93e762a",
            "created_at": 1767739290075
        },
        {
            "id_proposta": "p-e746333da4462",
            "type": "NOTE",
            "action": "criar",
            "from_status": null,
            "to_status": "INTERESSE",
            "actor_role": "adotante_pf",
            "note": "Proposta criada.",
            "id_evento": "e-6d1509655975f",
            "created_at": 1767739169998
        }
    ],
    "carandai:proposals": [
        {
            "id_proposta": "p-e746333da4462",
            "id_area": "a-001",
            "titulo": "Praça Central",
            "descricao": "Realizar manutenção periódica, jardinagem e cuidar da iluminação. Desejo colocar placa da empresa.",
            "codigo_protocolo": "CARANDAI-[REDACTED]",
            "status": "TERMO_ASSINADO",
            "adotante_id": "u-pf",
            "created_at": 1767739169998,
            "decision": null,
            "termo_txt_base64": null
        },
        {
            "id_proposta": "p-85125a3ab94b98",
            "id_area": "a-002",
            "titulo": "Praça Central",
            "descricao": "Iluminação e jardinagem por 12 meses",
            "codigo_protocolo": "CARANDAI-[REDACTED]",
            "status": "TERMO_COOPERACAO",
            "adotante_id": "u-pf",
            "created_at": 1767739328874,
            "decision": null,
            "termo_txt_base64": null
        },
        {
            "id_proposta": "p-5b3186db135ba",
            "id_area": "a-003",
            "titulo": "Praça do Bairro Novo",
            "descricao": "Plantio de espécies, recuperação do passeio",
            "codigo_protocolo": "CARANDAI-[REDACTED]",
            "status": "INTERESSE",
            "adotante_id": "u-pf",
            "created_at": 1767739379752,
            "decision": null,
            "termo_txt_base64": null
        }
    ],
    "carandai:session": {
        "id_usuario": "u-pj",
        "nome": "Adotante PJ",
        "role": "adotante_pj"
    },
    "carandai:users": [
        {
            "id_usuario": "u-admin",
            "nome": "Admin",
            "role": "admin"
        },
        {
            "id_usuario": "u-semmaa",
            "nome": "Gestor SEMMA",
            "role": "gestor_semma"
        },
        {
            "id_usuario": "u-adm",
            "nome": "Gestor Adm. PÃºblica",
            "role": "gestor_adm_publica"
        },
        {
            "id_usuario": "u-pf",
            "nome": "Adotante PF",
            "role": "adotante_pf"
        },
        {
            "id_usuario": "u-pj",
            "nome": "Adotante PJ",
            "role": "adotante_pj"
        }
    ],
    "mvp_adopters_v1": [
        {
            "id": "0abd6d22-5dda-48a5-9be5-284228ebfa06",
            "role": "adotante_pf",
            "nome_razao_social": "Karine Horta Palhares",
            "email": "[REDACTED]",
            "celular": "[REDACTED]",
            "created_at": "2026-01-27T22:10:11.157Z",
            "updated_at": "2026-01-27T22:10:11.157Z"
        }
    ],
    "mvp_area_requests_v1": [
        {
            "id": "23343b9a-9c84-4c48-be7e-f909e8630ea5",
            "codigo_protocolo": "BETIM-[REDACTED]",
            "status": "aprovada",
            "owner_role": "adotante_pf",
            "lote": "305",
            "quadra": "20",
            "localizacao_descritiva": "Atrás do Hospital Mater Dei Betim",
            "geo": {
                "lat": -22.178477132403113,
                "lng": -51.41762733729433,
                "accuracy_m": 101,
                "captured_at": "2026-01-27T22:16:33.950Z"
            },
            "descricao_intervencao": "Limpeza da área e conservação (poda e capina)",
            "documentos": [
                {
                    "tipo": "carta_intencao",
                    "file_name": ".gitignore",
                    "file_size": 43,
                    "mime_type": "text/plain",
                    "last_modified": 1766117521804
                },
                {
                    "tipo": "projeto_resumo",
                    "file_name": "index.html",
                    "file_size": 365,
                    "mime_type": "text/html",
                    "last_modified": 1765908371387
                },
                {
                    "tipo": "foto_referencia",
                    "file_name": "index.html",
                    "file_size": 365,
                    "mime_type": "text/html",
                    "last_modified": 1765908371387
                }
            ],
            "area_draft": {
                "codigo": "AREA-BETIM20260002",
                "nome": "Área solicitada (BETIM-[REDACTED])",
                "tipo": "Área Pública",
                "bairro": "Laranjeiras",
                "logradouro": "4",
                "metragem_m2": 4200
            },
            "created_area_id": "75605d8d-1af7-45bb-a065-66506c2ad89a",
            "created_proposal_id": "8f728901-d2f9-4053-95a0-ebfe5d9485e4",
            "created_at": "2026-01-27T22:19:00.554Z",
            "updated_at": "2026-01-27T22:22:27.711Z",
            "history": [
                {
                    "type": "create",
                    "at": "2026-01-27T22:19:00.554Z",
                    "actor_role": "adotante_pf",
                    "id": "9cbdc2fc-007b-4f6f-87b9-93f61b13d07c"
                },
                {
                    "type": "decision",
                    "at": "2026-01-27T22:22:27.711Z",
                    "actor_role": "administrador",
                    "decision": "approved",
                    "decision_note": "Aprovada após verificação SisGeo.",
                    "id": "3b9d6732-b9c5-47e1-8a07-a716f84f8e06"
                }
            ]
        }
    ],
    "mvp_areas_seeded_v1": 1,
    "mvp_areas_v1": [
        {
            "id": "75605d8d-1af7-45bb-a065-66506c2ad89a",
            "codigo": "AREA-BETIM20260002",
            "nome": "Área solicitada (BETIM-[REDACTED])",
            "tipo": "Área Pública",
            "bairro": "Laranjeiras",
            "logradouro": "4",
            "metragem_m2": 4200,
            "status": "adotada",
            "ativo": true,
            "created_at": "2026-01-27T22:22:27.711Z",
            "updated_at": "2026-01-27T22:36:20.666Z"
        },
        {
            "id": "a1",
            "codigo": "BETIM-AREA-0001",
            "nome": "Pra�a da Matriz",
            "tipo": "Pra�a",
            "bairro": "Centro",
            "logradouro": "Av. Principal, s/n",
            "metragem_m2": 850,
            "status": "disponivel",
            "ativo": true,
            "restricoes": "N�o permite estruturas permanentes",
            "latitude_centro": -19.9671,
            "longitude_centro": -44.1982,
            "created_at": "2026-01-27T22:06:36.505Z",
            "updated_at": "2026-01-27T22:08:38.615Z"
        },
        {
            "id": "a2",
            "codigo": "BETIM-AREA-0002",
            "nome": "Campo do Bom Retiro",
            "tipo": "Campo de Futebol",
            "bairro": "Bom Retiro",
            "logradouro": "Av. B",
            "metragem_m2": 13782,
            "status": "em_adocao",
            "ativo": true,
            "restricoes": "Proibido cercar",
            "created_at": "2026-01-27T22:06:36.505Z",
            "updated_at": "2026-01-27T22:13:17.400Z"
        },
        {
            "id": "ec5ea858-49a0-4a10-8471-87e969df7ba8",
            "codigo": "BETIM-AREA-0003",
            "nome": "Canteiro Av. das Palmeiras",
            "tipo": "Canteiro",
            "bairro": "Jardim",
            "logradouro": "Av. das Palmeiras, 1200",
            "metragem_m2": 420,
            "status": "disponivel",
            "ativo": true,
            "restricoes": "Manter visibilidade de sinaliza��o vi�ria",
            "created_at": "2026-01-27T22:08:38.616Z",
            "updated_at": "2026-01-27T22:08:38.616Z"
        }
    ],
    "mvp_proposals_v1": [
        {
            "id": "8f728901-d2f9-4053-95a0-ebfe5d9485e4",
            "codigo_protocolo": "BETIM-[REDACTED]",
            "area_id": "75605d8d-1af7-45bb-a065-66506c2ad89a",
            "area_nome": "Área solicitada (BETIM-[REDACTED])",
            "descricao_plano": "Limpeza da área e conservação (poda e capina)",
            "kanban_coluna": "termo_assinado",
            "documentos": [
                {
                    "tipo": "carta_intencao",
                    "file_name": ".gitignore",
                    "file_size": 43,
                    "mime_type": "text/plain",
                    "last_modified": 1766117521804
                },
                {
                    "tipo": "projeto_resumo",
                    "file_name": "index.html",
                    "file_size": 365,
                    "mime_type": "text/html",
                    "last_modified": 1765908371387
                }
            ],
            "owner_role": "adotante_pf",
            "created_at": "2026-01-27T22:19:00.554Z",
            "updated_at": "2026-01-27T22:36:20.660Z",
            "history": [
                {
                    "id": "1a1a3b0f-c064-[REDACTED]-eae3b72a3899",
                    "type": "create",
                    "at": "2026-01-27T22:19:00.554Z",
                    "actor_role": "adotante_pf"
                },
                {
                    "id": "98e08fc7-[REDACTED]-91a0-93bf9a0373f3",
                    "type": "move",
                    "at": "2026-01-27T22:31:48.337Z",
                    "actor_role": "gestor_semad",
                    "from": "protocolo",
                    "to": "analise_semad"
                },
                {
                    "id": "660b260d-f3ea-47fa-affc-7f16b72c962f",
                    "type": "override_no_vistoria",
                    "at": "2026-01-27T22:35:20.155Z",
                    "actor_role": "gestor_semad",
                    "from": "analise_semad",
                    "to": "analise_ecos",
                    "note": "Área não necessita de vistoria",
                    "meta": {
                        "gate_from": "analise_semad",
                        "gate_to": "analise_ecos"
                    }
                },
                {
                    "id": "6f0d43bd-baee-4a9d-a9f9-1698910c15d2",
                    "type": "move",
                    "at": "2026-01-27T22:35:20.156Z",
                    "actor_role": "gestor_semad",
                    "from": "analise_semad",
                    "to": "analise_ecos"
                },
                {
                    "id": "f950c4ea-e93c-44b2-96bd-d96331792c86",
                    "type": "move",
                    "at": "2026-01-27T22:36:05.546Z",
                    "actor_role": "gestor_ecos",
                    "from": "analise_ecos",
                    "to": "decisao"
                },
                {
                    "id": "a5390c9c-1316-47a6-98d6-1c7da1720931",
                    "type": "move",
                    "at": "2026-01-27T22:36:20.660Z",
                    "actor_role": "gestor_governo",
                    "from": "decisao",
                    "to": "termo_assinado"
                },
                {
                    "id": "1643f8ce-2333-4f99-b19f-a14c10e0cabf",
                    "type": "decision",
                    "at": "2026-01-27T22:36:20.660Z",
                    "actor_role": "gestor_governo",
                    "decision": "approved"
                }
            ],
            "closed_status": "approved",
            "closed_at": "2026-01-27T22:36:20.660Z"
        },
        {
            "id": "537e6140-e3ce-46d8-996c-b6057b7f5e45",
            "codigo_protocolo": "BETIM-[REDACTED]",
            "area_id": "a2",
            "area_nome": "Campo do Bom Retiro",
            "descricao_plano": "Arborização, plantio de grama e manutenção da área, limpeza e iluminação",
            "kanban_coluna": "decisao",
            "documentos": [
                {
                    "tipo": "carta_intencao",
                    "file_name": "docker-compose.yml",
                    "file_size": 455,
                    "mime_type": "application/octet-stream",
                    "last_modified": 1766880995307
                },
                {
                    "tipo": "projeto_resumo",
                    "file_name": "package.json",
                    "file_size": 1040,
                    "mime_type": "application/json",
                    "last_modified": 1766891047763
                }
            ],
            "owner_role": "adotante_pf",
            "created_at": "2026-01-27T22:13:17.397Z",
            "updated_at": "2026-01-27T22:32:44.325Z",
            "history": [
                {
                    "id": "edf041ff-03b4-4532-a57e-203df4e860f6",
                    "type": "create",
                    "at": "2026-01-27T22:13:17.397Z",
                    "actor_role": "adotante_pf"
                },
                {
                    "id": "32da562e-c129-42a8-b48b-e100da028bcc",
                    "type": "move",
                    "at": "2026-01-27T22:24:23.936Z",
                    "actor_role": "gestor_semad",
                    "from": "protocolo",
                    "to": "analise_semad"
                },
                {
                    "id": "927d1ce1-1ac6-43d5-a6db-2a0d2a7062f7",
                    "type": "move",
                    "at": "2026-01-27T22:25:13.194Z",
                    "actor_role": "gestor_semad",
                    "from": "analise_semad",
                    "to": "ajustes",
                    "note": "Falta  a carta de intenções"
                },
                {
                    "id": "617eb928-2a2c-4a94-afd3-3de54859b61f",
                    "type": "request_adjustments",
                    "at": "2026-01-27T22:25:13.194Z",
                    "actor_role": "gestor_semad",
                    "from": "analise_semad",
                    "to": "ajustes",
                    "note": "Falta  a carta de intenções"
                },
                {
                    "id": "ad42d42a-[REDACTED]-bb82-6de4b4901034",
                    "type": "move",
                    "at": "2026-01-27T22:30:50.677Z",
                    "actor_role": "gestor_semad",
                    "from": "ajustes",
                    "to": "analise_semad"
                },
                {
                    "id": "4dda0092-518d-4390-a893-5dde91a7d9d3",
                    "type": "move",
                    "at": "2026-01-27T22:31:46.595Z",
                    "actor_role": "gestor_semad",
                    "from": "analise_semad",
                    "to": "analise_ecos"
                },
                {
                    "id": "6053bc63-5886-447e-8569-b018a1d2d681",
                    "type": "move",
                    "at": "2026-01-27T22:32:44.325Z",
                    "actor_role": "gestor_ecos",
                    "from": "analise_ecos",
                    "to": "decisao"
                }
            ],
            "closed_status": null,
            "closed_at": null
        }
    ],
    "mvp_protocolo_seq_2026": 2,
    "mvp_role": "administrador",
    "mvp_vistorias_v1": [
        {
            "id": "2104a2d6-355d-[REDACTED]-9bd0549e19ea",
            "proposal_id": "537e6140-e3ce-46d8-996c-b6057b7f5e45",
            "codigo_protocolo": "BETIM-[REDACTED]",
            "area_id": "a2",
            "area_nome": "Campo do Bom Retiro",
            "fase": "analise_pre_termo",
            "status": "laudo_emitido",
            "agendada_para": "2026-01-27T22:25:00.000Z",
            "local_texto": "Campo do Bom Retiro",
            "checklist": {
                "acesso": "ok",
                "iluminacao": "nao_ok",
                "limpeza": "nao_ok",
                "sinalizacao": "ok",
                "risco": "baixo",
                "observacoes": "Aprovado sem ressalvas"
            },
            "observacoes": "",
            "anexos": [],
            "laudo": {
                "conclusao": "favoravel",
                "emitido_em": "2026-01-27T22:28:00.000Z",
                "recomendacoes": "PREFEITURA DE BETIM • EDUCAÇÃO AMBIENTAL\nPROGRAMA: ADOTE UMA ÁREA PÚBLICA\nBase legal (Betim): Lei Municipal nº 6.180/2017 e Decreto nº 40.891/2017\nContato: [REDACTED] • Telefone: ([REDACTED]\n\nLAUDO TÉCNICO (MVP) — VISTORIA / PRÉ-ADOÇÃO\n\n1) Identificação\n• Protocolo: BETIM-[REDACTED]\n• Área: Campo do Bom Retiro\n• Fase/Tipo de vistoria: analise_pre_termo\n• Local: Campo do Bom Retiro\n• Agendada para: 27/01/2026, 19:25:00\n• Realizada em: 27/01/2026, 19:28:32\n• Responsável (SEMAD): gestor_semad\n\n2) Contexto do programa (resumo)\nO programa ADOTE UMA ÁREA PÚBLICA promove cooperação entre a Prefeitura de Betim e a sociedade para qualificar espaços públicos e áreas verdes, por meio de ações de manutenção, implantação, reforma e melhoria urbana/paisagística/ambiental, conforme regras municipais e termo firmado.\nA adoção não concede uso exclusivo do espaço: regulamenta responsabilidades, contrapartidas e padrões de execução.\n\n3) Escopo da vistoria\nRegistrar condições gerais e achados relevantes para subsidiar a análise técnica do processo de adoção, incluindo riscos, conservação e necessidades de adequação.\n\n4) Checklist (campos fixos)\n• Acesso: OK\n• Iluminação: Não OK\n• Limpeza: Não OK\n• Sinalização: OK\n• Risco: Baixo\n\n5) Evidências / observações objetivas\nAprovado sem ressalvas\n\n6) Análise técnica (edição do gestor)\n(Complete com sua análise: conformidades, não conformidades, pontos de atenção, impactos e justificativas.)\n\n7) Recomendações / condicionantes\n(Edite e detalhe recomendações. Exemplos: adequação de sinalização, manejo de vegetação, ajustes no plano do adotante, cronograma, anexar fotos/metadados, condicionantes para deferimento.)\n\n8) Conclusão\n(Definir no campo “Conclusão” acima: Favorável / Com ressalvas / Desfavorável.)\n— Fim —\n",
                "responsavel_role": "gestor_semad"
            },
            "created_at": "2026-01-27T22:26:55.536Z",
            "updated_at": "2026-01-27T22:29:47.389Z",
            "history": [
                {
                    "id": "ea74c264-2c42-43f1-8378-39cbb80e140d",
                    "type": "create",
                    "at": "2026-01-27T22:26:55.536Z",
                    "actor_role": "gestor_semad"
                },
                {
                    "id": "62f3546c-3332-4c5d-b8e2-3a84f8646480",
                    "type": "update_checklist",
                    "at": "2026-01-27T22:27:49.235Z",
                    "actor_role": "gestor_semad"
                },
                {
                    "id": "02e67654-339e-4b94-9cf1-9606ccb505fd",
                    "type": "status_change",
                    "at": "2026-01-27T22:28:32.897Z",
                    "actor_role": "gestor_semad",
                    "from_status": "agendada",
                    "to_status": "realizada"
                },
                {
                    "id": "4214754d-f552-4820-b9a6-427f6b2a0e69",
                    "type": "status_change",
                    "at": "2026-01-27T22:29:47.389Z",
                    "actor_role": "gestor_semad",
                    "from_status": "realizada",
                    "to_status": "laudo_emitido",
                    "note": "Laudo emitido"
                },
                {
                    "id": "6c9a4127-e388-4fc2-939f-6d82fbba1123",
                    "type": "emit_laudo",
                    "at": "2026-01-27T22:29:47.389Z",
                    "actor_role": "gestor_semad",
                    "note": "Conclusão: favoravel"
                }
            ]
        }
    ]
}

\`\`\`json
${JSON.stringify(dump, null, 2)}
\`\`\``;

  console.log(md);

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(md).then(
      () => console.log("✅ Copiado para a área de transferência."),
      () => console.log("⚠️ Não foi possível copiar automaticamente; copie manualmente do console.")
    );
  }
})();