// apps/api/src/server.ts
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { prisma } from "./db/prisma";
import { envPlugin } from "./plugins/env";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { routesPlugin } from "./routes";
import { areaRoutes } from "./routes/areas";
import { areaRequestRoutes } from "./routes/area-requests";
import { proposalRoutes } from "./routes/proposals";
import { vistoriaRoutes } from "./routes/vistorias";
import { auth_module } from "./modules/auth";
import { areasRoutes } from "./modules/areas/areas.routes";
import { proposals_module } from "./modules/proposals/proposals.module";
import { vistoriasRoutes } from "./modules/vistorias/vistorias.routes";

const authConfig = {
  jwt_access_secret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "dev-secret-key-change-in-production",
  access_token_ttl_minutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? 15),
  refresh_token_ttl_days: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  reset_token_ttl_minutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 60),
  refresh_cookie_name: process.env.REFRESH_COOKIE_NAME ?? "refresh_token",
};

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
    auth_config: typeof authConfig;
  }
}

async function registerLegacyRoutes(app: FastifyInstance) {
  await app.register(areaRoutes);
  await app.register(proposalRoutes);
  await app.register(areaRequestRoutes);
  await app.register(vistoriaRoutes);
}

async function registerV1Routes(app: FastifyInstance) {
  await app.register(auth_module);
  await app.register(areasRoutes, { prefix: "/v1" });
  await app.register(proposals_module);
  await app.register(vistoriasRoutes, { prefix: "/v1" });
  await app.register(areaRequestRoutes, { prefix: "/v1" });
}

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.decorate("prisma", prisma);
  app.decorate("auth_config", authConfig);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(envPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(sensible);

  app.get("/", async () => {
    return {
      service: "adocao-areas-api",
      message: "API online",
      legacy_hint: "Endpoints legados: /areas, /proposals, /area-requests, /vistorias",
      v1_hint: "Endpoints modulares: /v1/auth, /v1/areas, /v1/proposals, /v1/vistorias",
    };
  });

  await app.register(routesPlugin);
  await registerLegacyRoutes(app);
  await registerV1Routes(app);

  return app;
}
