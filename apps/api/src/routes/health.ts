import type { FastifyPluginAsync } from "fastify";

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        description: "Healthcheck",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              time: { type: "string" }
            },
            required: ["status", "time"]
          }
        }
      }
    },
    async () => {
      return { status: "ok", time: new Date().toISOString() };
    }
  );
};
