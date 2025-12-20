import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { generateToken, getAuthUser } from '../auth.js'

// 记录登录失败尝试的辅助函数
function recordFailedAttempt(
  key: string, 
  attempts: Map<string, { count: number; lastAttempt: number; lockedUntil: number }>
) {
  const now = Date.now()
  const existing = attempts.get(key)
  
  if (!existing || now - existing.lastAttempt > 60 * 60 * 1000) {
    // 1小时后重置计数
    attempts.set(key, { count: 1, lastAttempt: now, lockedUntil: 0 })
  } else {
    const newCount = existing.count + 1
    let lockedUntil = 0
    
    // 渐进式封锁: 5次失败后开始锁定
    if (newCount >= 5) {
      // 锁定时间: 30秒 * 2^(失败次数-5)，最长1小时
      // 第5次: 30秒, 第6次: 60秒, 第7次: 120秒, 第8次: 240秒...
      const lockSeconds = Math.min(30 * Math.pow(2, newCount - 5), 3600)
      lockedUntil = now + lockSeconds * 1000
    }
    
    attempts.set(key, { count: newCount, lastAttempt: now, lockedUntil })
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  // 登录失败计数器 (内存存储，重启后重置)
  const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>()
  
  // 登录
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as { username: string; password: string }
    const clientIp = request.ip || 'unknown'
    
    if (!username || !password) {
      return reply.status(400).send({ error: '请输入用户名和密码' })
    }

    // 检查是否被锁定
    const attemptKey = `${clientIp}:${username}`
    const attempts = loginAttempts.get(attemptKey)
    const now = Date.now()
    
    if (attempts && attempts.lockedUntil > now) {
      const remainingSeconds = Math.ceil((attempts.lockedUntil - now) / 1000)
      return reply.status(429).send({ 
        error: `登录失败次数过多，请 ${remainingSeconds} 秒后重试`,
        lockedUntil: attempts.lockedUntil,
        remainingSeconds
      })
    }

    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
    
    if (!user) {
      recordFailedAttempt(attemptKey, loginAttempts)
      const info = loginAttempts.get(attemptKey)!
      return reply.status(401).send({ 
        error: '用户名或密码错误',
        attemptsRemaining: Math.max(0, 5 - info.count)
      })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      recordFailedAttempt(attemptKey, loginAttempts)
      const info = loginAttempts.get(attemptKey)!
      if (info.lockedUntil > now) {
        const remainingSeconds = Math.ceil((info.lockedUntil - now) / 1000)
        return reply.status(429).send({ 
          error: `登录失败次数过多，请 ${remainingSeconds} 秒后重试`,
          lockedUntil: info.lockedUntil,
          remainingSeconds
        })
      }
      return reply.status(401).send({ 
        error: '用户名或密码错误',
        attemptsRemaining: Math.max(0, 5 - info.count)
      })
    }
    
    // 登录成功，清除失败记录
    loginAttempts.delete(attemptKey)

    const token = generateToken(user.id, user.username)
    return { 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        settings: user.settings ? JSON.parse(user.settings) : {}
      } 
    }
  })

  // 注册
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as { username: string; password: string }
    
    if (!username || !password || password.length < 6) {
      return reply.status(400).send({ error: '用户名和密码（至少6位）不能为空' })
    }

    const db = getDb()
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    
    if (exists) {
      return reply.status(409).send({ error: '用户名已存在' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const userId = uuidv4()
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, settings)
      VALUES (?, ?, ?, '{}')
    `).run(userId, username, passwordHash)

    const token = generateToken(userId, username)
    return { 
      success: true, 
      token, 
      user: { 
        id: userId, 
        username,
        settings: {}
      } 
    }
  })

  // 获取当前用户
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ error: '未登录' })
    }
    return { success: true, user: { id: user.userId, username: user.username } }
  })

  // 验证会话
  fastify.get('/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ success: false, error: '会话已过期' })
    }
    const db = getDb()
    const dbUser = db.prepare('SELECT id, username, settings FROM users WHERE id = ?').get(user.userId) as any
    if (!dbUser) {
      return reply.status(401).send({ success: false, error: '用户不存在' })
    }
    return { 
      success: true, 
      user: { 
        id: dbUser.id, 
        username: dbUser.username,
        settings: dbUser.settings ? JSON.parse(dbUser.settings) : {}
      } 
    }
  })

  // 登出
  fastify.post('/logout', async () => {
    return { success: true }
  })
}
