import { Link, useNavigate } from "react-router-dom";
import { isManagerRole, useAuth } from "../auth/AuthContext";

function todayBR() {
  try {
    return new Date().toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export function Banner() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const goAccess = () => {
    if (role) {
      navigate(isManagerRole(role) ? "/gestor/kanban" : "/areas", { replace: true });
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <header className="banner">
      <div className="banner__media" aria-hidden="true" />
      <div className="container banner__inner">
        <div className="banner__kicker">PREFEITURA DE BETIM • EDUCAÇÃO AMBIENTAL</div>

        <h1 className="banner__title">ADOTE UMA ÁREA PÚBLICA</h1>

        <p className="banner__subtitle">
          Protótipo (MVP) — Portal para apoiar a adoção de praças, jardins e áreas verdes.{" "}
          <strong>{todayBR()}</strong>.
        </p>

        <div className="banner__actions">
          <button type="button" className="btn btn--primary" onClick={goAccess}>
            Solicitar / Acessar
          </button>

          <Link to="/areas" className="btn btn--ghost">
            Ver áreas disponíveis
          </Link>
        </div>
      </div>
    </header>
  );
}