// apps/api/src/routes/health.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        response: {
          200: z.object({
            status: z.literal("ok"),
            service: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async () => {
      return {
        status: "ok",
        service: "adocao-areas-api",
        timestamp: new Date().toISOString(),
      };
    }
  );
}
