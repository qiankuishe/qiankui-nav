import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

// 模拟数据库操作进行单元测试
describe('Visit Statistics', () => {
  let db: Database.Database
  let userId: string
  let categoryId: string
  let linkId: string

  beforeAll(() => {
    // 创建内存数据库用于测试
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')

    // 创建表结构
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        "order" INTEGER DEFAULT 0
      );

      CREATE TABLE links (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        visit_count INTEGER DEFAULT 0,
        last_visited_at DATETIME,
        "order" INTEGER DEFAULT 0
      );
    `)

    // 创建测试数据
    userId = uuidv4()
    categoryId = uuidv4()
    linkId = uuidv4()

    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, 'testuser', 'hash')
    db.prepare('INSERT INTO categories (id, user_id, name) VALUES (?, ?, ?)').run(categoryId, userId, 'Test Category')
    db.prepare('INSERT INTO links (id, user_id, category_id, title, url) VALUES (?, ?, ?, ?, ?)').run(linkId, userId, categoryId, 'Test Link', 'https://example.com')
  })

  afterAll(() => {
    db.close()
  })

  it('should increment visit_count by 1 on each visit', () => {
    // 获取初始值
    const before = db.prepare('SELECT visit_count FROM links WHERE id = ?').get(linkId) as any
    expect(before.visit_count).toBe(0)

    // 模拟访问
    const newCount = (before.visit_count || 0) + 1
    db.prepare('UPDATE links SET visit_count = ? WHERE id = ?').run(newCount, linkId)

    // 验证递增
    const after = db.prepare('SELECT visit_count FROM links WHERE id = ?').get(linkId) as any
    expect(after.visit_count).toBe(1)

    // 再次访问
    db.prepare('UPDATE links SET visit_count = visit_count + 1 WHERE id = ?').run(linkId)
    const afterSecond = db.prepare('SELECT visit_count FROM links WHERE id = ?').get(linkId) as any
    expect(afterSecond.visit_count).toBe(2)
  })

  it('should update last_visited_at timestamp on visit', () => {
    const before = db.prepare('SELECT last_visited_at FROM links WHERE id = ?').get(linkId) as any
    expect(before.last_visited_at).toBeNull()

    // 模拟访问
    const now = new Date().toISOString()
    db.prepare('UPDATE links SET last_visited_at = ? WHERE id = ?').run(now, linkId)

    // 验证时间戳更新
    const after = db.prepare('SELECT last_visited_at FROM links WHERE id = ?').get(linkId) as any
    expect(after.last_visited_at).toBe(now)
  })

  it('should return visit statistics in link query', () => {
    // 设置测试数据
    db.prepare('UPDATE links SET visit_count = 5, last_visited_at = ? WHERE id = ?').run('2025-01-03T10:00:00.000Z', linkId)

    // 查询链接
    const link = db.prepare('SELECT id, title, url, visit_count, last_visited_at FROM links WHERE id = ?').get(linkId) as any

    expect(link.visit_count).toBe(5)
    expect(link.last_visited_at).toBe('2025-01-03T10:00:00.000Z')
  })

  it('should handle multiple visits correctly', () => {
    // 重置
    db.prepare('UPDATE links SET visit_count = 0 WHERE id = ?').run(linkId)

    // 模拟多次访问
    for (let i = 0; i < 10; i++) {
      db.prepare('UPDATE links SET visit_count = visit_count + 1 WHERE id = ?').run(linkId)
    }

    const link = db.prepare('SELECT visit_count FROM links WHERE id = ?').get(linkId) as any
    expect(link.visit_count).toBe(10)
  })
})
