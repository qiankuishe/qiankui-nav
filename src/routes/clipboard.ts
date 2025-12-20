import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { getAuthUser } from '../auth.js'

export async function clipboardRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    ;(request as any).user = user
  })

  // 获取所有剪贴板项目
  fastify.get('/items', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const { type } = request.query as { type?: string }
    const db = getDb()
    
    let sql = 'SELECT * FROM clipboard_items WHERE user_id = ?'
    const params: any[] = [userId]
    
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    
    sql += ' ORDER BY updated_at DESC'
    const items = db.prepare(sql).all(...params)

    return { data: items }
  })

  // 获取单个剪贴板项目
  fastify.get('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { id } = request.params as { id: string }
    const db = getDb()
    
    const item = db.prepare('SELECT * FROM clipboard_items WHERE id = ? AND user_id = ?').get(id, userId)
    
    if (!item) {
      return reply.status(404).send({ error: 'Clipboard item not found' })
    }

    return { data: item }
  })

  // 创建剪贴板项目
  fastify.post('/items', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { type, title, content } = request.body as { type?: string; title?: string; content?: string }
    
    if (!type || !title) {
      return reply.status(400).send({ error: 'Type and title are required' })
    }
    
    if (!['text', 'code', 'image'].includes(type)) {
      return reply.status(400).send({ error: 'Type must be text, code, or image' })
    }

    const db = getDb()
    const id = uuidv4()
    
    db.prepare(`
      INSERT INTO clipboard_items (id, user_id, type, title, content) VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, type, title, content || '')

    const item = db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id)
    return reply.status(201).send({ data: item })
  })

  // 更新剪贴板项目
  fastify.put('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { id } = request.params as { id: string }
    const { title, content } = request.body as { title?: string; content?: string }
    const db = getDb()
    
    const updates: string[] = []
    const values: any[] = []
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (content !== undefined) { updates.push('content = ?'); values.push(content) }
    
    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No updates provided' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id, userId)
    
    const result = db.prepare(`
      UPDATE clipboard_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values)

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Clipboard item not found' })
    }

    const item = db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id)
    return { data: item }
  })

  // 删除剪贴板项目
  fastify.delete('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { id } = request.params as { id: string }
    const db = getDb()
    
    const result = db.prepare('DELETE FROM clipboard_items WHERE id = ? AND user_id = ?').run(id, userId)
    
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Clipboard item not found' })
    }

    return reply.status(204).send()
  })

  // 搜索剪贴板项目
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { q, type } = request.query as { q?: string; type?: string }
    
    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: 'Search query is required' })
    }

    const db = getDb()
    let sql = 'SELECT * FROM clipboard_items WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)'
    const searchTerm = `%${q.trim()}%`
    const params: any[] = [userId, searchTerm, searchTerm]
    
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    
    sql += ' ORDER BY updated_at DESC'
    const items = db.prepare(sql).all(...params)

    return { data: items }
  })
}
