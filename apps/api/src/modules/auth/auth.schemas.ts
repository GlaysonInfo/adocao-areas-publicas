// apps/api/src/modules/auth/auth.schemas.ts

import { z } from "zod";
import { ADOTANTE_ROLES, GESTOR_ROLES } from "./auth.types";

export const register_schema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  role: z.enum(ADOTANTE_ROLES as [string, ...string[]]),
  cpf_cnpj: z.string().min(11).max(20).optional(),
});

export const login_schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export const forgot_password_schema = z.object({
  email: z.string().email().max(254),
});

export const reset_password_schema = z.object({
  token: z.string().min(20).max(500),
  new_password: z.string().min(8).max(200),
});

export const admin_create_user_schema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().max(254),
  role: z.enum(GESTOR_ROLES as [string, ...string[]]),
});

export type RegisterInput = z.infer<typeof register_schema>;
export type LoginInput = z.infer<typeof login_schema>;
export type ForgotPasswordInput = z.infer<typeof forgot_password_schema>;
export type ResetPasswordInput = z.infer<typeof reset_password_schema>;
export type AdminCreateUserInput = z.infer<typeof admin_create_user_schema>;