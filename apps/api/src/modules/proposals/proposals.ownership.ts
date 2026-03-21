import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../auth/auth.types";

function get_pathname(req: FastifyRequest): string {
  const rawUrl = req.raw.url ?? "";
  try {
    return new URL(rawUrl, "http://localhost").pathname;
  } catch {
    return rawUrl.split("?")[0] || rawUrl;
  }
}

function forbid(reply: FastifyReply, code: string, message: string) {
  return reply.status(403).send({ code, message });
}

function is_adotante(role: UserRole | undefined): boolean {
  return role === "adotante_pf" || role === "adotante_pj";
}

/**
 * Ownership real:
 * - Adotante só acessa proposals onde owner_user_id == req.auth_user.id
 * - Se owner_user_id for null (legado), bloqueia para adotante por segurança.
 * - Aplica em rotas /v1/proposals/:id (inclui /events e /move)
 */
export async function proposals_ownership_hook(req: FastifyRequest, reply: FastifyReply) {
  const role = req.auth_user?.role as UserRole | undefined;
  if (!is_adotante(role)) return;

  const pathname = get_pathname(req);
  const method = (req.method || "").toUpperCase();

  const match = pathname.match(/^\/v1\/proposals\/([^/]+)(\/.*)?$/);
  if (!match) return;

  // o create é /v1/proposals sem id, então não entra aqui
  if (!["GET", "POST"].includes(method)) return;

  const proposal_id = match[1];
  if (!proposal_id) return;

  const prisma = (req.server as any).prisma;
  const row = await prisma.proposal.findUnique({
    where: { id: proposal_id },
    select: { id: true, owner_user_id: true },
  });

  if (!row) return reply.status(404).send({ message: "Proposta não encontrada." });

  const owner_user_id: string | null = row.owner_user_id ?? null;
  if (!owner_user_id) {
    return forbid(reply, "FORBIDDEN_OWNERSHIP_UNDEFINED", "Ownership indefinido para esta proposta (dados legados).");
  }

  if (owner_user_id !== req.auth_user?.id) {
    return forbid(reply, "FORBIDDEN_NOT_OWNER", "Acesso negado (não é o dono).");
  }
}