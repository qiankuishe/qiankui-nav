import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { generateToken, getAuthUser } from '../auth.js'

// 限制配置
const RATE_LIMIT_CONFIG = {
  ip: {
    maxAttempts: 20,      // IP 最大失败次数
    lockDuration: 30 * 60 * 1000,  // 锁定 30 分钟
    resetPeriod: 60 * 60 * 1000,   // 1 小时后重置计数
  },
  username: {
    maxAttempts: 5,       // 用户名最大失败次数
    lockDuration: 5 * 60 * 1000,   // 锁定 5 分钟
    resetPeriod: 30 * 60 * 1000,   // 30 分钟后重置计数
  }
}

interface AttemptRecord {
  count: number
  firstAttempt: number
  lockedUntil: number
}

// 双重限制器
class LoginRateLimiter {
  private ipAttempts = new Map<string, AttemptRecord>()
  private usernameAttempts = new Map<string, AttemptRecord>()

  // 检查是否被锁定，返回锁定信息
  checkLocked(ip: string, username: string): { locked: boolean; type?: 'ip' | 'username'; remainingSeconds?: number } {
    const now = Date.now()
    
    // 检查 IP 锁定
    const ipRecord = this.ipAttempts.get(ip)
    if (ipRecord && ipRecord.lockedUntil > now) {
      return {
        locked: true,
        type: 'ip',
        remainingSeconds: Math.ceil((ipRecord.lockedUntil - now) / 1000)
      }
    }
    
    // 检查用户名锁定
    const userRecord = this.usernameAttempts.get(username.toLowerCase())
    if (userRecord && userRecord.lockedUntil > now) {
      return {
        locked: true,
        type: 'username',
        remainingSeconds: Math.ceil((userRecord.lockedUntil - now) / 1000)
      }
    }
    
    return { locked: false }
  }

  // 记录失败尝试
  recordFailure(ip: string, username: string): { 
    ipAttemptsRemaining: number
    usernameAttemptsRemaining: number
    newlyLocked?: 'ip' | 'username'
    lockSeconds?: number
  } {
    const now = Date.now()
    const usernameLower = username.toLowerCase()
    
    // 更新 IP 记录
    const ipRecord = this.getOrCreateRecord(this.ipAttempts, ip, RATE_LIMIT_CONFIG.ip.resetPeriod)
    ipRecord.count++
    let newlyLocked: 'ip' | 'username' | undefined
    let lockSeconds: number | undefined
    
    if (ipRecord.count >= RATE_LIMIT_CONFIG.ip.maxAttempts) {
      ipRecord.lockedUntil = now + RATE_LIMIT_CONFIG.ip.lockDuration
      newlyLocked = 'ip'
      lockSeconds = RATE_LIMIT_CONFIG.ip.lockDuration / 1000
    }
    
    // 更新用户名记录
    const userRecord = this.getOrCreateRecord(this.usernameAttempts, usernameLower, RATE_LIMIT_CONFIG.username.resetPeriod)
    userRecord.count++
    
    if (userRecord.count >= RATE_LIMIT_CONFIG.username.maxAttempts && !newlyLocked) {
      userRecord.lockedUntil = now + RATE_LIMIT_CONFIG.username.lockDuration
      newlyLocked = 'username'
      lockSeconds = RATE_LIMIT_CONFIG.username.lockDuration / 1000
    }
    
    return {
      ipAttemptsRemaining: Math.max(0, RATE_LIMIT_CONFIG.ip.maxAttempts - ipRecord.count),
      usernameAttemptsRemaining: Math.max(0, RATE_LIMIT_CONFIG.username.maxAttempts - userRecord.count),
      newlyLocked,
      lockSeconds
    }
  }

  // 登录成功后清除用户名计数（IP 计数保留）
  clearUsernameAttempts(username: string) {
    this.usernameAttempts.delete(username.toLowerCase())
  }

  private getOrCreateRecord(
    map: Map<string, AttemptRecord>, 
    key: string, 
    resetPeriod: number
  ): AttemptRecord {
    const now = Date.now()
    const existing = map.get(key)
    
    // 如果记录不存在或已过期，创建新记录
    if (!existing || now - existing.firstAttempt > resetPeriod) {
      const newRecord: AttemptRecord = { count: 0, firstAttempt: now, lockedUntil: 0 }
      map.set(key, newRecord)
      return newRecord
    }
    
    return existing
  }

  // 定期清理过期记录（可选，防止内存泄漏）
  cleanup() {
    const now = Date.now()
    
    for (const [key, record] of this.ipAttempts) {
      if (now - record.firstAttempt > RATE_LIMIT_CONFIG.ip.resetPeriod && record.lockedUntil < now) {
        this.ipAttempts.delete(key)
      }
    }
    
    for (const [key, record] of this.usernameAttempts) {
      if (now - record.firstAttempt > RATE_LIMIT_CONFIG.username.resetPeriod && record.lockedUntil < now) {
        this.usernameAttempts.delete(key)
      }
    }
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  const rateLimiter = new LoginRateLimiter()
  
  // 每 10 分钟清理一次过期记录
  setInterval(() => rateLimiter.cleanup(), 10 * 60 * 1000)
  
  // 登录
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as { username: string; password: string }
    const clientIp = request.ip || 'unknown'
    
    if (!username || !password) {
      return reply.status(400).send({ success: false, error: '请输入用户名和密码' })
    }

    // 检查是否被锁定
    const lockStatus = rateLimiter.checkLocked(clientIp, username)
    if (lockStatus.locked) {
      const message = lockStatus.type === 'ip' 
        ? `当前 IP 请求过于频繁，请 ${lockStatus.remainingSeconds} 秒后重试`
        : `该账号已被临时锁定，请 ${lockStatus.remainingSeconds} 秒后重试`
      
      return reply.status(429).send({ 
        success: false,
        error: message,
        lockType: lockStatus.type,
        remainingSeconds: lockStatus.remainingSeconds
      })
    }

    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
    
    if (!user) {
      const result = rateLimiter.recordFailure(clientIp, username)
      return buildFailureResponse(reply, result)
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      const result = rateLimiter.recordFailure(clientIp, username)
      return buildFailureResponse(reply, result)
    }
    
    // 登录成功，清除用户名失败记录
    rateLimiter.clearUsernameAttempts(username)

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
      return reply.status(400).send({ success: false, error: '用户名和密码（至少6位）不能为空' })
    }

    const db = getDb()
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    
    if (exists) {
      return reply.status(409).send({ success: false, error: '用户名已存在' })
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
      return reply.status(401).send({ success: false, error: '未登录' })
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

// 构建失败响应
function buildFailureResponse(
  reply: FastifyReply, 
  result: { 
    ipAttemptsRemaining: number
    usernameAttemptsRemaining: number
    newlyLocked?: 'ip' | 'username'
    lockSeconds?: number
  }
) {
  // 如果刚刚触发锁定
  if (result.newlyLocked) {
    const message = result.newlyLocked === 'ip'
      ? `请求过于频繁，请 ${result.lockSeconds} 秒后重试`
      : `登录失败次数过多，账号已锁定 ${result.lockSeconds} 秒`
    
    return reply.status(429).send({
      success: false,
      error: message,
      lockType: result.newlyLocked,
      remainingSeconds: result.lockSeconds
    })
  }
  
  // 普通失败，显示剩余次数（取较小值）
  const attemptsRemaining = Math.min(result.ipAttemptsRemaining, result.usernameAttemptsRemaining)
  
  return reply.status(401).send({ 
    success: false,
    error: '用户名或密码错误',
    attemptsRemaining
  })
}
