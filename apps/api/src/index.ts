// apps/api/src/index.ts
import { buildServer } from "./server";
import { config } from "./config";

const app = await buildServer();

await app.listen({
  port: config.PORT,
  host: config.HOST,
});

app.log.info(`API on http://${config.HOST}:${config.PORT}`);