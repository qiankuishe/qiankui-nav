import jwt, { SignOptions } from 'jsonwebtoken'
import { FastifyRequest } from 'fastify'

import crypto from 'crypto'

// 生产环境必须设置 JWT_SECRET 环境变量
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️ 警告: 生产环境未设置 JWT_SECRET，使用随机密钥（重启后会话失效）')
  }
  return crypto.randomBytes(32).toString('hex')
})()

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
