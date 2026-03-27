// apps/api/src/routes/areas.ts
import type { FastifyInstance } from "fastify";
import { areaListSchema } from "../schemas/areas.schema";
import { mockAreas } from "../lib/app-data";

export async function areaRoutes(app: FastifyInstance) {
  app.get(
    "/areas",
    {
      schema: {
        tags: ["areas"],
        response: {
          200: areaListSchema,
        },
      },
    },
    async () => {
      return mockAreas;
    }
  );
}
