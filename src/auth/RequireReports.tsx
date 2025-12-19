// src/auth/RequireReports.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireReports() {
  const { role } = useAuth();
  const loc = useLocation();

  if (!role) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  const can = role === "administrador" || role === "gestor_semad";
  if (can) return <Outlet />;

  return (
    <div className="container">
      <div className="card pad">
        <h2 style={{ marginTop: 0 }}>Acesso restrito</h2>
        <p style={{ marginBottom: 0 }}>
          A aba <strong>Relatórios</strong> está disponível apenas para <strong>gestor SEMAD</strong> e{" "}
          <strong>administrador</strong>.
        </p>
      </div>
    </div>
  );
}