// apps/api/src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import cookie from "@fastify/cookie";

import {
  ZodTypeProvider,
  validatorCompiler,
  serializerCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";

import { PrismaClient } from "@prisma/client";

import { config, corsOrigins } from "./config";

import { areasRoutes } from "./modules/areas/areas.routes";
import { vistoriasRoutes } from "./modules/vistorias/vistorias.routes";

import { auth_module } from "./modules/auth";
import { proposals_module } from "./modules/proposals/proposals.module";

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Prisma
  const prisma = new PrismaClient();
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  // CORS (cookies + credentials)
  await app.register(cors, {
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  // Cookie (GLOBAL) - necessário para refresh cookie
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? "dev_cookie_secret_change_me",
    hook: "onRequest",
  });

  // Auth config (GLOBAL) - precisa estar visível para TODOS os módulos (Fastify encapsulation)
  app.decorate("auth_config", {
    jwt_access_secret: process.env.JWT_ACCESS_SECRET ?? "dev_jwt_secret_change_me",
    access_token_ttl_minutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? 15),
    refresh_token_ttl_days: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
    reset_token_ttl_minutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 45),
    refresh_cookie_name: String(process.env.REFRESH_COOKIE_NAME ?? "refresh_token"),
  });

  // Swagger
  if (config.SWAGGER_ENABLED) {
    await app.register(swagger, {
      openapi: {
        info: { title: "Adote uma Área — API", version: "0.1.0" },

        // ✅ habilita Bearer JWT no Swagger UI
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },

        // ✅ aplica bearer por padrão em todas as rotas na documentação
        // (desligue em rotas públicas com schema.security = [])
        security: [{ bearerAuth: [] }],
      },
      transform: jsonSchemaTransform,
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        persistAuthorization: true,
      },
    });
  }

  // Health
  app.get("/healthz", async () => ({
    ok: true,
    env: config.NODE_ENV,
  }));

  // Módulos (rotas internas já com /v1 dentro)
  await app.register(auth_module);
  await app.register(proposals_module);

  // Rotas com prefix /v1
  await app.register(areasRoutes, { prefix: "/v1" });
  await app.register(vistoriasRoutes, { prefix: "/v1" });

  return app;
}

// 👇 Deixe o module augmentation FORA da função (no final do arquivo)
declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    auth_config: {
      jwt_access_secret: string;
      access_token_ttl_minutes: number;
      refresh_token_ttl_days: number;
      reset_token_ttl_minutes: number;
      refresh_cookie_name: string;
    };
  }
}