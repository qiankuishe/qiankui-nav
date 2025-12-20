import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcrypt'
import { getDb } from '../db.js'
import { getAuthUser } from '../auth.js'

export async function settingsRoutes(fastify: FastifyInstance) {
  // 认证中间件
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    ;(request as any).user = user
  })

  // 获取用户设置
  fastify.get('/settings', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const db = getDb()
    
    const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any
    const settings = user?.settings ? JSON.parse(user.settings) : {}

    return settings
  })

  // 更新用户设置
  fastify.put('/settings', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const newSettings = request.body as Record<string, any>
    const db = getDb()
    
    const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as any
    const currentSettings = user?.settings ? JSON.parse(user.settings) : {}
    const mergedSettings = { ...currentSettings, ...newSettings }
    
    db.prepare('UPDATE users SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(mergedSettings), userId)

    return mergedSettings
  })

  // 导出用户数据
  fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
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
    
    return exportData
  })

  // 导入用户数据
  fastify.post('/import', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const importData = request.body as any
    const db = getDb()
    
    const imported = { categories: 0, links: 0, notes: 0, clipboard_items: 0 }
    const errors: string[] = []

    try {
      // 导入分类和链接
      if (importData.categories && Array.isArray(importData.categories)) {
        for (const cat of importData.categories) {
          try {
            const { v4: uuidv4 } = await import('uuid')
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
            errors.push(`Failed to import category: ${cat.name}`)
          }
        }
      }

      // 导入笔记
      if (importData.notes && Array.isArray(importData.notes)) {
        for (const note of importData.notes) {
          try {
            const { v4: uuidv4 } = await import('uuid')
            db.prepare(`
              INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)
            `).run(uuidv4(), userId, note.title, note.content || '')
            imported.notes++
          } catch (e) {
            errors.push(`Failed to import note: ${note.title}`)
          }
        }
      }

      // 导入剪贴板
      if (importData.clipboard_items && Array.isArray(importData.clipboard_items)) {
        for (const item of importData.clipboard_items) {
          try {
            const { v4: uuidv4 } = await import('uuid')
            db.prepare(`
              INSERT INTO clipboard_items (id, user_id, type, title, content) VALUES (?, ?, ?, ?, ?)
            `).run(uuidv4(), userId, item.type || 'text', item.title, item.content || '')
            imported.clipboard_items++
          } catch (e) {
            errors.push(`Failed to import clipboard item: ${item.title}`)
          }
        }
      }

      // 更新设置
      if (importData.user?.settings) {
        db.prepare('UPDATE users SET settings = ? WHERE id = ?')
          .run(JSON.stringify(importData.user.settings), userId)
      }

      return {
        success: true,
        message: 'Import completed',
        imported,
        errors
      }
    } catch (error) {
      return reply.status(400).send({
        success: false,
        message: 'Import failed',
        imported,
        errors: [...errors, String(error)]
      })
    }
  })

  // 更新密码
  fastify.put('/credentials', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.userId
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string }
    
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Current password and new password are required' })
    }
    
    if (newPassword.length < 6) {
      return reply.status(400).send({ error: 'New password must be at least 6 characters' })
    }

    const db = getDb()
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any
    
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isValid) {
      return reply.status(400).send({ error: 'Current password is incorrect' })
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, userId)

    return { message: 'Password updated successfully' }
  })

  // 导出统计
  fastify.get('/export/stats', async (request: FastifyRequest) => {
    const userId = (request as any).user.userId
    const db = getDb()
    
    const categoriesCount = (db.prepare('SELECT COUNT(*) as count FROM categories WHERE user_id = ?').get(userId) as any).count
    const linksCount = (db.prepare('SELECT COUNT(*) as count FROM links WHERE user_id = ?').get(userId) as any).count
    const notesCount = (db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(userId) as any).count
    const clipboardCount = (db.prepare('SELECT COUNT(*) as count FROM clipboard_items WHERE user_id = ?').get(userId) as any).count

    return {
      categories: categoriesCount,
      links: linksCount,
      notes: notesCount,
      clipboard_items: clipboardCount
    }
  })
}
