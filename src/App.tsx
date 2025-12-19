import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { isManagerRole, useAuth } from "./auth/AuthContext";
import { DevToolbar } from "./components/DevToolbar";
import { Banner } from "./components/Banner";

// ... (mesmos imports)

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : "";
}

export default function App() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isKanban = pathname.startsWith("/gestor/kanban");

  const is_admin = role === "administrador";
  const is_manager = role ? isManagerRole(role) : false;
  const is_adopter = role === "adotante_pf" || role === "adotante_pj";

  // ✅ Relatórios só para gestor_semad e administrador
  const can_reports = role === "gestor_semad" || is_admin;

  return (
    <div>
      {import.meta.env.DEV ? <DevToolbar /> : null}

      <Banner />

      <div className="topnav">
        <div className="container topnav__inner">
          <nav className="navlinks" aria-label="Menu principal">
            <NavLink to="/" end className={navClass}>
              Início
            </NavLink>

            <NavLink to="/areas" className={navClass}>
              Áreas
            </NavLink>

            {/* Público (sem login) */}
            {!role ? (
              <NavLink to="/login" className={navClass}>
                Login
              </NavLink>
            ) : null}

            {/* Adotante */}
            {is_adopter ? (
              <>
                <NavLink to="/propostas/nova" className={navClass}>
                  Nova Proposta
                </NavLink>

                <NavLink to="/minhas-propostas" className={navClass}>
                  Minhas Propostas
                </NavLink>
              </>
            ) : null}

            {/* Gestor (e Admin também pode ver) */}
            {is_manager || is_admin ? (
              <NavLink to="/gestor/kanban" className={navClass}>
                Kanban Gestor
              </NavLink>
            ) : null}

            {/* ✅ Relatórios (somente gestor_semad e admin) */}
            {can_reports ? (
              <NavLink to="/relatorios" className={navClass}>
                Relatórios
              </NavLink>
            ) : null}

            {/* Admin */}
            {is_admin ? (
              <NavLink to="/admin/areas" className={navClass}>
                Admin · Áreas
              </NavLink>
            ) : null}
          </nav>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="profilepill">
              Perfil: <strong>{role ?? "—"}</strong>
            </span>

            {role ? (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                Sair / Trocar perfil
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <main className="main">
        {isKanban ? (
          <div className="container container--full">
            <AppRoutes />
          </div>
        ) : (
          <AppRoutes />
        )}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <strong>Secretaria Municipal de Meio Ambiente e Desenvolvimento Sustentável</strong>
          <small>semmadbetim@betim.mg.gov.br • Telefone: (31) 3512-3032</small>
        </div>
      </footer>
    </div>
  );
}