// apps/api/src/middlewares/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyJWT, type JWTPayload } from '../lib/auth'

declare global {
  namespace FastifyInstance {
    interface FastifyRequest {
      user?: JWTPayload
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload
  }
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return reply.code(401).send({
      code: 'UNAUTHORIZED',
      message: 'Token não fornecido',
    })
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer') {
    return reply.code(401).send({
      code: 'INVALID_SCHEME',
      message: 'Esquema de autenticação inválido. Use "Bearer <token>"',
    })
  }

  const payload = verifyJWT(token)
  if (!payload) {
    return reply.code(401).send({
      code: 'INVALID_TOKEN',
      message: 'Token inválido ou expirado',
    })
  }

  request.user = payload
}

export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Autenticação necessária',
      })
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        code: 'FORBIDDEN',
        message: `Acesso negado. Requer um dos papéis: ${allowedRoles.join(', ')}`,
      })
    }
  }
}
