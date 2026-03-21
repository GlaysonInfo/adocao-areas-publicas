import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
  GIT_SHA: z.string().optional()
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  VERSION: string;
};

export const envPlugin: FastifyPluginAsync = async (app) => {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    app.log.error({ issues: parsed.error.issues }, "invalid env");
    throw new Error("Invalid environment variables");
  }

  // Versão do package.json (fallback estável; você pode trocar por leitura real do package.json)
  const VERSION = "0.1.0";

  const config: AppConfig = {
    ...parsed.data,
    VERSION
  };

  app.decorate("config", config);
};

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}
