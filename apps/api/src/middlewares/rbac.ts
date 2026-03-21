// apps/api/src/middlewares/rbac.ts

import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../modules/auth/auth.types";

export function require_roles(roles: UserRole[]) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const role = req.auth_user?.role;
    if (!role) {
      return reply.status(401).send({ code: "UNAUTHORIZED", message: "Missing auth_user" });
    }
    if (!roles.includes(role as UserRole)) {
      return reply.status(403).send({ code: "FORBIDDEN", message: "Role not allowed" });
    }
  };
}

export const admin_only = require_roles(["administrador"]);