import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AdotantePerfil, AdotanteRole } from "../domain/adopter";
import { getAdopterProfile, upsertAdopterProfile } from "../storage/adopters";

export type Role =
  | "administrador"
  | "gestor_semad"
  | "gestor_ecos"
  | "gestor_governo"
  | "adotante_pf"
  | "adotante_pj"
  | null;

const STORAGE_KEY = "mvp_role";

const ALLOWED_ROLES: Exclude<Role, null>[] = [
  "administrador",
  "gestor_semad",
  "gestor_ecos",
  "gestor_governo",
  "adotante_pf",
  "adotante_pj",
];

function parseRole(value: string | null): Role {
  if (!value) return null;
  return (ALLOWED_ROLES as string[]).includes(value) ? (value as Role) : null;
}

export function isManagerRole(role: Role): boolean {
  return (
    role === "administrador" ||
    role === "gestor_semad" ||
    role === "gestor_ecos" ||
    role === "gestor_governo"
  );
}

export function isAdopterRole(role: Role): role is AdotanteRole {
  return role === "adotante_pf" || role === "adotante_pj";
}

type AuthContextValue = {
  role: Role;
  setRole: (role: Exclude<Role, null>) => void;
  logout: () => void;

  adopterProfile: AdotantePerfil | null;
  saveAdopterProfile: (data: {
    nome_razao: string;
    email: string;
    celular: string;
    whatsapp?: string;
  }) => AdotantePerfil | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => parseRole(localStorage.getItem(STORAGE_KEY)));

  const [adopterProfile, setAdopterProfile] = useState<AdotantePerfil | null>(() => {
    const r = parseRole(localStorage.getItem(STORAGE_KEY));
    return isAdopterRole(r) ? getAdopterProfile(r) : null;
  });

  useEffect(() => {
    if (isAdopterRole(role)) {
      setAdopterProfile(getAdopterProfile(role));
    } else {
      setAdopterProfile(null);
    }
  }, [role]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      role,

      setRole: (nextRole) => {
        localStorage.setItem(STORAGE_KEY, nextRole);
        setRoleState(nextRole);
        // adopterProfile é sincronizado pelo useEffect
      },

      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setRoleState(null);
        setAdopterProfile(null);
      },

      adopterProfile,

      saveAdopterProfile: (data) => {
        if (!isAdopterRole(role)) return null;

        const saved = upsertAdopterProfile({
          role,
          nome_razao: data.nome_razao,
          email: data.email,
          celular: data.celular,
          whatsapp: data.whatsapp,
        });

        setAdopterProfile(saved);
        return saved;
      },
    };
  }, [role, adopterProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}