// apps/api/src/modules/auth/auth.types.ts

export type UserRole =
  | "adotante_pf"
  | "adotante_pj"
  | "gestor_semad"
  | "gestor_ecos"
  | "gestor_governo"
  | "administrador";

export type UserStatus = "active" | "pending_invite" | "disabled";

export const ADOTANTE_ROLES: UserRole[] = ["adotante_pf", "adotante_pj"];
export const GESTOR_ROLES: UserRole[] = ["gestor_semad", "gestor_ecos", "gestor_governo"];
export const ADMIN_ROLES: UserRole[] = ["administrador"];