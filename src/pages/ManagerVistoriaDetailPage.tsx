// src/pages/ManagerVistoriaDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useAuth } from "../auth/AuthContext";
import type { VistoriaStatus } from "../domain/vistoria";
import {
  addVistoriaAnexos,
  emitVistoriaLaudo,
  getVistoriaById,
  subscribeVistorias,
  updateVistoriaChecklist,
  updateVistoriaSchedule,
  updateVistoriaStatus,
} from "../storage/vistorias";

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function toDatetimeLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromDatetimeLocal(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function nowDatetimeLocal() {
  return toDatetimeLocal(new Date().toISOString());
}

function checklistValueLabel(v: string) {
  const s = String(v ?? "").toLowerCase();
  if (s === "ok") return "OK";
  if (s === "pendente") return "Pendente";
  if (s === "nao_ok") return "Não OK";
  if (s === "baixo") return "Baixo";
  if (s === "medio") return "Médio";
  if (s === "alto") return "Alto";
  return s || "—";
}

function findStatusAt(v: any, toStatus: string) {
  const hist: any[] = Array.isArray(v?.history) ? v.history : [];
  // pega o ÚLTIMO evento que levou ao status (mais útil pra auditoria)
  for (let i = hist.length - 1; i >= 0; i--) {
    const e = hist[i];
    if (String(e?.type ?? "") !== "status_change") continue;
    const to = String(e?.to_status ?? e?.to ?? "");
    if (to === toStatus) return String(e?.at ?? "");
  }
  return "";
}

function buildLaudoModelo(v: any, role: string) {
  const protocolo = String(v?.codigo_protocolo ?? "—");
  const area = String(v?.area_nome ?? "—");
  const fase = String(v?.fase ?? "—");
  const local = String(v?.local_texto ?? "—");
  const agendada = String(v?.agendada_para ?? "");
  const realizadaAt = findStatusAt(v, "realizada");

  const c = v?.checklist ?? {};
  const acesso = checklistValueLabel(c?.acesso);
  const iluminacao = checklistValueLabel(c?.iluminacao);
  const limpeza = checklistValueLabel(c?.limpeza);
  const sinalizacao = checklistValueLabel(c?.sinalizacao);
  const risco = checklistValueLabel(c?.risco);
  const obsChecklist = String(c?.observacoes ?? "").trim();

  // Modelo “institucional” + evidências + espaço de análise
  return `PREFEITURA DE BETIM • EDUCAÇÃO AMBIENTAL
PROGRAMA: ADOTE UMA ÁREA PÚBLICA
Base legal (Betim): Lei Municipal nº 6.180/2017 e Decreto nº 40.891/2017
Contato: semmadbetim@betim.mg.gov.br • Telefone: (31) 3512-3032

LAUDO TÉCNICO (MVP) — VISTORIA / PRÉ-ADOÇÃO

1) Identificação
• Protocolo: ${protocolo}
• Área: ${area}
• Fase/Tipo de vistoria: ${fase}
• Local: ${local}
• Agendada para: ${fmt(agendada)}
• Realizada em: ${fmt(realizadaAt)}
• Responsável (SEMAD): ${role}

2) Contexto do programa (resumo)
O programa ADOTE UMA ÁREA PÚBLICA promove cooperação entre a Prefeitura de Betim e a sociedade para qualificar espaços públicos e áreas verdes, por meio de ações de manutenção, implantação, reforma e melhoria urbana/paisagística/ambiental, conforme regras municipais e termo firmado.
A adoção não concede uso exclusivo do espaço: regulamenta responsabilidades, contrapartidas e padrões de execução.

3) Escopo da vistoria
Registrar condições gerais e achados relevantes para subsidiar a análise técnica do processo de adoção, incluindo riscos, conservação e necessidades de adequação.

4) Checklist (campos fixos)
• Acesso: ${acesso}
• Iluminação: ${iluminacao}
• Limpeza: ${limpeza}
• Sinalização: ${sinalizacao}
• Risco: ${risco}

5) Evidências / observações objetivas
${obsChecklist ? obsChecklist : "(Descreva aqui o que foi observado: conservação, mobiliário urbano, vegetação, acessibilidade, iluminação, segurança, entorno, etc.)"}

6) Análise técnica (edição do gestor)
(Complete com sua análise: conformidades, não conformidades, pontos de atenção, impactos e justificativas.)

7) Recomendações / condicionantes
(Edite e detalhe recomendações. Exemplos: adequação de sinalização, manejo de vegetação, ajustes no plano do adotante, cronograma, anexar fotos/metadados, condicionantes para deferimento.)

8) Conclusão
(Definir no campo “Conclusão” acima: Favorável / Com ressalvas / Desfavorável.)
— Fim —
`;
}

const checklistSchema = z.object({
  acesso: z.enum(["ok", "pendente", "nao_ok"]),
  iluminacao: z.enum(["ok", "pendente", "nao_ok"]),
  limpeza: z.enum(["ok", "pendente", "nao_ok"]),
  sinalizacao: z.enum(["ok", "pendente", "nao_ok"]),
  risco: z.enum(["baixo", "medio", "alto"]),
  observacoes: z.string().optional(),
});

type ChecklistForm = z.infer<typeof checklistSchema>;

const laudoSchema = z.object({
  conclusao: z.enum(["favoravel", "desfavoravel", "com_ressalvas"]),
  emitido_em: z.string().min(1, "Informe data/hora de emissão."),
  recomendacoes: z.string().optional(),
});

type LaudoForm = z.infer<typeof laudoSchema>;

export function ManagerVistoriaDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => subscribeVistorias(() => setTick((t) => t + 1)), []);

  const v = useMemo(() => (id ? getVistoriaById(id) : null), [id, tick]);

  const checklistForm = useForm<ChecklistForm>({
    resolver: zodResolver(checklistSchema),
    mode: "onTouched",
    values: v
      ? {
          acesso: v.checklist.acesso,
          iluminacao: v.checklist.iluminacao,
          limpeza: v.checklist.limpeza,
          sinalizacao: v.checklist.sinalizacao,
          risco: v.checklist.risco,
          observacoes: v.checklist.observacoes ?? "",
        }
      : undefined,
  });

  const laudoForm = useForm<LaudoForm>({
    resolver: zodResolver(laudoSchema),
    mode: "onTouched",
    defaultValues: {
      conclusao: "favoravel",
      emitido_em: "",
      recomendacoes: "",
    },
  });

  const [scheduleLocal, setScheduleLocal] = useState<string>("");

  // ✅ NOVO: modal/tela do editor do laudo
  const [openLaudoEditor, setOpenLaudoEditor] = useState(false);

  useEffect(() => {
    setScheduleLocal(toDatetimeLocal(v?.agendada_para));
  }, [v?.agendada_para]);

  if (!v) {
    return (
      <div className="container">
        <div className="card pad">
          <h2 style={{ marginTop: 0 }}>Vistoria não encontrada</h2>
          <button type="button" className="btn" onClick={() => navigate("/gestor/vistorias")}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const STATUS_LABEL: Record<VistoriaStatus, string> = {
    agendada: "Agendada",
    realizada: "Realizada",
    laudo_emitido: "Laudo emitido",
    cancelada: "Cancelada",
  };

  const canMarkRealizada = v.status === "agendada";
  const canCancel = v.status === "agendada";
  const canEmitLaudo = v.status === "realizada";

  const onSaveSchedule = () => {
    try {
      const iso = toIsoFromDatetimeLocal(scheduleLocal);
      if (!iso) throw new Error("Data/hora inválida.");
      updateVistoriaSchedule(v.id, iso, role ?? "unknown");
      alert("Agendamento atualizado.");
    } catch (e: any) {
      alert(e?.message ?? "Falha ao atualizar agendamento.");
    }
  };

  const onSaveChecklist = checklistForm.handleSubmit((values) => {
    try {
      updateVistoriaChecklist(
        v.id,
        {
          acesso: values.acesso,
          iluminacao: values.iluminacao,
          limpeza: values.limpeza,
          sinalizacao: values.sinalizacao,
          risco: values.risco,
          observacoes: values.observacoes ? String(values.observacoes) : "",
        },
        role ?? "unknown"
      );
      alert("Checklist atualizado.");
    } catch (e: any) {
      alert(e?.message ?? "Falha ao atualizar checklist.");
    }
  });

  const doStatus = (to: VistoriaStatus) => {
    try {
      const note =
        to === "cancelada"
          ? window.prompt("Motivo do cancelamento (opcional):", "") ?? undefined
          : undefined;

      updateVistoriaStatus(v.id, to, role ?? "unknown", note);
    } catch (e: any) {
      alert(e?.message ?? "Falha ao mudar status.");
    }
  };

  const openEmitLaudoEditor = () => {
    if (!canEmitLaudo) {
      alert("Para emitir laudo, a vistoria deve estar realizada.");
      return;
    }

    // preenche emitido_em (se vazio)
    const curEmit = String(laudoForm.getValues("emitido_em") ?? "").trim();
    if (!curEmit) laudoForm.setValue("emitido_em", nowDatetimeLocal(), { shouldDirty: true });

    // preenche recomendacoes com modelo (se vazio)
    const curTxt = String(laudoForm.getValues("recomendacoes") ?? "").trim();
    if (!curTxt) {
      laudoForm.setValue("recomendacoes", buildLaudoModelo(v, role ?? "unknown"), { shouldDirty: true });
    }

    setOpenLaudoEditor(true);
  };

  const onEmitLaudo = laudoForm.handleSubmit((values) => {
    try {
      const iso = toIsoFromDatetimeLocal(values.emitido_em);
      if (!iso) throw new Error("Data/hora inválida.");

      emitVistoriaLaudo(
        v.id,
        {
          conclusao: values.conclusao,
          emitido_em: iso,
          // ✅ aqui vai o “laudo em texto” (modelo editado) gravado como já acontece hoje
          recomendacoes: values.recomendacoes ? String(values.recomendacoes) : "",
        },
        role ?? "unknown"
      );

      setOpenLaudoEditor(false);
      alert("Laudo emitido.");
    } catch (e: any) {
      alert(e?.message ?? "Falha ao emitir laudo.");
    }
  });

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Detalhe da vistoria</h1>
            <p className="page__subtitle">
              {v.codigo_protocolo ?? "—"} · {v.area_nome ?? "—"} · <strong>{STATUS_LABEL[v.status]}</strong>
            </p>
          </div>

          <div className="page__actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--subtle" to={`/gestor/vistorias?proposal_id=${encodeURIComponent(v.proposal_id)}`}>
              Voltar à lista
            </Link>
            {v.proposal_id ? (
              <Link className="btn btn--subtle" to={`/gestor/propostas/${encodeURIComponent(v.proposal_id)}`}>
                Ver proposta
              </Link>
            ) : null}
          </div>
        </header>

        <section className="card pad">
          <div className="grid cols-1">
            <div>
              <div>
                <strong>Fase:</strong> {v.fase}
              </div>
              <div>
                <strong>Local:</strong> {v.local_texto}
              </div>
            </div>
            <div>
              <div>
                <strong>Criada em:</strong> {fmt(v.created_at)}
              </div>
              <div>
                <strong>Atualizada em:</strong> {fmt(v.updated_at)}
              </div>
            </div>
          </div>
        </section>

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Agendamento</h3>

          <div className="grid cols-2" style={{ alignItems: "end" }}>
            <label style={{ fontWeight: 800 }}>
              Agendada para
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                disabled={v.status !== "agendada"}
                style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}
              />
              {v.status !== "agendada" ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  Agendamento só pode ser alterado enquanto status = <strong>agendada</strong>.
                </div>
              ) : null}
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={onSaveSchedule} disabled={v.status !== "agendada"}>
                Salvar agendamento
              </button>
            </div>
          </div>
        </section>

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Status (transições)</h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={!canMarkRealizada} onClick={() => doStatus("realizada")}>
              Marcar como realizada
            </button>
            <button type="button" className="btn btn--subtle" disabled={!canCancel} onClick={() => doStatus("cancelada")}>
              Cancelar
            </button>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            Regras: <code>agendada → realizada → laudo_emitido</code> (ou <code>agendada → cancelada</code>)
          </div>
        </section>

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Checklist (campos fixos)</h3>

          <form onSubmit={onSaveChecklist} style={{ display: "grid", gap: 12 }}>
            <div className="grid cols-3" style={{ gap: 12 }}>
              {(["acesso", "iluminacao", "limpeza", "sinalizacao"] as const).map((k) => (
                <label key={k} style={{ fontWeight: 800 }}>
                  {k}
                  <select {...checklistForm.register(k)} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="ok">OK</option>
                    <option value="pendente">Pendente</option>
                    <option value="nao_ok">Não OK</option>
                  </select>
                  {checklistForm.formState.errors[k] ? (
                    <div style={{ color: "crimson" }}>{String(checklistForm.formState.errors[k]?.message)}</div>
                  ) : null}
                </label>
              ))}

              <label style={{ fontWeight: 800 }}>
                risco
                <select {...checklistForm.register("risco")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                </select>
              </label>
            </div>

            <label style={{ fontWeight: 800 }}>
              Observações do checklist
              <textarea {...checklistForm.register("observacoes")} rows={4} style={{ width: "100%", marginTop: 6 }} />
            </label>

            <div>
              <button type="submit" className="btn">
                Salvar checklist
              </button>
            </div>
          </form>
        </section>

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Anexos (metadados)</h3>

          <div className="grid cols-2" style={{ gap: 12 }}>
            <label style={{ fontWeight: 800 }}>
              Adicionar fotos
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  try {
                    addVistoriaAnexos(v.id, files, "foto", role ?? "unknown");
                    e.target.value = "";
                  } catch (err: any) {
                    alert(err?.message ?? "Falha ao adicionar fotos.");
                  }
                }}
              />
            </label>

            <label style={{ fontWeight: 800 }}>
              Adicionar arquivos
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  try {
                    addVistoriaAnexos(v.id, files, "arquivo", role ?? "unknown");
                    e.target.value = "";
                  } catch (err: any) {
                    alert(err?.message ?? "Falha ao adicionar arquivos.");
                  }
                }}
              />
            </label>
          </div>

          {v.anexos?.length ? (
            <ul style={{ margin: "10px 0 0 18px" }}>
              {v.anexos.map((a, i) => (
                <li key={`${a.file_name}-${i}`}>
                  <strong>{a.tipo}</strong>: {a.file_name} ({Math.round((a.file_size ?? 0) / 1024)} KB)
                  <div className="muted">{a.mime_type}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted" style={{ marginTop: 10 }}>
              Nenhum anexo.
            </div>
          )}
        </section>

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Laudo (estruturado)</h3>

          {v.laudo ? (
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{v.laudo.conclusao}</strong>
                <span className="muted">Emitido em: {fmt(v.laudo.emitido_em)}</span>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Responsável: {v.laudo.responsavel_role}
              </div>
              {v.laudo.recomendacoes ? (
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{v.laudo.recomendacoes}</div>
              ) : (
                <div className="muted" style={{ marginTop: 10 }}>
                  (Sem texto de laudo.)
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="muted" style={{ marginBottom: 10 }}>
                Para emitir laudo, a vistoria deve estar <strong>realizada</strong>.
                <br />
                Ao emitir, o sistema salva o texto do laudo em <strong>Recomendações</strong> (modelo editável) e ele passa a
                aparecer aqui.
              </div>

              {/* ✅ agora o clique abre a “tela” (modal) do laudo */}
              <button type="button" className="btn btn--primary" disabled={!canEmitLaudo} onClick={openEmitLaudoEditor}>
                Emitir laudo (abrir editor)
              </button>
            </>
          )}
        </section>

        {/* ✅ MODAL/TELA DO LAUDO (pré-preenchida e editável) */}
        {openLaudoEditor ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 999,
            }}
            onMouseDown={(e) => {
              // clique fora fecha
              if (e.target === e.currentTarget) setOpenLaudoEditor(false);
            }}
          >
            <div
              className="card pad"
              style={{
                width: "min(980px, 100%)",
                maxHeight: "90vh",
                overflow: "auto",
                background: "rgba(255,255,255,.98)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ marginTop: 0 }}>Editor do laudo</h3>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Modelo pré-preenchido com dados da vistoria + conteúdo institucional do programa. Edite e depois{" "}
                    <strong>Salvar e emitir</strong>.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn" onClick={() => setOpenLaudoEditor(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn--primary" onClick={onEmitLaudo}>
                    Salvar e emitir
                  </button>
                </div>
              </div>

              <hr className="hr" />

              <div className="grid cols-2" style={{ alignItems: "end" }}>
                <label style={{ fontWeight: 800 }}>
                  Conclusão
                  <select {...laudoForm.register("conclusao")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="favoravel">Favorável</option>
                    <option value="com_ressalvas">Com ressalvas</option>
                    <option value="desfavoravel">Desfavorável</option>
                  </select>
                </label>

                <label style={{ fontWeight: 800 }}>
                  Emitido em (data/hora)
                  <input
                    type="datetime-local"
                    {...laudoForm.register("emitido_em")}
                    style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)" }}
                  />
                  {laudoForm.formState.errors.emitido_em ? (
                    <div style={{ color: "crimson" }}>{laudoForm.formState.errors.emitido_em.message}</div>
                  ) : null}
                </label>
              </div>

              <label style={{ fontWeight: 800, display: "block", marginTop: 12 }}>
                Laudo (texto editável — será gravado em “Recomendações”)
                <textarea
                  {...laudoForm.register("recomendacoes")}
                  rows={18}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    whiteSpace: "pre-wrap",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={() => laudoForm.setValue("recomendacoes", buildLaudoModelo(v, role ?? "unknown"), { shouldDirty: true })}
                >
                  Reaplicar modelo
                </button>

                <div className="muted" style={{ alignSelf: "center" }}>
                  Dica: use “Anexos” para registrar fotos/arquivos como evidência (MVP guarda metadados).
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Histórico</h3>
          {v.history?.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {v.history.map((e) => (
                <li key={e.id}>
                  <strong>{fmt(e.at)}</strong> — <strong>{e.actor_role}</strong> — {e.type}
                  {e.from_status || e.to_status ? ` (${e.from_status ?? "—"} → ${e.to_status ?? "—"})` : ""}
                  {e.note ? ` — ${e.note}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">Sem eventos ainda.</div>
          )}
        </section>
      </div>
    </div>
  );
}