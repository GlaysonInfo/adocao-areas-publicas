// apps/api/src/modules/auth/auth.routes.ts
import type { FastifyInstance } from "fastify";
import {
  register_schema,
  login_schema,
  forgot_password_schema,
  reset_password_schema,
  admin_create_user_schema,
} from "./auth.schemas";
import {
  register_adotante,
  login,
  refresh,
  logout,
  issue_reset_token,
  reset_password_with_token,
  admin_create_gestor,
} from "./auth.service";
import { authenticate_access } from "../../middlewares/authenticate";
import { admin_only } from "../../middlewares/rbac";

export async function auth_routes(fastify: FastifyInstance) {
  const refresh_cookie_name = fastify.auth_config.refresh_cookie_name;

  // POST /v1/auth/register (PÚBLICO)
  fastify.post(
    "/v1/auth/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Registrar adotante",
        security: [], // ✅ público na doc
      },
    },
    async (req, reply) => {
      const parsed = register_schema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ code: "VALIDATION_ERROR", issues: parsed.error.issues });

      const out = await register_adotante(fastify.prisma as any, fastify.auth_config as any, parsed.data);
      return reply.status(201).send(out);
    }
  );

  // POST /v1/auth/login (PÚBLICO)
  fastify.post(
    "/v1/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login",
        security: [], // ✅ público na doc
      },
    },
    async (req, reply) => {
      const parsed = login_schema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ code: "VALIDATION_ERROR", issues: parsed.error.issues });

      const meta = { ip: req.ip, user_agent: req.headers["user-agent"] ?? "" };
      const out = await login(
        fastify.prisma as any,
        fastify.auth_config as any,
        parsed.data.email,
        parsed.data.password,
        meta
      );

      reply.setCookie(refresh_cookie_name, out.refresh_token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.APP_ENV === "production",
        maxAge: fastify.auth_config.refresh_token_ttl_days * 24 * 60 * 60,
      });

      return reply.send({ user: out.user, access_token: out.access_token });
    }
  );

  // GET /v1/me (PROTEGIDO)
  fastify.get(
    "/v1/me",
    {
      preHandler: [authenticate_access()],
      schema: {
        tags: ["auth"],
        summary: "Me",
        // ✅ não precisa declarar security aqui se você já colocou security global no server.ts,
        // mas pode deixar explícito se quiser:
        // security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const u = req.auth_user!;
      return reply.send({ id: u.id, email: u.email, nome: u.nome, role: u.role });
    }
  );

  // POST /v1/auth/refresh (PÚBLICO na doc, usa cookie)
  fastify.post(
    "/v1/auth/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Refresh (cookie)",
        security: [], // ✅ não é Bearer; depende do cookie
      },
    },
    async (req, reply) => {
      const token = (req.cookies as any)?.[refresh_cookie_name] ?? "";
      if (!token) return reply.status(401).send({ code: "UNAUTHORIZED", message: "Missing refresh cookie" });

      const meta = { ip: req.ip, user_agent: req.headers["user-agent"] ?? "" };
      const out = await refresh(fastify.prisma as any, fastify.auth_config as any, token, meta);

      reply.setCookie(refresh_cookie_name, out.refresh_token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.APP_ENV === "production",
        maxAge: fastify.auth_config.refresh_token_ttl_days * 24 * 60 * 60,
      });

      return reply.send({ access_token: out.access_token });
    }
  );

  // POST /v1/auth/logout (PÚBLICO na doc, usa cookie)
  fastify.post(
    "/v1/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Logout (cookie)",
        security: [], // ✅ não é Bearer; depende do cookie
      },
    },
    async (req, reply) => {
      const token = (req.cookies as any)?.[refresh_cookie_name] ?? "";
      if (token) await logout(fastify.prisma as any, token);

      reply.clearCookie(refresh_cookie_name, { path: "/" });
      return reply.status(204).send();
    }
  );

  // POST /v1/auth/forgot-password (PÚBLICO)
  fastify.post(
    "/v1/auth/forgot-password",
    {
      schema: {
        tags: ["auth"],
        summary: "Forgot password",
        security: [], // ✅ público na doc
      },
    },
    async (req, reply) => {
      const parsed = forgot_password_schema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ code: "VALIDATION_ERROR", issues: parsed.error.issues });

      await issue_reset_token(
        fastify.prisma as any,
        fastify.auth_config as any,
        parsed.data.email,
        "reset_password",
        { ip: req.ip }
      );

      return reply.send({ ok: true });
    }
  );

  // POST /v1/auth/reset-password (PÚBLICO)
  fastify.post(
    "/v1/auth/reset-password",
    {
      schema: {
        tags: ["auth"],
        summary: "Reset password",
        security: [], // ✅ público na doc
      },
    },
    async (req, reply) => {
      const parsed = reset_password_schema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ code: "VALIDATION_ERROR", issues: parsed.error.issues });

      const out = await reset_password_with_token(
        fastify.prisma as any,
        fastify.auth_config as any,
        parsed.data.token,
        parsed.data.new_password
      );

      return reply.send(out);
    }
  );

  // POST /v1/admin/users (PROTEGIDO)
  fastify.post(
    "/v1/admin/users",
    {
      preHandler: [authenticate_access(), admin_only],
      schema: {
        tags: ["admin"],
        summary: "Criar gestores (admin-only)",
        // aqui também não precisa se security global já existe, mas ok explicitar:
        // security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      const parsed = admin_create_user_schema.safeParse(req.body);
      if (!parsed.success) return reply.status(422).send({ code: "VALIDATION_ERROR", issues: parsed.error.issues });

      const u = await admin_create_gestor(fastify.prisma as any, fastify.auth_config as any, parsed.data);
      return reply.status(201).send({ user: u });
    }
  );
}