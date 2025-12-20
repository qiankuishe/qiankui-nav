import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { generateToken, getAuthUser } from '../auth.js'

export async function authRoutes(fastify: FastifyInstance) {
  // 登录
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as { username: string; password: string }
    
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password required' })
    }

    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
    
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = generateToken(user.id, user.username)
    return { token, user: { id: user.id, username: user.username } }
  })

  // 注册
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as { username: string; password: string }
    
    if (!username || !password || password.length < 6) {
      return reply.status(400).send({ error: 'Username and password (min 6 chars) required' })
    }

    const db = getDb()
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    
    if (exists) {
      return reply.status(409).send({ error: 'Username already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const userId = uuidv4()
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, settings)
      VALUES (?, ?, ?, '{}')
    `).run(userId, username, passwordHash)

    const token = generateToken(userId, username)
    return { token, user: { id: userId, username } }
  })

  // 获取当前用户
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    return { user: { id: user.userId, username: user.username } }
  })

  // 登出
  fastify.post('/logout', async () => {
    return { success: true }
  })
}
