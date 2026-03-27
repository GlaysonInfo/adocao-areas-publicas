// apps/api/src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";

import { healthRoutes } from "./routes/health";
import { areaRoutes } from "./routes/areas";
import { proposalRoutes } from "./routes/proposals";
import { areaRequestRoutes } from "./routes/area-requests";
import { vistoriaRoutes } from "./routes/vistorias";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
  origin: true,
});

await app.register(sensible);

app.get("/", async () => {
  return {
    service: "adocao-areas-api",
    message: "API online",
    docs_hint: "Rotas disponíveis: /health, /areas, /proposals, /area-requests, /vistorias",
  };
});

await app.register(healthRoutes);
await app.register(areaRoutes);
await app.register(proposalRoutes);
await app.register(areaRequestRoutes);
await app.register(vistoriaRoutes);

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host }).then(() => {
  app.log.info(`API rodando em http://${host}:${port}`);
});
