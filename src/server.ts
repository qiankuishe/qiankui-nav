import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase, getDb } from './db.js'
import { authRoutes } from './routes/auth.js'
import { navigationRoutes } from './routes/navigation.js'
import { notesRoutes } from './routes/notes.js'
import { clipboardRoutes } from './routes/clipboard.js'
import { settingsRoutes } from './routes/settings.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const fastify = Fastify({ logger: true })

async function start() {
  // 初始化数据库
  await initDatabase()

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true
  })

  // 静态文件服务 (前端)
  const publicPath = path.join(__dirname, '..', 'public')
  await fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: '/'
  })

  // API 路由
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(navigationRoutes, { prefix: '/api/navigation' })
  await fastify.register(notesRoutes, { prefix: '/api/notes' })
  await fastify.register(clipboardRoutes, { prefix: '/api/clipboard' })
  await fastify.register(settingsRoutes, { prefix: '/api/settings' })

  // 健康检查
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // 公开设置 (无需认证) - 从数据库读取第一个用户的设置
  fastify.get('/api/settings/public', async () => {
    const db = getDb()
    const user = db.prepare('SELECT settings FROM users LIMIT 1').get() as any
    const settings = user?.settings ? JSON.parse(user.settings) : {}
    return {
      website_name: settings.website_name || 'qiankui导航',
      logo_url: settings.logo_url || '',
      theme: settings.theme || 'light',
      version: '1.0.0'
    }
  })

  // SPA 路由回退
  fastify.setNotFoundHandler(async (request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply.sendFile('index.html')
    }
    return reply.status(404).send({ error: '页面不存在' })
  })

  const port = parseInt(process.env.PORT || '3001')
  const host = process.env.HOST || '0.0.0.0'

  await fastify.listen({ port, host })
  console.log(`🚀 Server running at http://${host}:${port}`)
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
