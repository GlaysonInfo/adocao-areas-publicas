import type { FastifyPluginAsync } from "fastify";
import { healthRoute } from "./health.js";
import { versionRoute } from "./version.js";

export const routesPlugin: FastifyPluginAsync = async (app) => {
  await app.register(healthRoute);
  await app.register(versionRoute);
};
