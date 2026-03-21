// src/pages/ManagerVistoriaDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useAuth } from "../auth/AuthContext";
import type { VistoriaStatus } from "../domain/vistoria";
import { vistoriasService } from "../services/vistorias.service";

function fmt(iso?: string) {
  if (!iso) return "â€”";
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
  if (s === "nao_ok") return "NÃ£o OK";
  if (s === "baixo") return "Baixo";
  if (s === "medio") return "MÃ©dio";
  if (s === "alto") return "Alto";
  return s || "â€”";
}

function findStatusAt(v: any, toStatus: string) {
  const hist: any[] = Array.isArray(v?.history) ? v.history : [];
  // pega o ÃšLTIMO evento que levou ao status (mais Ãºtil pra auditoria)
  for (let i = hist.length - 1; i >= 0; i--) {
    const e = hist[i];
    if (String(e?.type ?? "") !== "status_change") continue;
    const to = String(e?.to_status ?? e?.to ?? "");
    if (to === toStatus) return String(e?.at ?? "");
  }
  return "";
}

function buildLaudoModelo(v: any, role: string) {
  const protocolo = String(v?.codigo_protocolo ?? "â€”");
  const area = String(v?.area_nome ?? "â€”");
  const fase = String(v?.fase ?? "â€”");
  const local = String(v?.local_texto ?? "â€”");
  const agendada = String(v?.agendada_para ?? "");
  const realizadaAt = findStatusAt(v, "realizada");

  const c = v?.checklist ?? {};
  const acesso = checklistValueLabel(c?.acesso);
  const iluminacao = checklistValueLabel(c?.iluminacao);
  const limpeza = checklistValueLabel(c?.limpeza);
  const sinalizacao = checklistValueLabel(c?.sinalizacao);
  const risco = checklistValueLabel(c?.risco);
  const obsChecklist = String(c?.observacoes ?? "").trim();

  // Modelo â€œinstitucionalâ€ + evidÃªncias + espaÃ§o de anÃ¡lise
  return `PREFEITURA DE BETIM â€¢ EDUCAÃ‡ÃƒO AMBIENTAL
PROGRAMA: ADOTE UMA ÃREA PÃšBLICA
Base legal (Betim): Lei Municipal nÂº 6.180/2017 e Decreto nÂº 40.891/2017
Contato: semmadbetim@betim.mg.gov.br â€¢ Telefone: (31) 3512-3032

LAUDO TÃ‰CNICO (MVP) â€” VISTORIA / PRÃ‰-ADOÃ‡ÃƒO

1) IdentificaÃ§Ã£o
â€¢ Protocolo: ${protocolo}
â€¢ Ãrea: ${area}
â€¢ Fase/Tipo de vistoria: ${fase}
â€¢ Local: ${local}
â€¢ Agendada para: ${fmt(agendada)}
â€¢ Realizada em: ${fmt(realizadaAt)}
â€¢ ResponsÃ¡vel (SEMAD): ${role}

2) Contexto do programa (resumo)
O programa ADOTE UMA ÃREA PÃšBLICA promove cooperaÃ§Ã£o entre a Prefeitura de Betim e a sociedade para qualificar espaÃ§os pÃºblicos e Ã¡reas verdes, por meio de aÃ§Ãµes de manutenÃ§Ã£o, implantaÃ§Ã£o, reforma e melhoria urbana/paisagÃ­stica/ambiental, conforme regras municipais e termo firmado.
A adoÃ§Ã£o nÃ£o concede uso exclusivo do espaÃ§o: regulamenta responsabilidades, contrapartidas e padrÃµes de execuÃ§Ã£o.

3) Escopo da vistoria
Registrar condiÃ§Ãµes gerais e achados relevantes para subsidiar a anÃ¡lise tÃ©cnica do processo de adoÃ§Ã£o, incluindo riscos, conservaÃ§Ã£o e necessidades de adequaÃ§Ã£o.

4) Checklist (campos fixos)
â€¢ Acesso: ${acesso}
â€¢ IluminaÃ§Ã£o: ${iluminacao}
â€¢ Limpeza: ${limpeza}
â€¢ SinalizaÃ§Ã£o: ${sinalizacao}
â€¢ Risco: ${risco}

5) EvidÃªncias / observaÃ§Ãµes objetivas
${obsChecklist ? obsChecklist : "(Descreva aqui o que foi observado: conservaÃ§Ã£o, mobiliÃ¡rio urbano, vegetaÃ§Ã£o, acessibilidade, iluminaÃ§Ã£o, seguranÃ§a, entorno, etc.)"}

6) AnÃ¡lise tÃ©cnica (ediÃ§Ã£o do gestor)
(Complete com sua anÃ¡lise: conformidades, nÃ£o conformidades, pontos de atenÃ§Ã£o, impactos e justificativas.)

7) RecomendaÃ§Ãµes / condicionantes
(Edite e detalhe recomendaÃ§Ãµes. Exemplos: adequaÃ§Ã£o de sinalizaÃ§Ã£o, manejo de vegetaÃ§Ã£o, ajustes no plano do adotante, cronograma, anexar fotos/metadados, condicionantes para deferimento.)

8) ConclusÃ£o
(Definir no campo â€œConclusÃ£oâ€ acima: FavorÃ¡vel / Com ressalvas / DesfavorÃ¡vel.)
â€” Fim â€”
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
  emitido_em: z.string().min(1, "Informe data/hora de emissÃ£o."),
  recomendacoes: z.string().optional(),
});

type LaudoForm = z.infer<typeof laudoSchema>;

export function ManagerVistoriaDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  useEffect(() => vistoriasService.subscribe(() => setTick((t) => t + 1)), []);

  const v = useMemo(() => (id ? vistoriasService.getById(id) : null), [id, tick]);

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

  // âœ… NOVO: modal/tela do editor do laudo
  const [openLaudoEditor, setOpenLaudoEditor] = useState(false);

  useEffect(() => {
    setScheduleLocal(toDatetimeLocal(v?.agendada_para));
  }, [v?.agendada_para]);

  if (!v) {
    return (
      <div className="container">
        <div className="card pad">
          <h2 style={{ marginTop: 0 }}>Vistoria nÃ£o encontrada</h2>
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
      if (!iso) throw new Error("Data/hora invÃ¡lida.");
      vistoriasService.updateSchedule(v.id, iso, role ?? "unknown");
      alert("Agendamento atualizado.");
    } catch (e: any) {
      alert(e?.message ?? "Falha ao atualizar agendamento.");
    }
  };

  const onSaveChecklist = checklistForm.handleSubmit((values) => {
    try {
      vistoriasService.updateChecklist(
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

      vistoriasService.updateStatus(v.id, to, role ?? "unknown", note);
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
      if (!iso) throw new Error("Data/hora invÃ¡lida.");

      vistoriasService.emitLaudo(
        v.id,
        {
          conclusao: values.conclusao,
          emitido_em: iso,
          // âœ… aqui vai o â€œlaudo em textoâ€ (modelo editado) gravado como jÃ¡ acontece hoje
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
              {v.codigo_protocolo ?? "â€”"} Â· {v.area_nome ?? "â€”"} Â· <strong>{STATUS_LABEL[v.status]}</strong>
            </p>
          </div>

          <div className="page__actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn--subtle" to={`/gestor/vistorias?proposal_id=${encodeURIComponent(v.proposal_id)}`}>
              Voltar Ã  lista
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
                  Agendamento sÃ³ pode ser alterado enquanto status = <strong>agendada</strong>.
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
          <h3 style={{ marginTop: 0 }}>Status (transiÃ§Ãµes)</h3>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={!canMarkRealizada} onClick={() => doStatus("realizada")}>
              Marcar como realizada
            </button>
            <button type="button" className="btn btn--subtle" disabled={!canCancel} onClick={() => doStatus("cancelada")}>
              Cancelar
            </button>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            Regras: <code>agendada â†’ realizada â†’ laudo_emitido</code> (ou <code>agendada â†’ cancelada</code>)
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
                    <option value="nao_ok">NÃ£o OK</option>
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
                  <option value="medio">MÃ©dio</option>
                  <option value="alto">Alto</option>
                </select>
              </label>
            </div>

            <label style={{ fontWeight: 800 }}>
              ObservaÃ§Ãµes do checklist
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
                    vistoriasService.addAnexos(v.id, files, "foto", role ?? "unknown");
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
                    vistoriasService.addAnexos(v.id, files, "arquivo", role ?? "unknown");
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
                ResponsÃ¡vel: {v.laudo.responsavel_role}
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
                Ao emitir, o sistema salva o texto do laudo em <strong>RecomendaÃ§Ãµes</strong> (modelo editÃ¡vel) e ele passa a
                aparecer aqui.
              </div>

              {/* âœ… agora o clique abre a â€œtelaâ€ (modal) do laudo */}
              <button type="button" className="btn btn--primary" disabled={!canEmitLaudo} onClick={openEmitLaudoEditor}>
                Emitir laudo (abrir editor)
              </button>
            </>
          )}
        </section>

        {/* âœ… MODAL/TELA DO LAUDO (prÃ©-preenchida e editÃ¡vel) */}
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
                    Modelo prÃ©-preenchido com dados da vistoria + conteÃºdo institucional do programa. Edite e depois{" "}
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
                  ConclusÃ£o
                  <select {...laudoForm.register("conclusao")} style={{ width: "100%", marginTop: 6, padding: 10 }}>
                    <option value="favoravel">FavorÃ¡vel</option>
                    <option value="com_ressalvas">Com ressalvas</option>
                    <option value="desfavoravel">DesfavorÃ¡vel</option>
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
                Laudo (texto editÃ¡vel â€” serÃ¡ gravado em â€œRecomendaÃ§Ãµesâ€)
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
                  Dica: use â€œAnexosâ€ para registrar fotos/arquivos como evidÃªncia (MVP guarda metadados).
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="card pad" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>HistÃ³rico</h3>
          {v.history?.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {v.history.map((e) => (
                <li key={e.id}>
                  <strong>{fmt(e.at)}</strong> â€” <strong>{e.actor_role}</strong> â€” {e.type}
                  {e.from_status || e.to_status ? ` (${e.from_status ?? "â€”"} â†’ ${e.to_status ?? "â€”"})` : ""}
                  {e.note ? ` â€” ${e.note}` : ""}
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

