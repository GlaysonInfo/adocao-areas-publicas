import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { AreaRequest, AreaRequestDocumentoMeta, AreaRequestDocumentoTipo } from "../domain/area_request";
import { createAreaRequest } from "../storage/area_requests";
import { next_protocol } from "../storage/protocol";
import { useAuth } from "../auth/AuthContext";

function nowIso() {
  return new Date().toISOString();
}

function safeUuid(): string {
  // @ts-ignore
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `mvp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const schema = z.object({
  lote: z.string().optional(),
  quadra: z.string().optional(),
  localizacao_descritiva: z.string().min(8, "Informe uma localização descritiva (mín. 8 caracteres)."),
  descricao_intervencao: z.string().min(10, "Descreva a intervenção pretendida (mín. 10 caracteres)."),
  carta_intencao: z.any(),
  projeto_resumo: z.any(),
  fotos_referencia: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

function fileMeta(tipo: AreaRequestDocumentoTipo, list: FileList): AreaRequestDocumentoMeta {
  const f = list.item(0)!;
  return {
    tipo,
    file_name: f.name,
    file_size: f.size,
    mime_type: f.type || "application/octet-stream",
    last_modified: f.lastModified,
  };
}

function fileMetas(tipo: AreaRequestDocumentoTipo, list: FileList): AreaRequestDocumentoMeta[] {
  const out: AreaRequestDocumentoMeta[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list.item(i);
    if (!f) continue;
    out.push({
      tipo,
      file_name: f.name,
      file_size: f.size,
      mime_type: f.type || "application/octet-stream",
      last_modified: f.lastModified,
    });
  }
  return out;
}

export function AreaRequestNewPage() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy_m?: number; captured_at: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const actor_role = useMemo(() => role ?? "adotante_pf", [role]);

  const captureGeo = () => {
    setGeoMsg(null);
    if (!navigator.geolocation) {
      setGeoMsg("Geolocalização não suportada neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          captured_at: nowIso(),
        });
      },
      (err) => setGeoMsg(`Falha ao capturar coordenadas: ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const onSubmit = (values: FormValues) => {
    const carta = values.carta_intencao as FileList;
    const projeto = values.projeto_resumo as FileList;

    if (!carta?.length) return alert("Anexe a Carta de Intenção.");
    if (!projeto?.length) return alert("Anexe o Projeto Resumo.");

    const docs: AreaRequestDocumentoMeta[] = [
      fileMeta("carta_intencao", carta),
      fileMeta("projeto_resumo", projeto),
    ];

    const fotos = values.fotos_referencia as FileList | undefined;
    if (fotos?.length) docs.push(...fileMetas("foto_referencia", fotos));

    const req: AreaRequest = {
      id: safeUuid(),
      codigo_protocolo: next_protocol(),
      status: "solicitada",
      owner_role: actor_role,
      lote: values.lote?.trim() || undefined,
      quadra: values.quadra?.trim() || undefined,
      localizacao_descritiva: values.localizacao_descritiva.trim(),
      geo: geo ?? undefined,
      descricao_intervencao: values.descricao_intervencao.trim(),
      documentos: docs,
      created_at: nowIso(),
      updated_at: nowIso(),
      history: [],
    };

    try {
      createAreaRequest(req, actor_role);
      navigate("/minhas-solicitacoes-area", { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Erro ao criar solicitação.");
    }
  };

  return (
    <div className="container">
      <div className="page">
        <header className="page__header">
          <div className="page__titlewrap">
            <h1 className="page__title">Solicitar cadastro de área para adoção</h1>
            <p className="page__subtitle">Use quando a área ainda não está cadastrada no sistema.</p>
          </div>
        </header>

        <div className="card pad">
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 12, maxWidth: 820 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label>
                Lote (opcional)
                <input className="input" {...register("lote")} />
              </label>
              <label>
                Quadra (opcional)
                <input className="input" {...register("quadra")} />
              </label>
            </div>

            <label>
              Localização descritiva (rua, referência, próximo ao nº etc.)
              <textarea className="input" rows={3} {...register("localizacao_descritiva")} />
              {errors.localizacao_descritiva?.message ? <div className="err">{String(errors.localizacao_descritiva.message)}</div> : null}
            </label>

            <div className="card pad" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>Coordenadas (opcional)</strong>
                <button type="button" className="btn btn--subtle" onClick={captureGeo}>
                  Capturar coordenadas
                </button>
                {geoMsg ? <span className="muted">{geoMsg}</span> : null}
              </div>
              {geo ? (
                <div className="muted">
                  lat={geo.lat} | lng={geo.lng} | acurácia≈{geo.accuracy_m ?? "—"}m | {geo.captured_at}
                </div>
              ) : (
                <div className="muted">Sem coordenadas capturadas.</div>
              )}
            </div>

            <label>
              Descrição da intervenção pretendida (projeto básico)
              <textarea className="input" rows={4} {...register("descricao_intervencao")} />
              {errors.descricao_intervencao?.message ? <div className="err">{String(errors.descricao_intervencao.message)}</div> : null}
            </label>

            <div style={{ display: "grid", gap: 10 }}>
              <label>
                Carta de Intenção (obrigatório)
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" {...register("carta_intencao")} />
              </label>
              <label>
                Projeto Resumo (obrigatório)
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" {...register("projeto_resumo")} />
              </label>
              <label>
                Fotos de referência (opcional, múltiplas)
                <input type="file" multiple accept=".png,.jpg,.jpeg" {...register("fotos_referencia")} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn--primary" type="submit">
                Protocolar solicitação
              </button>
              <button className="btn" type="button" onClick={() => navigate("/areas")}>
                Voltar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}