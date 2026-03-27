import type { FastifyPluginAsync } from "fastify";

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err: any, req, reply) => {
    const status =
      (err as any)?.statusCode && Number.isFinite((err as any).statusCode)
        ? (err as any).statusCode
        : 500;

    const traceId = req.id;

    app.log.error({ err, traceId, url: req.url, method: req.method }, "request failed");

    reply.status(status).send({
      error: status >= 500 ? "internal_error" : "request_error",
      message: status >= 500 ? "Erro interno" : (err.message || "Erro na requisição"),
      traceId
    });
  });
};
