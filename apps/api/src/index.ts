import { buildServer } from "./server";

const app = await buildServer();

await app.listen({
  port: app.config.PORT,
  host: app.config.HOST,
});

app.log.info(`API on http://${app.config.HOST}:${app.config.PORT}`);
