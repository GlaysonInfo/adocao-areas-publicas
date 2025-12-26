// src/pages/ManagerVistoriaNewPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useAuth } from "../auth/AuthContext";
import { getProposalById, subscribeProposals } from "../storage/proposals";
import { createVistoria } from "../storage/vistorias";
import type { VistoriaChecklist, VistoriaFase } from "../domain/vistoria";

const schema = z.object({
  fase: z.enum(["analise_pre_termo", "execucao_pos_termo"]),
  agendada_para: z.string().min(1, "Informe data/hora do agendamento."),
  local_texto: z.string().min(3, "Informe a localização (texto)."),

  acesso: z.enum(["ok", "pendente", "nao_ok"]),
  iluminacao: z.enum(["ok", "pendente", "nao_ok"]),
  limpeza: z.enum(["ok", "pendente", "nao_ok"]),
  sinalizacao: z.enum(["ok", "pendente", "nao_ok"]),
  risco: z.enum(["baixo", "medio", "alto"]),
  checklist_obs: z.string().optional(),

  observacoes: z.string().optional(),

  fotos: z.any().optional(),
  arquivos: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

function toIsoFromDatetimeLocal(v: string) {
  // input datetime-local: "2025-12-22T14:30"
  // ISO: new Date(v).toISOString()
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function ManagerVistoriaNewPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const proposal_id = searchParams.get("proposal_id") ?? "";

  // mantém proposta atualizada
  const [tickP, setTickP] = useState(0);
  useEffect(() => subscribeProposals(() => setTickP((t) => t + 1)), []);

  const proposal = useMemo(() => (proposal_id ? getProposalById(proposal_id) : null), [proposal_id, tickP]);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      fase: "analise_pre_termo",
      acesso: "pendente",
      iluminacao: "pendente",
      limpeza: "pendente",
      sinalizacao: "pendente",
      risco: "baixo",
      checklist_obs: "",
      observacoes: "",
      agendada_para: "",
      local_texto: "",
    },
  });

  // se quiser sugerir local usando nome da área:
  useEffect(() => {
    if (proposal?.area_nome) {
      // só preenche se vazio
      const cur = String(watch("local_texto") ?? "").trim();
      if (!cur) setValue("local_texto", proposal.area_nome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.area_nome]);

  const onSubmit = (values: FormValues) => {
    if (!proposal_id) {
      alert("proposal_id ausente. Volte e acesse a criação a partir da proposta.");
      return;
    }

    const agIso = toIsoFromDatetimeLocal(values.agendada_para);
    if (!agIso) {
      alert("Data/hora inválida.");
      return;
    }

    const checklist: VistoriaChecklist = {
      acesso: values.acesso,
      iluminacao: values.iluminacao,
      limpeza: values.limpeza,
      sinalizacao: values.sinalizacao,
      risco: values.risco,
      observacoes: values.checklist_obs ? String(values.checklist_obs) : "",
    };

    try {
      const v = createVistoria(
        {
          proposal_id,
          fase: values.fase as VistoriaFase,
          agendada_para: agIso,
          local_texto: String(values.local_texto).trim(),
          checklist,
          observacoes: values.observacoes ? String(values.observacoes) : "",
          // anexos (metadados) entram pelo detalhe após criar (MVP)
        },
        role ?? "unknown"
      );

      navigate(`/gestor/vistorias/${encodeURIComponent(v.id)}`, { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Não foi possível criar a vistoria.");
    }
  };

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Nova vistoria</h1>
            <p className="page__subtitle">
              {proposal ? (
                <>
                  <strong>{proposal.codigo_protocolo}</strong> — {proposal.area_nome}
                </>
              ) : (
                "Vincule uma proposta via querystring ?proposal_id=..."
              )}
            </p>
          </div>

          <div className="page__actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--subtle" to={proposal_id ? `/gestor/propostas/${encodeURIComponent(proposal_id)}` : "/gestor/kanban"}>
              Voltar
            </Link>
            <Link className="btn btn--subtle" to={`/gestor/vistorias${proposal_id ? `?proposal_id=${encodeURIComponent(proposal_id)}` : ""}`}>
              Lista de vistorias
            </Link>
          </div>
        </header>

        <div className="card pad">
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 12, maxWidth: 920 }}>
            <div className="grid cols-1">
              <label style={{ fontWeight: 800 }}>
                Fase
                <select {...register("fase")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                  <option value="analise_pre_termo">Análise (pré-termo)</option>
                  <option value="execucao_pos_termo">Execução (pós-termo)</option>
                </select>
              </label>

              <label style={{ fontWeight: 800 }}>
                Agendada para (data/hora) — obrigatório
                <input
                  type="datetime-local"
                  {...register("agendada_para")}
                  style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}
                />
                {errors.agendada_para ? <div style={{ color: "crimson" }}>{errors.agendada_para.message}</div> : null}
              </label>
            </div>

            <label style={{ fontWeight: 800 }}>
              Localização (texto) — obrigatório
              <input
                {...register("local_texto")}
                placeholder="Ex.: Praça X, Av. Y, próximo a..."
                style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}
              />
              {errors.local_texto ? <div style={{ color: "crimson" }}>{errors.local_texto.message}</div> : null}
            </label>

            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3 style={{ marginTop: 0 }}>Checklist (campos fixos)</h3>

              <div className="grid cols-3" style={{ gap: 12 }}>
                <label style={{ fontWeight: 800 }}>
                  Acesso
                  <select {...register("acesso")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="ok">OK</option>
                    <option value="pendente">Pendente</option>
                    <option value="nao_ok">Não OK</option>
                  </select>
                </label>

                <label style={{ fontWeight: 800 }}>
                  Iluminação
                  <select {...register("iluminacao")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="ok">OK</option>
                    <option value="pendente">Pendente</option>
                    <option value="nao_ok">Não OK</option>
                  </select>
                </label>

                <label style={{ fontWeight: 800 }}>
                  Limpeza
                  <select {...register("limpeza")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="ok">OK</option>
                    <option value="pendente">Pendente</option>
                    <option value="nao_ok">Não OK</option>
                  </select>
                </label>

                <label style={{ fontWeight: 800 }}>
                  Sinalização
                  <select {...register("sinalizacao")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="ok">OK</option>
                    <option value="pendente">Pendente</option>
                    <option value="nao_ok">Não OK</option>
                  </select>
                </label>

                <label style={{ fontWeight: 800 }}>
                  Risco
                  <select {...register("risco")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="baixo">Baixo</option>
                    <option value="medio">Médio</option>
                    <option value="alto">Alto</option>
                  </select>
                </label>
              </div>

              <label style={{ fontWeight: 800, marginTop: 10, display: "block" }}>
                Observações do checklist (opcional)
                <textarea {...register("checklist_obs")} rows={4} style={{ width: "100%", marginTop: 6 }} />
              </label>
            </div>

            <label style={{ fontWeight: 800 }}>
              Observações gerais (opcional)
              <textarea {...register("observacoes")} rows={4} style={{ width: "100%", marginTop: 6 }} />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" className="btn btn--primary">
                Criar vistoria
              </button>
              <button type="button" className="btn btn--subtle" onClick={() => navigate(-1)}>
                Cancelar
              </button>
            </div>

            <div className="muted">
              Anexos e laudo são adicionados no <strong>detalhe</strong> da vistoria (após criar), para manter o fluxo “agendada → realizada → laudo_emitido”.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}