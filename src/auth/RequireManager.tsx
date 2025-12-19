import { Navigate, Outlet } from "react-router-dom";
import { isManagerRole, useAuth } from "./AuthContext";

export function RequireManager() {
  const { role } = useAuth();

  if (!isManagerRole(role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}