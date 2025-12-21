import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { getAuthUser } from '../auth.js'

export async function notesRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ success: false, error: '未登录' })
    }
    ;(request as any).user = user
  })

  // 获取所有笔记
  fastify.get('/', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const db = getDb()
    
    const notes = db.prepare(`
      SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC
    `).all(userId)

    return { success: true, data: notes }
  })

  // 获取单个笔记
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { id } = request.params as { id: string }
    const db = getDb()
    
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId)
    
    if (!note) {
      return reply.status(404).send({ success: false, error: '笔记不存在' })
    }

    return { success: true, data: note }
  })

  // 创建笔记
  fastify.post('/', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const { title, content } = request.body as { title: string; content?: string }
    const db = getDb()
    
    const id = uuidv4()
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)
    `).run(id, userId, title || '无标题', content || '')

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
    return { success: true, data: note }
  })

  // 更新笔记
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { id } = request.params as { id: string }
    const { title, content } = request.body as { title?: string; content?: string }
    const db = getDb()
    
    const updates: string[] = []
    const values: any[] = []
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (content !== undefined) { updates.push('content = ?'); values.push(content) }
    
    if (updates.length === 0) {
      return reply.status(400).send({ success: false, error: '没有要更新的内容' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id, userId)
    
    db.prepare(`
      UPDATE notes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values)

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
    return { success: true, data: note }
  })

  // 删除笔记
  fastify.delete('/:id', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const { id } = request.params as { id: string }
    const db = getDb()
    
    db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, userId)
    return { success: true }
  })

  // 批量删除所有笔记
  fastify.delete('/all/items', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const db = getDb()
    
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId)
    return { success: true }
  })
}
