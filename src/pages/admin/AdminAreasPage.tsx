// src/pages/admin/AdminAreasPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AreaPublica, AreaStatus, AreaArquivoMeta } from "../../domain/area";
import {
  createArea,
  listAreas,
  setAreaActive,
  setAreaGeoFile,
  upsertArea,
  clearAreasForImportTesting,
} from "../../storage/areas";

const STATUS_LABEL: Record<AreaStatus, string> = {
  disponivel: "Disponível",
  em_adocao: "Em adoção",
  adotada: "Adotada",
};

type Draft = {
  id?: string;
  codigo: string;
  nome: string;
  tipo: string;
  bairro: string;
  logradouro: string;
  metragem_m2: number;
  status: AreaStatus;
  ativo: boolean;
  restricoes?: string;
  latitude_centro?: number;
  longitude_centro?: number;
  geoFileList?: FileList | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,.92)",
};

function fileMeta(list: FileList): AreaArquivoMeta {
  const f = list.item(0)!;
  return {
    file_name: f.name,
    file_size: f.size,
    mime_type: f.type || "application/octet-stream",
    last_modified: f.lastModified,
  };
}

function newDraft(): Draft {
  return {
    codigo: "",
    nome: "",
    tipo: "Praça",
    bairro: "",
    logradouro: "",
    metragem_m2: 0,
    status: "disponivel",
    ativo: true,
    restricoes: "",
    latitude_centro: undefined,
    longitude_centro: undefined,
    geoFileList: null,
  };
}

export function AdminAreasPage() {
  const [tick, setTick] = useState(0);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | AreaStatus>("");
  const [onlyActive, setOnlyActive] = useState<"all" | "active" | "inactive">("all");

  const [editing, setEditing] = useState<Draft | null>(null);

  const items = useMemo(() => listAreas(), [tick]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items
      .filter((a) => {
        if (status && a.status !== status) return false;
        if (onlyActive === "active" && !a.ativo) return false;
        if (onlyActive === "inactive" && a.ativo) return false;
        if (!query) return true;
        return (
          a.nome.toLowerCase().includes(query) ||
          a.codigo.toLowerCase().includes(query) ||
          a.bairro.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [items, q, status, onlyActive]);

  const openNew = () => setEditing(newDraft());

  const openEdit = (a: AreaPublica) =>
    setEditing({
      id: a.id,
      codigo: a.codigo,
      nome: a.nome,
      tipo: a.tipo,
      bairro: a.bairro,
      logradouro: a.logradouro,
      metragem_m2: a.metragem_m2,
      status: a.status,
      ativo: a.ativo,
      restricoes: a.restricoes ?? "",
      latitude_centro: a.latitude_centro,
      longitude_centro: a.longitude_centro,
      geoFileList: null,
    });

  const save = () => {
    if (!editing) return;

    const codigo = editing.codigo.trim();
    const nome = editing.nome.trim();

    if (!codigo || !nome) {
      alert("Informe pelo menos Código e Nome.");
      return;
    }
    if (!Number.isFinite(editing.metragem_m2) || editing.metragem_m2 <= 0) {
      alert("Metragem (m²) deve ser maior que 0.");
      return;
    }

    const payloadBase = {
      codigo,
      nome,
      tipo: editing.tipo.trim() || "—",
      bairro: editing.bairro.trim() || "—",
      logradouro: editing.logradouro.trim() || "—",
      metragem_m2: Number(editing.metragem_m2),
      status: editing.status,
      ativo: editing.ativo,
      restricoes: editing.restricoes?.trim() || undefined,
      latitude_centro: editing.latitude_centro,
      longitude_centro: editing.longitude_centro,
    };

    // evita duplicidade de código em criação
    if (!editing.id) {
      const already = items.some((a) => a.codigo === codigo);
      if (already) {
        alert(`Já existe uma área com o código "${codigo}". Use "Editar" para atualizar.`);
        return;
      }
    }

    let areaId: string | null = null;

    if (editing.id) {
      const current = items.find((x) => x.id === editing.id);
      if (!current) return;

      upsertArea({
        ...current,
        ...payloadBase,
      });

      areaId = editing.id;
    } else {
      const created = createArea({
        ...payloadBase,
        geo_arquivo: undefined,
        created_at: "", // ignorado pelo storage (ele seta)
        updated_at: "", // ignorado pelo storage (ele seta)
      } as any);

      areaId = created.id;
    }

    // KML/KMZ opcional (guardamos só metadados no MVP)
    if (areaId && editing.geoFileList && editing.geoFileList.length > 0) {
      setAreaGeoFile(areaId, fileMeta(editing.geoFileList));
    }

    setEditing(null);
    setTick((t) => t + 1);
  };

  return (
    <div className="container">
      <div className="card pad">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Admin · Áreas</h2>
            <p style={{ marginTop: 6 }}>
              Cadastro oficial de áreas do programa (criar/editar/ativar/inativar) e controle de status.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
  <Link to="/admin/areas/importar" className="btn">
    Importar CSV
  </Link>

    <button
      type="button"
      className="btn"
      onClick={() => {
      const ok = window.confirm(
        "Isso vai zerar o cadastro de Áreas e desativar o seed do mock. Continuar?"
      );
      if (!ok) return;
      clearAreasForImportTesting();
      setTick((t) => t + 1); // força recarregar a lista na tela
     }}
     >
     Zerar áreas (teste CSV)
    </button>

      <button type="button" className="btn btn--primary" onClick={openNew}>
      Nova área
      </button>
    </div>

        </div>

        <hr className="hr" />

        <div className="grid cols-3" style={{ alignItems: "end" }}>
          <div>
            <label style={{ fontWeight: 700 }}>
              Busca
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, código ou bairro..."
                style={inputStyle}
              />
            </label>
          </div>

          <div>
            <label style={{ fontWeight: 700 }}>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
                <option value="">Todos</option>
                <option value="disponivel">Disponível</option>
                <option value="em_adocao">Em adoção</option>
                <option value="adotada">Adotada</option>
              </select>
            </label>
          </div>

          <div>
            <label style={{ fontWeight: 700 }}>
              Ativação
              <select value={onlyActive} onChange={(e) => setOnlyActive(e.target.value as any)} style={inputStyle}>
                <option value="all">Todas</option>
                <option value="active">Somente ativas</option>
                <option value="inactive">Somente inativas</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 14, opacity: 0.85 }}>
          Total: <strong>{filtered.length}</strong>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {filtered.length === 0 ? (
            <div className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
              <h3 style={{ marginTop: 0 }}>Nenhuma área encontrada</h3>
              <p>Tente ajustar os filtros.</p>
            </div>
          ) : (
            filtered.map((a) => (
              <div key={a.id} className="card pad" style={{ background: "rgba(255,255,255,.72)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {a.nome}{" "}
                      <span style={{ fontWeight: 700, opacity: 0.75 }}>
                        ({a.codigo})
                      </span>
                    </div>

                    <div style={{ opacity: 0.88, marginTop: 6 }}>
                      <strong>Tipo:</strong> {a.tipo}
                      <br />
                      <strong>Bairro:</strong> {a.bairro} · <strong>Metragem:</strong> {a.metragem_m2} m²
                    </div>

                    <div style={{ opacity: 0.88, marginTop: 6 }}>
                      <strong>Status:</strong> {STATUS_LABEL[a.status]} · <strong>Ativo:</strong> {a.ativo ? "Sim" : "Não"}
                    </div>

                    {a.logradouro ? (
                      <div style={{ opacity: 0.88, marginTop: 6 }}>
                        <strong>Logradouro:</strong> {a.logradouro}
                      </div>
                    ) : null}

                    {a.restricoes ? (
                      <div style={{ opacity: 0.88, marginTop: 6 }}>
                        <strong>Restrições:</strong> {a.restricoes}
                      </div>
                    ) : null}

                    {a.latitude_centro != null && a.longitude_centro != null ? (
                      <div style={{ opacity: 0.88, marginTop: 6 }}>
                        <strong>Centro:</strong> {a.latitude_centro}, {a.longitude_centro}
                      </div>
                    ) : null}

                    {a.geo_arquivo ? (
                      <div style={{ opacity: 0.88, marginTop: 6 }}>
                        <strong>Arquivo geo:</strong> {a.geo_arquivo.file_name} (
                        {Math.max(1, Math.round(a.geo_arquivo.file_size / 1024))} KB)
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" className="btn" onClick={() => openEdit(a)}>
                      Editar
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setAreaActive(a.id, !a.ativo);
                        setTick((t) => t + 1);
                      }}
                    >
                      {a.ativo ? "Inativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor (abaixo da lista) */}
      {editing ? (
        <div style={{ marginTop: 14 }}>
          <div className="card pad">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ marginTop: 0 }}>{editing.id ? "Editar área" : "Nova área"}</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn btn--primary" onClick={save}>
                  Salvar
                </button>
                <button type="button" className="btn" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </div>
            </div>

            <div className="grid cols-2" style={{ marginTop: 10 }}>
              <label style={{ fontWeight: 700 }}>
                Código (único)
                <input
                  value={editing.codigo}
                  onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Nome
                <input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Tipo
                <input
                  value={editing.tipo}
                  onChange={(e) => setEditing({ ...editing, tipo: e.target.value })}
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Bairro
                <input
                  value={editing.bairro}
                  onChange={(e) => setEditing({ ...editing, bairro: e.target.value })}
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Logradouro
                <input
                  value={editing.logradouro}
                  onChange={(e) => setEditing({ ...editing, logradouro: e.target.value })}
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Metragem (m²)
                <input
                  type="number"
                  value={editing.metragem_m2}
                  onChange={(e) => setEditing({ ...editing, metragem_m2: Number(e.target.value) })}
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Status
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as AreaStatus })}
                  style={inputStyle}
                >
                  <option value="disponivel">Disponível</option>
                  <option value="em_adocao">Em adoção</option>
                  <option value="adotada">Adotada</option>
                </select>
              </label>

              <label style={{ fontWeight: 700 }}>
                Ativo
                <select
                  value={editing.ativo ? "1" : "0"}
                  onChange={(e) => setEditing({ ...editing, ativo: e.target.value === "1" })}
                  style={inputStyle}
                >
                  <option value="1">Sim</option>
                  <option value="0">Não</option>
                </select>
              </label>

              <label style={{ fontWeight: 700 }}>
                Latitude (opcional)
                <input
                  type="number"
                  value={editing.latitude_centro ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      latitude_centro: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 700 }}>
                Longitude (opcional)
                <input
                  type="number"
                  value={editing.longitude_centro ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      longitude_centro: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ fontWeight: 700, display: "block", marginTop: 12 }}>
              Restrições (opcional)
              <textarea
                value={editing.restricoes ?? ""}
                onChange={(e) => setEditing({ ...editing, restricoes: e.target.value })}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            <label style={{ fontWeight: 700, display: "block", marginTop: 12 }}>
              Arquivo KML/KMZ (opcional — guardamos só metadados no MVP)
              <input
                type="file"
                accept=".kml,.kmz"
                onChange={(e) => setEditing({ ...editing, geoFileList: e.target.files })}
                style={{ display: "block", marginTop: 8 }}
              />
            </label>

            <div style={{ marginTop: 12, opacity: 0.8 }}>
              Dica: para remover o arquivo geo no MVP, edite a área e reimporte sem arquivo (ou implemente “Remover” depois).
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}