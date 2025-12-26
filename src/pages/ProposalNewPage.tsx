import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { AreaPublica } from "../domain/area";
import type { DocumentoMeta, DocumentoTipo, PropostaAdocao } from "../domain/proposal";
import { listAreasPublic, subscribeAreas } from "../storage/areas";
import { createProposal } from "../storage/proposals";
import { useAuth } from "../auth/AuthContext";
import { next_protocol as nextProtocol } from "../storage/protocol";

const doc_types: { tipo: DocumentoTipo; label: string }[] = [
  { tipo: "carta_intencao", label: "Carta de Intenção (obrigatório)" },
  { tipo: "projeto_resumo", label: "Projeto Resumo (obrigatório)" },
];

function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const form_schema = z.object({
  area_id: z.string().min(1, "Selecione uma área."),
  descricao_plano: z.string().min(30, "Descreva o plano com pelo menos 30 caracteres."),
  carta_intencao: z.any().refine((v) => v instanceof FileList && v.length > 0, "Anexe a Carta de Intenção."),
  projeto_resumo: z.any().refine((v) => v instanceof FileList && v.length > 0, "Anexe o Projeto Resumo."),
});

type FormValues = z.infer<typeof form_schema>;

export function ProposalNewPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pre_area_id = searchParams.get("area_id") ?? "";

  const [tick, setTick] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => subscribeAreas(() => setTick((t) => t + 1)), []);

  const areas_disponiveis = useMemo(() => {
    return listAreasPublic().filter((a) => a.status === "disponivel" && a.ativo !== false);
  }, [tick]);

  const preselectedArea = useMemo<AreaPublica | null>(() => {
    if (!pre_area_id) return null;
    return areas_disponiveis.find((a) => a.id === pre_area_id) ?? null;
  }, [pre_area_id, areas_disponiveis]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<FormValues>({
    resolver: zodResolver(form_schema),
    defaultValues: { area_id: preselectedArea?.id ?? "", descricao_plano: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    if (preselectedArea?.id) setValue("area_id", preselectedArea.id);
  }, [preselectedArea?.id, setValue]);

  const area_id = watch("area_id");

  const areaSelecionada = useMemo(() => {
    return areas_disponiveis.find((a) => a.id === area_id) ?? null;
  }, [area_id, areas_disponiveis]);

  async function nextFromStep1() {
    const ok = await trigger(["area_id", "descricao_plano"]);
    if (ok) setStep(2);
  }

  async function nextFromStep2() {
    const ok = await trigger(["carta_intencao", "projeto_resumo"]);
    if (ok) setStep(3);
  }

  function fileMeta(tipo: DocumentoTipo, list: FileList): DocumentoMeta {
    const f = list.item(0)!;
    return {
      tipo,
      file_name: f.name,
      file_size: f.size,
      mime_type: f.type || "application/octet-stream",
      last_modified: f.lastModified,
    };
  }

  const onSubmit = (values: FormValues) => {
    if (!areaSelecionada) return;

    const proposta_id = safeUuid();
    const actor_role = role ?? "adotante_pf";

    const proposta: PropostaAdocao = {
      id: proposta_id,
      codigo_protocolo: nextProtocol(),
      area_id: areaSelecionada.id,
      area_nome: areaSelecionada.nome,
      descricao_plano: values.descricao_plano,
      kanban_coluna: "protocolo",
      documentos: [
        fileMeta("carta_intencao", values.carta_intencao as FileList),
        fileMeta("projeto_resumo", values.projeto_resumo as FileList),
      ],
      owner_role: actor_role,
      created_at: nowIso(),
      updated_at: nowIso(),
      history: [],
    };

    try {
      createProposal(proposta, actor_role);
      navigate(`/minhas-propostas/${encodeURIComponent(proposta_id)}`, { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Não foi possível criar a proposta.");
    }
  };

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Nova Proposta (wizard)</h1>
            <p className="page__subtitle">Etapa {step} de 3</p>
          </div>
        </header>

        <div className="card pad">
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 ? (
              <section className="formWide">
                <label className="fieldLabel">
                  Área disponível
                  <select className="input" {...register("area_id")}>
                    <option value="">Selecione</option>
                    {areas_disponiveis.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} — {a.bairro} ({a.metragem_m2} m²)
                      </option>
                    ))}
                  </select>
                </label>
                {errors.area_id ? <div className="err">{errors.area_id.message}</div> : null}

                {areaSelecionada ? (
                  <div className="card pad" style={{ background: "rgba(255,255,255,.7)" }}>
                    <strong>Área selecionada:</strong>
                    <div>{areaSelecionada.nome}</div>
                    <div>
                      {areaSelecionada.bairro} — {areaSelecionada.metragem_m2} m²
                    </div>
                    {areaSelecionada.restricoes ? (
                      <div style={{ marginTop: 6 }}>
                        <strong>Restrições:</strong> {areaSelecionada.restricoes}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <label className="fieldLabel">
                  Descrição do plano (mín. 30 caracteres)
                  <textarea className="input" {...register("descricao_plano")} rows={7} />
                </label>
                {errors.descricao_plano ? <div className="err">{errors.descricao_plano.message}</div> : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn--primary" type="button" onClick={nextFromStep1}>
                    Próximo
                  </button>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="formWide">
                <p style={{ margin: 0 }}>
                  Anexos obrigatórios (MVP guarda apenas metadados; o upload real entra com backend).
                </p>

                <label className="fieldLabel">
                  {doc_types[0].label}
                  <input type="file" {...register("carta_intencao")} />
                </label>
                {errors.carta_intencao ? <div className="err">{errors.carta_intencao.message as string}</div> : null}

                <label className="fieldLabel">
                  {doc_types[1].label}
                  <input type="file" {...register("projeto_resumo")} />
                </label>
                {errors.projeto_resumo ? <div className="err">{errors.projeto_resumo.message as string}</div> : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={() => setStep(1)}>
                    Voltar
                  </button>
                  <button className="btn btn--primary" type="button" onClick={nextFromStep2}>
                    Próximo
                  </button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="formWide">
                <h3 style={{ margin: 0 }}>Revisão</h3>

                <div className="card pad" style={{ background: "rgba(255,255,255,.7)" }}>
                  <div>
                    <strong>Área:</strong> {areaSelecionada?.nome ?? "-"}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <strong>Plano:</strong>
                    <div style={{ whiteSpace: "pre-wrap" }}>{watch("descricao_plano")}</div>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <strong>Documentos:</strong>
                    <ul style={{ margin: "6px 0 0 18px" }}>
                      <li>Carta de Intenção: {(watch("carta_intencao") as FileList)?.item(0)?.name ?? "-"}</li>
                      <li>Projeto Resumo: {(watch("projeto_resumo") as FileList)?.item(0)?.name ?? "-"}</li>
                    </ul>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={() => setStep(2)}>
                    Voltar
                  </button>
                  <button className="btn btn--primary" type="submit">
                    Enviar e gerar protocolo
                  </button>
                </div>
              </section>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}