import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { registerAuthMiddleware, getUserId } from '../middleware/auth.js'

export async function clipboardRoutes(fastify: FastifyInstance) {
  // 公开 API：获取公开便签（无需认证�?
  fastify.get('/public/stickers', async () => {
    const db = getDb()
    const items = db.prepare(`
      SELECT id, type, title, content, updated_at 
      FROM clipboard_items 
      WHERE is_public = 1 
      ORDER BY updated_at DESC 
      LIMIT 16
    `).all()
    return { success: true, data: items }
  })

  // 使用共享认证中间件（排除公开 API�?
  registerAuthMiddleware(fastify, { exclude: ['/public/'] })

  // 获取所有剪贴板项目
  fastify.get('/items', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const { type } = request.query as { type?: string }
    const db = getDb()
    
    let sql = 'SELECT * FROM clipboard_items WHERE user_id = ?'
    const params: any[] = [userId]
    
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    
    sql += ' ORDER BY created_at DESC'
    const items = db.prepare(sql).all(...params)

    return { success: true, data: items }
  })

  // 获取单个剪贴板项�?
  fastify.get('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    const db = getDb()
    
    const item = db.prepare('SELECT * FROM clipboard_items WHERE id = ? AND user_id = ?').get(id, userId)
    
    if (!item) {
      return reply.status(404).send({ success: false, error: '剪贴板项目不存在' })
    }

    return { success: true, data: item }
  })

  // 创建剪贴板项�?
  fastify.post('/items', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { type, title, content, is_public } = request.body as { type?: string; title?: string; content?: string; is_public?: number }
    
    if (!type) {
      return reply.status(400).send({ success: false, error: '类型不能为空' })
    }
    
    if (!['text', 'code', 'image'].includes(type)) {
      return reply.status(400).send({ success: false, error: '类型必须�?text、code �?image' })
    }

    const finalTitle = title || (type === 'code' ? '代码片段' : type === 'image' ? '图片' : '文本')

    const db = getDb()
    const id = uuidv4()
    
    db.prepare(`
      INSERT INTO clipboard_items (id, user_id, type, title, content, is_public) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, finalTitle, content || '', is_public ? 1 : 0)

    const item = db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id)
    return reply.status(201).send({ success: true, data: item })
  })

  // 更新剪贴板项�?
  fastify.put('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    const { title, content, is_public } = request.body as { title?: string; content?: string; is_public?: number }
    const db = getDb()
    
    const updates: string[] = []
    const values: any[] = []
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (content !== undefined) { updates.push('content = ?'); values.push(content) }
    if (is_public !== undefined) { updates.push('is_public = ?'); values.push(is_public ? 1 : 0) }
    
    if (updates.length === 0) {
      return reply.status(400).send({ success: false, error: '没有要更新的内容' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id, userId)
    
    const result = db.prepare(`
      UPDATE clipboard_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values)

    if (result.changes === 0) {
      return reply.status(404).send({ success: false, error: '剪贴板项目不存在' })
    }

    const item = db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id)
    return { success: true, data: item }
  })

  // 删除剪贴板项�?
  fastify.delete('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    const db = getDb()
    
    const result = db.prepare('DELETE FROM clipboard_items WHERE id = ? AND user_id = ?').run(id, userId)
    
    if (result.changes === 0) {
      return reply.status(404).send({ success: false, error: '剪贴板项目不存在' })
    }

    return { success: true }
  })

  // 搜索剪贴板项�?
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { q, type } = request.query as { q?: string; type?: string }
    
    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ success: false, error: '搜索关键词不能为�? })
    }

    const db = getDb()
    let sql = 'SELECT * FROM clipboard_items WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)'
    const searchTerm = `%${q.trim()}%`
    const params: any[] = [userId, searchTerm, searchTerm]
    
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    
    sql += ' ORDER BY created_at DESC'
    const items = db.prepare(sql).all(...params)

    return { success: true, data: items }
  })

  // 批量删除所有剪贴板项目
  fastify.delete('/all/items', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const db = getDb()
    
    db.prepare('DELETE FROM clipboard_items WHERE user_id = ?').run(userId)
    return { success: true }
  })
}
