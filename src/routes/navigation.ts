import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { registerAuthMiddleware, getUserId } from '../middleware/auth.js'

export async function navigationRoutes(fastify: FastifyInstance) {
  // 使用共享认证中间�?
  registerAuthMiddleware(fastify)

  // 获取所有分类和链接
  fastify.get('/', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const db = getDb()
    
    const categories = db.prepare(`
      SELECT * FROM categories WHERE user_id = ? ORDER BY "order" ASC
    `).all(userId) as any[]
    
    const links = db.prepare(`
      SELECT * FROM links WHERE user_id = ? ORDER BY "order" ASC
    `).all(userId) as any[]

    const categoriesWithLinks = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      order: cat.order,
      links: links.filter(l => l.category_id === cat.id).map(l => ({
        id: l.id,
        categoryId: cat.id,
        title: l.title,
        url: l.url,
        description: l.description,
        iconUrl: l.icon_url,
        order: l.order,
        visitCount: l.visit_count || 0,
        lastVisitedAt: l.last_visited_at || null
      }))
    }))

    return { 
      success: true, 
      data: { 
        categories: categoriesWithLinks,
        totalCategories: categoriesWithLinks.length,
        totalLinks: links.length
      } 
    }
  })

  // 创建分类
  fastify.post('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { name, order = 0 } = request.body as { name: string; order?: number }
    
    if (!name) {
      return reply.status(400).send({ success: false, error: '分类名称不能为空' })
    }

    const db = getDb()
    const id = uuidv4()
    
    db.prepare(`
      INSERT INTO categories (id, user_id, name, "order") VALUES (?, ?, ?, ?)
    `).run(id, userId, name, order)

    return { success: true, data: { id, name, order, links: [] } }
  })

  // 更新分类
  fastify.put('/categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    const { name, order } = request.body as { name?: string; order?: number }
    
    const db = getDb()
    const updates: string[] = []
    const values: any[] = []
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (order !== undefined) { updates.push('"order" = ?'); values.push(order) }
    
    if (updates.length === 0) {
      return reply.status(400).send({ success: false, error: '没有要更新的内容' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id, userId)
    
    db.prepare(`
      UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values)

    return { success: true }
  })

  // 删除分类
  fastify.delete('/categories/:id', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    
    const db = getDb()
    db.prepare('DELETE FROM links WHERE category_id = ? AND user_id = ?').run(id, userId)
    db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId)

    return { success: true }
  })

  // 分类排序
  fastify.put('/categories/reorder', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const { categoryIds } = request.body as { categoryIds: string[] }
    
    const db = getDb()
    const stmt = db.prepare('UPDATE categories SET "order" = ? WHERE id = ? AND user_id = ?')
    
    categoryIds.forEach((id, index) => {
      stmt.run(index, id, userId)
    })

    return { success: true }
  })

  // 创建链接
  fastify.post('/links', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { categoryId, title, url, description, order = 0 } = request.body as any
    
    if (!categoryId || !title || !url) {
      return reply.status(400).send({ success: false, error: '分类、标题、链接不能为�? })
    }

    const db = getDb()
    
    // 验证分类是否存在且属于当前用�?
    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(categoryId, userId)
    if (!category) {
      return reply.status(400).send({ success: false, error: '分类不存在，请先创建分类' })
    }
    
    const id = uuidv4()
    
    db.prepare(`
      INSERT INTO links (id, user_id, category_id, title, url, description, "order")
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, categoryId, title, url, description || null, order)

    return { success: true, data: { id, categoryId, title, url, description, order } }
  })

  // 更新链接
  fastify.put('/links/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    const { title, url, description, order, categoryId } = request.body as any
    
    const db = getDb()
    const updates: string[] = []
    const values: any[] = []
    
    if (title !== undefined) { updates.push('title = ?'); values.push(title) }
    if (url !== undefined) { updates.push('url = ?'); values.push(url) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (order !== undefined) { updates.push('"order" = ?'); values.push(order) }
    if (categoryId !== undefined) { updates.push('category_id = ?'); values.push(categoryId) }
    
    if (updates.length === 0) {
      return reply.status(400).send({ success: false, error: '没有要更新的内容' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id, userId)
    
    db.prepare(`
      UPDATE links SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values)

    return { success: true }
  })

  // 删除链接
  fastify.delete('/links/:id', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    
    const db = getDb()
    db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').run(id, userId)

    return { success: true }
  })

  // 链接排序
  fastify.put('/links/reorder', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { categoryId, linkIds } = request.body as { categoryId: string; linkIds: string[] }
    
    const db = getDb()
    
    // 验证目标分类存在且属于当前用�?
    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(categoryId, userId)
    if (!category) {
      return reply.status(400).send({ success: false, error: '分类不存�? })
    }
    
    const stmt = db.prepare('UPDATE links SET "order" = ?, category_id = ? WHERE id = ? AND user_id = ?')
    
    linkIds.forEach((id, index) => {
      stmt.run(index, categoryId, id, userId)
    })

    return { success: true }
  })

  // 移动链接到其他分�?
  fastify.put('/links/move', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { linkId, targetCategoryId, newOrder } = request.body as { linkId: string; targetCategoryId: string; newOrder: number }
    
    const db = getDb()
    
    // 验证目标分类存在且属于当前用�?
    const targetCategory = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(targetCategoryId, userId)
    if (!targetCategory) {
      return reply.status(400).send({ success: false, error: '目标分类不存�? })
    }
    
    db.prepare('UPDATE links SET category_id = ?, "order" = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
      .run(targetCategoryId, newOrder, linkId, userId)

    const link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(linkId, userId)
    return { success: true, data: link }
  })

  // 记录链接访问
  fastify.post('/links/:id/visit', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { id } = request.params as { id: string }
    
    const db = getDb()
    
    // 验证链接存在且属于当前用�?
    const link = db.prepare('SELECT id, visit_count FROM links WHERE id = ? AND user_id = ?').get(id, userId) as any
    if (!link) {
      return reply.status(404).send({ success: false, error: '链接不存�? })
    }
    
    const newVisitCount = (link.visit_count || 0) + 1
    const now = new Date().toISOString()
    
    db.prepare(`
      UPDATE links SET visit_count = ?, last_visited_at = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `).run(newVisitCount, now, id, userId)

    return { 
      success: true, 
      data: { 
        visit_count: newVisitCount, 
        last_visited_at: now 
      } 
    }
  })

  // 批量删除所有导航数据（分类和链接）
  fastify.delete('/all', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const db = getDb()
    
    db.prepare('DELETE FROM links WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(userId)

    return { success: true }
  })
}
