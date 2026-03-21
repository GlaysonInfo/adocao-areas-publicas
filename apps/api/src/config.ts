// apps/api/src/config.ts
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),

  // CSV: "http://localhost:5173,https://seu-dominio.com"
  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  SWAGGER_ENABLED: z.coerce.boolean().default(true),
});

export const config = EnvSchema.parse(process.env);

export const corsOrigins = config.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);