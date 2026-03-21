import type { FastifyInstance } from "fastify";
import { authenticate_access } from "../../middlewares/authenticate";
import { proposalsRoutes } from "./proposals.routes";
import { proposals_rbac_hook } from "./proposals.rbac";
import { proposals_ownership_hook } from "./proposals.ownership";

export async function proposals_module(fastify: FastifyInstance) {
  // 1) auth primeiro (precisa preencher req.auth_user)
  fastify.addHook("preValidation", authenticate_access());

  // 2) RBAC antes do handler (e antes de qualquer lógica)
  fastify.addHook("preValidation", proposals_rbac_hook);

  // 3) ownership real (só para adotantes e rotas com :id)
  fastify.addHook("preHandler", proposals_ownership_hook);

  await fastify.register(proposalsRoutes, { prefix: "/v1" });
}