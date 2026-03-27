// apps/api/src/routes/vistorias.ts
import type { FastifyInstance } from "fastify";
import { vistoriaListSchema } from "../schemas/vistorias.schema";
import { mockVistorias } from "../lib/app-data";

export async function vistoriaRoutes(app: FastifyInstance) {
  app.get(
    "/vistorias",
    {
      schema: {
        tags: ["vistorias"],
        response: {
          200: vistoriaListSchema,
        },
      },
    },
    async () => {
      return mockVistorias;
    }
  );
}
