// apps/api/src/middlewares/authenticate.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import { verify_access_token } from "../modules/auth/auth.service";

export type AuthUser = {
  id: string;
  role: string;
  email: string;
  nome: string;
};

declare module "fastify" {
  interface FastifyRequest {
    auth_user?: AuthUser;
  }

  interface FastifyInstance {
    auth_config: {
      jwt_access_secret: string;
      access_token_ttl_minutes: number;
      refresh_token_ttl_days: number;
      reset_token_ttl_minutes: number;
      refresh_cookie_name: string;
    };
  }
}

function getAuthorizationHeader(req: FastifyRequest): string {
  const h = req.headers.authorization;

  if (typeof h === "string") return h;
  if (Array.isArray(h) && typeof h[0] === "string") return h[0];

  // fallback: tenta ler do rawHeaders (preserva casing original)
  const raw = (req.raw as any)?.rawHeaders as unknown;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length - 1; i += 2) {
      const k = String(raw[i] ?? "").toLowerCase();
      if (k === "authorization") return String(raw[i + 1] ?? "");
    }
  }

  return "";
}

function extractBearerToken(req: FastifyRequest): string {
  const auth = getAuthorizationHeader(req).trim();

  if (!auth) return "";

  // aceita "Bearer <token>" com variações de caixa e múltiplos espaços
  const parts = auth.split(/\s+/);
  if (parts.length >= 2 && parts[0].toLowerCase() === "bearer") {
    return parts.slice(1).join(" ").trim();
  }

  return "";
}

export function authenticate_access() {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const token = extractBearerToken(req);

    if (!token) {
      return reply.status(401).send({
        code: "UNAUTHORIZED",
        message: "Missing access token",
      });
    }

    const cfg = req.server.auth_config;

    try {
      const decoded: any = verify_access_token(cfg, token);

      req.auth_user = {
        id: String(decoded.sub),
        role: String(decoded.role),
        email: String(decoded.email),
        nome: String(decoded.nome),
      };
    } catch {
      return reply.status(401).send({
        code: "UNAUTHORIZED",
        message: "Invalid access token",
      });
    }
  };
}