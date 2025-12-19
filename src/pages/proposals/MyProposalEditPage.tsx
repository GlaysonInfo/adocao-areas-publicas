import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useAuth } from "../../auth/AuthContext";
import { getProposalById, subscribeProposals, adopterUpdateAndResubmitFromAdjustments } from "../../storage/proposals";
import type { PropostaAdocao } from "../../domain/proposal";

const schema = z.object({
  descricao_plano: z.string().min(30, "Descreva o plano com pelo menos 30 caracteres."),
  carta_intencao: z.any().optional(),
  projeto_resumo: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

export function MyProposalEditPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => subscribeProposals(() => setTick((t) => t + 1)), []);

  const proposal = useMemo(() => {
    if (!id) return null;
    return getProposalById(id) as PropostaAdocao | null;
  }, [id, tick]);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      descricao_plano: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (proposal?.descricao_plano) setValue("descricao_plano", proposal.descricao_plano);
  }, [proposal?.descricao_plano, setValue]);

  if (!proposal) return <div className="container"><div className="card pad">Proposta não encontrada.</div></div>;

  if ((proposal.kanban_coluna as any) !== "ajustes") {
    return (
      <div className="container">
        <div className="card pad">
          <h2>Atender ajustes</h2>
          <p>Esta proposta não está em AJUSTES. Nada para editar aqui.</p>
          <button className="btn" onClick={() => navigate(`/minhas-propostas/${encodeURIComponent(proposal.id)}`)}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const onSubmit = (v: FormValues) => {
    try {
      adopterUpdateAndResubmitFromAdjustments(
        proposal.id,
        {
          descricao_plano: v.descricao_plano,
          carta_intencao: (v.carta_intencao as FileList) ?? null,
          projeto_resumo: (v.projeto_resumo as FileList) ?? null,
        },
        role ?? "adotante_pf"
      );

      navigate(`/minhas-propostas/${encodeURIComponent(proposal.id)}`, { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Não foi possível reenviar a proposta.");
    }
  };

  const docs = proposal.documentos ?? [];
  const carta = docs.find((d) => d.tipo === "carta_intencao");
  const proj = docs.find((d) => d.tipo === "projeto_resumo");

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Atender Ajustes</h1>
            <p className="page__subtitle">
              Protocolo <strong>{proposal.codigo_protocolo}</strong> · Área: <strong>{proposal.area_nome}</strong>
            </p>
          </div>
        </header>

        <div className="card pad">
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 12, maxWidth: 820 }}>
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <strong>Arquivos atuais</strong>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Carta de intenção: {carta?.file_name ?? "—"} <br />
                Projeto resumo: {proj?.file_name ?? "—"}
              </div>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Para substituir, selecione um novo arquivo abaixo. Se não selecionar, o arquivo atual é mantido.
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 800 }}>
                Descrição do plano (mín. 30 caracteres)
                <textarea {...register("descricao_plano")} rows={6} style={{ width: "100%", marginTop: 6 }} />
              </label>
              {errors.descricao_plano ? <div style={{ color: "crimson" }}>{errors.descricao_plano.message}</div> : null}
            </div>

            <div>
              <label style={{ fontWeight: 800 }}>
                Substituir Carta de Intenção (opcional)
                <input type="file" {...register("carta_intencao")} style={{ display: "block", marginTop: 6 }} />
              </label>
            </div>

            <div>
              <label style={{ fontWeight: 800 }}>
                Substituir Projeto Resumo (opcional)
                <input type="file" {...register("projeto_resumo")} style={{ display: "block", marginTop: 6 }} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn" onClick={() => navigate(`/minhas-propostas/${encodeURIComponent(proposal.id)}`)}>
                Cancelar
              </button>
              <button type="submit" className="btn">
                Reenviar para Análise (voltar para Protocolo)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}