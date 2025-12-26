import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Role } from "../auth/AuthContext";
import { isManagerRole, useAuth } from "../auth/AuthContext";
import type { AdotanteRole } from "../domain/adopter";
import { getAdopterProfile, upsertAdopterProfile } from "../storage/adopters";

type RoleOption = Exclude<Role, null>;

function isAdopterRole(role: RoleOption): role is AdotanteRole {
  return role === "adotante_pf" || role === "adotante_pj";
}

function goHomeByRole(navigate: ReturnType<typeof useNavigate>, r: RoleOption) {
  navigate(isManagerRole(r) ? "/gestor/kanban" : "/areas", { replace: true });
}

export function LoginPage() {
  const navigate = useNavigate();
  const { role, setRole, logout } = useAuth();

  const options = useMemo<{ value: RoleOption; label: string }[]>(
    () => [
      { value: "adotante_pf", label: "Adotante (PF)" },
      { value: "adotante_pj", label: "Adotante (PJ)" },
      { value: "gestor_semad", label: "Gestor SEMAD" },
      { value: "gestor_ecos", label: "Gestor ECOS" },
      { value: "gestor_governo", label: "Gestor Secretaria de Governo" },
      { value: "administrador", label: "Administrador" },
    ],
    []
  );

  const [selected, setSelected] = useState<RoleOption>("adotante_pf");

  // Cadastro mínimo do adotante
  const [nomeRazao, setNomeRazao] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ao trocar PF/PJ, tenta carregar cadastro existente do storage
  useEffect(() => {
    setError(null);

    if (!isAdopterRole(selected)) return;

    const existing = getAdopterProfile(selected);
    if (existing) {
      setNomeRazao(existing.nome_razao_social ?? "");
      setEmail(existing.email ?? "");
      setCelular(existing.celular ?? "");
      setWhatsapp(existing.whatsapp ?? "");
    } else {
      setNomeRazao("");
      setEmail("");
      setCelular("");
      setWhatsapp("");
    }
  }, [selected]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function handleEnter() {
    setError(null);

    try {
      setSaving(true);

      if (isAdopterRole(selected)) {
        const res = upsertAdopterProfile({
          role: selected,
          nome_razao_social: nomeRazao,
          email,
          celular,
          whatsapp,
        });

        if (!res.ok) {
          setError(res.message || "Não foi possível salvar o cadastro do adotante.");
          return;
        }
      }

      setRole(selected);
      goHomeByRole(navigate, selected);
    } catch (e) {
      setError("Erro inesperado ao entrar. Verifique o console e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.9)",
  };

  return (
    <div className="container" style={{ paddingTop: 18 }}>
      <div className="page">
        <header className="page__header" style={{ marginBottom: 12 }}>
          <div className="page__titlewrap">
            <h1 className="page__title">Login</h1>
            <p className="page__subtitle">
              MVP: seleção de perfil. Para adotantes, é necessário cadastrar contato mínimo para comunicação oficial.
            </p>
          </div>
        </header>

        {role ? (
          <div className="card pad">
            <p style={{ marginTop: 0 }}>
              Perfil atual: <strong>{role}</strong>
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn--primary" onClick={() => goHomeByRole(navigate, role as RoleOption)}>
                Ir para o sistema
              </button>

              <button type="button" className="btn" onClick={handleLogout}>
                Sair / Trocar perfil
              </button>

              <Link className="btn" to="/">
                Voltar ao início
              </Link>
            </div>
          </div>
        ) : (
          <div className="card pad">
            <div className="grid cols-2" style={{ alignItems: "end" }}>
              <label style={{ fontWeight: 800 }}>
                Perfil
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value as RoleOption)}
                  style={inputStyle}
                  aria-label="Selecionar perfil"
                >
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div />
            </div>

            {isAdopterRole(selected) ? (
              <div className="card pad" style={{ marginTop: 14, background: "rgba(255,255,255,.72)" }}>
                <h3 style={{ marginTop: 0 }}>Cadastro mínimo do adotante</h3>

                <div className="grid cols-1">
                  <label style={{ fontWeight: 800 }}>
                    Nome / Razão social
                    <input
                      value={nomeRazao}
                      onChange={(e) => setNomeRazao(e.target.value)}
                      style={inputStyle}
                      autoComplete="name"
                    />
                  </label>

                  <label style={{ fontWeight: 800 }}>
                    E-mail
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                    />
                  </label>

                  <label style={{ fontWeight: 800 }}>
                    Celular (com DDD)
                    <input
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      style={inputStyle}
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(31) 9xxxx-xxxx"
                    />
                  </label>

                  <label style={{ fontWeight: 800 }}>
                    WhatsApp (opcional)
                    <input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      style={inputStyle}
                      type="tel"
                      inputMode="tel"
                      placeholder="se diferente do celular"
                    />
                  </label>
                </div>

                <p className="muted" style={{ marginTop: 10 }}>
                  Esses dados serão usados em comunicações de ajustes e andamento do processo.
                </p>
              </div>
            ) : null}

            {error ? (
              <div
                className="card pad"
                role="alert"
                style={{
                  marginTop: 14,
                  background: "rgba(255,255,255,.78)",
                  borderLeft: "6px solid rgba(220,38,38,.55)",
                }}
              >
                <strong style={{ display: "block", marginBottom: 6 }}>Não foi possível entrar</strong>
                <div style={{ color: "rgba(15,23,42,.82)" }}>{error}</div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="btn btn--primary" onClick={handleEnter} disabled={saving}>
                {saving ? "Salvando..." : "Entrar"}
              </button>

              <Link className="btn" to="/">
                Voltar ao início
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}