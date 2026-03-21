// apps/api/src/modules/auth/index.ts

import type { FastifyInstance } from "fastify";
import { auth_routes } from "./auth.routes";

export async function auth_module(fastify: FastifyInstance) {
  await auth_routes(fastify);
}