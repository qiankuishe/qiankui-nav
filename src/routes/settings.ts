import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { registerAuthMiddleware, getUserId } from '../middleware/auth.js'

export async function settingsRoutes(fastify: FastifyInstance) {
  // 使用共享认证中间件
  registerAuthMiddleware(fastify)

  // 获取用户设置
  fastify.get('/', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const db = getDb()
    
    const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any
    const settings = user?.settings ? JSON.parse(user.settings) : {}

    return { success: true, data: settings }
  })

  // 更新用户设置
  fastify.put('/', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const newSettings = request.body as Record<string, any>
    const db = getDb()
    
    const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any
    const currentSettings = user?.settings ? JSON.parse(user.settings) : {}
    const mergedSettings = { ...currentSettings, ...newSettings }
    
    db.prepare('UPDATE users SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(mergedSettings), userId)

    return { success: true, data: mergedSettings }
  })

  // 导出用户数据
  fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const db = getDb()
    
    const user = db.prepare('SELECT username, settings FROM users WHERE id = ?').get(userId) as any
    const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY "order"').all(userId) as any[]
    const links = db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY "order"').all(userId) as any[]
    const notes = db.prepare('SELECT * FROM notes WHERE user_id = ?').all(userId) as any[]
    const clipboardItems = db.prepare('SELECT * FROM clipboard_items WHERE user_id = ?').all(userId) as any[]

    const categoriesWithLinks = categories.map(cat => ({
      ...cat,
      links: links.filter(l => l.category_id === cat.id)
    }))

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      user: {
        username: user.username,
        settings: user.settings ? JSON.parse(user.settings) : {}
      },
      categories: categoriesWithLinks,
      notes,
      clipboard_items: clipboardItems
    }

    reply.header('Content-Type', 'application/json')
    reply.header('Content-Disposition', `attachment; filename="navigation-backup-${new Date().toISOString().split('T')[0]}.json"`)
    
    return { success: true, data: exportData }
  })

  // 导入用户数据
  fastify.post('/import', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const importData = request.body as any
    const db = getDb()
    
    const imported = { categories: 0, links: 0, notes: 0, clipboard_items: 0 }
    const errors: string[] = []

    // 使用事务保护，确保数据一致性
    const transaction = db.transaction(() => {
      // 导入分类和链接
      if (importData.categories && Array.isArray(importData.categories)) {
        for (const cat of importData.categories) {
          try {
            const catId = uuidv4()
            db.prepare(`
              INSERT INTO categories (id, user_id, name, "order") VALUES (?, ?, ?, ?)
            `).run(catId, userId, cat.name, cat.order || 0)
            imported.categories++

            if (cat.links && Array.isArray(cat.links)) {
              for (const link of cat.links) {
                const linkId = uuidv4()
                db.prepare(`
                  INSERT INTO links (id, user_id, category_id, title, url, description, "order")
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(linkId, userId, catId, link.title, link.url, link.description || null, link.order || 0)
                imported.links++
              }
            }
          } catch (e) {
            errors.push(`导入分类失败: ${cat.name}`)
            throw e // 事务中抛出错误会触发回滚
          }
        }
      }

      // 导入笔记
      if (importData.notes && Array.isArray(importData.notes)) {
        for (const note of importData.notes) {
          try {
            db.prepare(`
              INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)
            `).run(uuidv4(), userId, note.title, note.content || '')
            imported.notes++
          } catch (e) {
            errors.push(`导入笔记失败: ${note.title}`)
            throw e
          }
        }
      }

      // 导入剪贴板
      if (importData.clipboard_items && Array.isArray(importData.clipboard_items)) {
        for (const item of importData.clipboard_items) {
          try {
            db.prepare(`
              INSERT INTO clipboard_items (id, user_id, type, title, content) VALUES (?, ?, ?, ?, ?)
            `).run(uuidv4(), userId, item.type || 'text', item.title, item.content || '')
            imported.clipboard_items++
          } catch (e) {
            errors.push(`导入剪贴板失败: ${item.title}`)
            throw e
          }
        }
      }

      // 更新设置
      if (importData.user?.settings) {
        db.prepare('UPDATE users SET settings = ? WHERE id = ?')
          .run(JSON.stringify(importData.user.settings), userId)
      }
    })

    try {
      transaction()
      return {
        success: true,
        message: '导入完成',
        imported,
        errors: []
      }
    } catch (error) {
      return reply.status(400).send({
        success: false,
        message: '导入失败，已回滚所有更改',
        imported: { categories: 0, links: 0, notes: 0, clipboard_items: 0 },
        errors: [...errors, String(error)]
      })
    }
  })

  // 更新账号凭证
  fastify.put('/credentials', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request)
    const { currentPassword, newPassword, newUsername } = request.body as { 
      currentPassword: string
      newPassword?: string
      newUsername?: string 
    }
    
    if (!currentPassword) {
      return reply.status(400).send({ success: false, error: '请输入当前密码' })
    }
    
    if (!newPassword && !newUsername) {
      return reply.status(400).send({ success: false, error: '请输入新密码或新用户名' })
    }
    
    if (newPassword && newPassword.length < 6) {
      return reply.status(400).send({ success: false, error: '新密码至少6位' })
    }
    
    if (newUsername && newUsername.length < 2) {
      return reply.status(400).send({ success: false, error: '用户名至少2位' })
    }

    const db = getDb()
    const user = db.prepare('SELECT password_hash, username FROM users WHERE id = ?').get(userId) as any
    
    if (!user) {
      return reply.status(404).send({ success: false, error: '用户不存在' })
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isValid) {
      return reply.status(400).send({ success: false, error: '当前密码错误' })
    }

    if (newUsername && newUsername !== user.username) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, userId)
      if (existing) {
        return reply.status(400).send({ success: false, error: '用户名已存在' })
      }
    }

    const updates: string[] = []
    const params: any[] = []
    
    if (newPassword) {
      const newHash = await bcrypt.hash(newPassword, 10)
      updates.push('password_hash = ?')
      params.push(newHash)
    }
    
    if (newUsername) {
      updates.push('username = ?')
      params.push(newUsername)
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(userId)
    
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    const messages: string[] = []
    if (newPassword) messages.push('密码')
    if (newUsername) messages.push('用户名')
    
    return { 
      success: true,
      message: `${messages.join('和')}修改成功`,
      username: newUsername || user.username
    }
  })

  // 导出统计
  fastify.get('/export/stats', async (request: FastifyRequest) => {
    const userId = getUserId(request)
    const db = getDb()
    
    const categoriesCount = (db.prepare('SELECT COUNT(*) as count FROM categories WHERE user_id = ?').get(userId) as any).count
    const linksCount = (db.prepare('SELECT COUNT(*) as count FROM links WHERE user_id = ?').get(userId) as any).count
    const notesCount = (db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(userId) as any).count
    const clipboardCount = (db.prepare('SELECT COUNT(*) as count FROM clipboard_items WHERE user_id = ?').get(userId) as any).count

    return {
      success: true,
      data: {
        categories: categoriesCount,
        links: linksCount,
        notes: notesCount,
        clipboard_items: clipboardCount
      }
    }
  })
}
