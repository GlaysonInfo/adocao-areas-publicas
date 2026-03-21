import type { FastifyPluginAsync } from "fastify";

export const versionRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/version",
    {
      schema: {
        description: "Build info",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              version: { type: "string" },
              env: { type: "string" },
              gitSha: { type: "string" }
            },
            required: ["version", "env"]
          }
        }
      }
    },
    async () => {
      return {
        version: app.config.VERSION,
        env: app.config.NODE_ENV,
        gitSha: app.config.GIT_SHA ?? ""
      };
    }
  );
};
