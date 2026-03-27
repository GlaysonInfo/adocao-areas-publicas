// apps/api/src/lib/auth.ts
import { createHmac, randomBytes } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
const JWT_EXPIRY = '7d'

export interface JWTPayload {
  user_id: string
  role: string
  email: string
  iat: number
  exp: number
}

// Função simples de encode JWT (Base64 do header.payload.signature)
export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 7 * 24 * 60 * 60 // 7 dias
  
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp,
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const encodedHeader = base64Encode(JSON.stringify(header))
  const encodedPayload = base64Encode(JSON.stringify(fullPayload))
  
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.')

    if (!encodedHeader || !encodedPayload || !signature) {
      return null
    }

    const expectedSignature = createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url')

    if (signature !== expectedSignature) {
      return null
    }

    const payload: JWTPayload = JSON.parse(base64Decode(encodedPayload))

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null // Token expirado
    }

    return payload
  } catch (error) {
    return null
  }
}

function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64url')
}

function base64Decode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8')
}

// Usuarios mock com senhas hash simples
export const mockUsers = [
  {
    id: 'user-1',
    email: 'adotante@example.com',
    passwordHash: 'simple-hash-123', // Em produção, usar bcrypt
    role: 'adotante_pf',
    name: 'João Silva',
  },
  {
    id: 'user-2',
    email: 'gerente@example.com',
    passwordHash: 'simple-hash-456',
    role: 'gerente_area',
    name: 'Maria Manager',
  },
  {
    id: 'user-3',
    email: 'admin@example.com',
    passwordHash: 'simple-hash-789',
    role: 'admin',
    name: 'Admin User',
  },
]
