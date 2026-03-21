import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../auth/auth.types";

type AnyBody = Record<string, any>;

function get_pathname(req: FastifyRequest): string {
  const rawUrl = req.raw.url ?? "";
  try {
    return new URL(rawUrl, "http://localhost").pathname;
  } catch {
    return rawUrl.split("?")[0] || rawUrl;
  }
}

function ensure_body_object(req: FastifyRequest): AnyBody {
  const b: any = (req as any).body;
  if (b && typeof b === "object" && !Array.isArray(b)) return b as AnyBody;
  (req as any).body = {};
  return (req as any).body as AnyBody;
}

function forbid(reply: FastifyReply, code: string, message: string) {
  return reply.status(403).send({ code, message });
}

function require_any_role(reply: FastifyReply, role: string | undefined, allowed: UserRole[], code: string) {
  if (!role) return forbid(reply, "FORBIDDEN", "Missing role");
  if (!allowed.includes(role as UserRole)) return forbid(reply, code, "Role not allowed");
  return null;
}

function normalize_to_coluna(v: any): string {
  return String(v ?? "").trim();
}

/**
 * RBAC mínimo:
 * - CREATE: só adotante_pf/pj
 * - MOVE: só staff (gestores/admin) e restringe por coluna destino (extra)
 */
export async function proposals_rbac_hook(req: FastifyRequest, reply: FastifyReply) {
  const pathname = get_pathname(req);
  const method = (req.method || "").toUpperCase();
  const role = req.auth_user?.role as UserRole | undefined;

  // CREATE
  if (method === "POST" && pathname === "/v1/proposals") {
    const deny = require_any_role(reply, role, ["adotante_pf", "adotante_pj"], "FORBIDDEN_CREATE_PROPOSAL");
    if (deny) return;

    // compat: se cliente mandar owner_role/actor_role, tem que bater com JWT
    const body = ensure_body_object(req);
    if (body.owner_role && String(body.owner_role) !== role) {
      return forbid(reply, "FORBIDDEN_OWNER_ROLE_MISMATCH", "owner_role mismatch");
    }
    if (body.actor_role && String(body.actor_role) !== role) {
      return forbid(reply, "FORBIDDEN_ACTOR_ROLE_MISMATCH", "actor_role mismatch");
    }
    return;
  }

  // MOVE
  const moveMatch = pathname.match(/^\/v1\/proposals\/([^/]+)\/move$/);
  if (method === "POST" && moveMatch) {
    const deny = require_any_role(
      reply,
      role,
      ["gestor_semad", "gestor_ecos", "gestor_governo", "administrador"],
      "FORBIDDEN_MOVE_PROPOSAL"
    );
    if (deny) return;

    const body = ensure_body_object(req);
    const to = normalize_to_coluna(body.to);

    const allow_by_to: Record<string, UserRole[]> = {
      analise_semad: ["gestor_semad", "administrador"],
      analise_ecos: ["gestor_semad", "gestor_ecos", "administrador"],
      decisao: ["gestor_ecos", "administrador"],
      termo_assinado: ["gestor_governo", "administrador"],
      ajustes: ["gestor_semad", "gestor_ecos", "gestor_governo", "administrador"],
      indeferida: ["gestor_ecos", "gestor_governo", "administrador"],
      protocolo: ["gestor_semad", "administrador"],
    };

    if (to && allow_by_to[to]) {
      const allowed = allow_by_to[to];
      if (!allowed.includes(role as UserRole)) {
        return forbid(reply, "FORBIDDEN_MOVE_TARGET", "Role not allowed for target column");
      }
    }

    return;
  }

  return;
}