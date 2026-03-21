// apps/api/src/modules/auth/auth.service.ts

import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { sha256_base64url, random_token_base64url, normalize_email, now_plus_days, now_plus_minutes } from "./auth.crypto";
import type { UserRole } from "./auth.types";

type PrismaLike = {
  user: any;
  session: any;
  password_reset_token: any;
  email_outbox: any;
  $transaction: any;
};

export type PublicUser = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  status: "active" | "pending_invite" | "disabled";
  created_at?: string;
  updated_at?: string;
};

export type AuthConfig = {
  jwt_access_secret: string;
  access_token_ttl_minutes: number;
  refresh_token_ttl_days: number;
  reset_token_ttl_minutes: number;
  refresh_cookie_name: string;
};

export function to_public_user(u: any): PublicUser {
  return {
    id: u.id,
    email: u.email,
    nome: u.nome,
    role: u.role,
    status: u.status,
    created_at: u.created_at?.toISOString?.() ?? u.created_at,
    updated_at: u.updated_at?.toISOString?.() ?? u.updated_at,
  };
}

export async function hash_password(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verify_password(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function sign_access_token(cfg: AuthConfig, user: PublicUser): string {
  const payload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    nome: user.nome,
  };

  return jwt.sign(payload, cfg.jwt_access_secret, {
    expiresIn: `${cfg.access_token_ttl_minutes}m`,
  });
}

export function verify_access_token(cfg: AuthConfig, token: string): any {
  return jwt.verify(token, cfg.jwt_access_secret);
}

export async function register_adotante(prisma: PrismaLike, cfg: AuthConfig, input: any): Promise<{ user: PublicUser; access_token: string }> {
  const email = normalize_email(input.email);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    const err: any = new Error("EMAIL_ALREADY_EXISTS");
    err.statusCode = 409;
    throw err;
  }

  const password_hash = await hash_password(input.password);

  const created = await prisma.user.create({
    data: {
      email,
      nome: input.nome,
      cpf_cnpj: input.cpf_cnpj ?? null,
      role: input.role,
      status: "active",
      password_hash,
    },
  });

  const pub = to_public_user(created);
  const access_token = sign_access_token(cfg, pub);
  return { user: pub, access_token };
}

export async function login(prisma: PrismaLike, cfg: AuthConfig, emailRaw: string, password: string, meta?: { ip?: string; user_agent?: string }) {
  const email = normalize_email(emailRaw);
  const u = await prisma.user.findUnique({ where: { email } });

  // resposta genérica (anti-enumeração)
  if (!u || !u.password_hash) {
    const err: any = new Error("INVALID_CREDENTIALS");
    err.statusCode = 401;
    throw err;
  }

  if (u.status === "disabled") {
    const err: any = new Error("ACCOUNT_DISABLED");
    err.statusCode = 403;
    throw err;
  }

  if (u.status === "pending_invite") {
    const err: any = new Error("ACCOUNT_PENDING_INVITE");
    err.statusCode = 403;
    throw err;
  }

  const ok = await verify_password(u.password_hash, password);
  if (!ok) {
    const err: any = new Error("INVALID_CREDENTIALS");
    err.statusCode = 401;
    throw err;
  }

  const pub = to_public_user(u);
  const access_token = sign_access_token(cfg, pub);

  const refresh_token = random_token_base64url(32);
  const refresh_token_hash = sha256_base64url(refresh_token);
  const expires_at = now_plus_days(cfg.refresh_token_ttl_days);

  const session = await prisma.session.create({
    data: {
      user_id: u.id,
      refresh_token_hash,
      expires_at,
      ip: meta?.ip ?? null,
      user_agent: meta?.user_agent ?? null,
    },
  });

  return { user: pub, access_token, refresh_token, session_id: session.id, expires_at };
}

export async function refresh(prisma: PrismaLike, cfg: AuthConfig, refresh_token: string, meta?: { ip?: string; user_agent?: string }) {
  const hash = sha256_base64url(refresh_token);

  const session = await prisma.session.findUnique({ where: { refresh_token_hash: hash } });
  if (!session || session.revoked_at) {
    const err: any = new Error("INVALID_REFRESH");
    err.statusCode = 401;
    throw err;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    const err: any = new Error("EXPIRED_REFRESH");
    err.statusCode = 401;
    throw err;
  }

  const u = await prisma.user.findUnique({ where: { id: session.user_id } });
  if (!u || u.status !== "active") {
    const err: any = new Error("INVALID_REFRESH");
    err.statusCode = 401;
    throw err;
  }

  const new_refresh = random_token_base64url(32);
  const new_hash = sha256_base64url(new_refresh);
  const new_expires = now_plus_days(cfg.refresh_token_ttl_days);

  const pub = to_public_user(u);
  const access_token = sign_access_token(cfg, pub);

  await prisma.$transaction(async (tx: PrismaLike) => {
    await tx.session.update({
      where: { id: session.id },
      data: { revoked_at: new Date() },
    });

    await tx.session.create({
      data: {
        user_id: u.id,
        refresh_token_hash: new_hash,
        expires_at: new_expires,
        rotated_from_id: session.id,
        ip: meta?.ip ?? null,
        user_agent: meta?.user_agent ?? null,
      },
    });
  });

  return { access_token, refresh_token: new_refresh, user: pub };
}

export async function logout(prisma: PrismaLike, refresh_token: string): Promise<void> {
  const hash = sha256_base64url(refresh_token);
  const session = await prisma.session.findUnique({ where: { refresh_token_hash: hash } });
  if (!session || session.revoked_at) return;

  await prisma.session.update({
    where: { id: session.id },
    data: { revoked_at: new Date() },
  });
}

export async function issue_reset_token(prisma: PrismaLike, cfg: AuthConfig, emailRaw: string, purpose: "reset_password" | "invite_set_password", meta?: { ip?: string }) {
  const email = normalize_email(emailRaw);
  const u = await prisma.user.findUnique({ where: { email } });

  // sempre retornar OK no handler; aqui só faz side-effect se existir
  if (!u) return;

  if (purpose === "reset_password" && u.status !== "active") return;

  const token = random_token_base64url(32);
  const token_hash = sha256_base64url(token);
  const expires_at = now_plus_minutes(cfg.reset_token_ttl_minutes);

  await prisma.password_reset_token.create({
    data: {
      user_id: u.id,
      purpose,
      token_hash,
      expires_at,
      requested_ip: meta?.ip ?? null,
    },
  });

  await prisma.email_outbox.create({
    data: {
      user_id: u.id,
      to_email: u.email,
      template: purpose === "reset_password" ? "forgot_password" : "invite_set_password",
      payload_json: {
        token,
        purpose,
        expires_at: expires_at.toISOString(),
      },
      status: "pending",
      attempts: 0,
    },
  });
}

export async function reset_password_with_token(prisma: PrismaLike, cfg: AuthConfig, token: string, new_password: string) {
  const token_hash = sha256_base64url(token);
  const row = await prisma.password_reset_token.findUnique({ where: { token_hash } });

  if (!row || row.used_at) {
    const err: any = new Error("INVALID_TOKEN");
    err.statusCode = 400;
    throw err;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    const err: any = new Error("EXPIRED_TOKEN");
    err.statusCode = 400;
    throw err;
  }

  const pw_hash = await hash_password(new_password);

  await prisma.$transaction(async (tx: PrismaLike) => {
    await tx.password_reset_token.update({
      where: { id: row.id },
      data: { used_at: new Date() },
    });

    await tx.user.update({
      where: { id: row.user_id },
      data: {
        password_hash: pw_hash,
        status: "active", // cobre convite de gestor também
      },
    });

    // revoga todas as sessões do usuário
    await tx.session.updateMany({
      where: { user_id: row.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  });

  return { ok: true };
}

export async function admin_create_gestor(prisma: PrismaLike, cfg: AuthConfig, input: any) {
  const email = normalize_email(input.email);
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    const err: any = new Error("EMAIL_ALREADY_EXISTS");
    err.statusCode = 409;
    throw err;
  }

  const created = await prisma.user.create({
    data: {
      email,
      nome: input.nome,
      role: input.role,
      status: "pending_invite",
      password_hash: null,
    },
  });

  await issue_reset_token(prisma, cfg, created.email, "invite_set_password", { ip: undefined });

  return to_public_user(created);
}