import jwt, { SignOptions } from 'jsonwebtoken'
import { FastifyRequest } from 'fastify'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface JWTPayload {
  userId: string
  username: string
  iat?: number
  exp?: number
}

export function generateToken(userId: string, username: string): string {
  const payload = { userId, username }
  const options: SignOptions = { expiresIn: '30d' }
  return jwt.sign(payload, JWT_SECRET, options)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function getAuthUser(request: FastifyRequest): JWTPayload | null {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  
  const token = authHeader.slice(7)
  return verifyToken(token)
}
