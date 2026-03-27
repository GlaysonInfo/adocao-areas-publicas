import type { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";
import { versionRoute } from "./version.js";

export const routesPlugin: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(versionRoute);
};
