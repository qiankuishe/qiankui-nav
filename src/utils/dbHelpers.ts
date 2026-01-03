import { getDb } from '../db.js'

interface UpdateField {
  field: string
  value: any
  condition?: boolean
}

/**
 * 构建动态 UPDATE SQL
 * @param table 表名
 * @param fields 要更新的字段
 * @param whereClause WHERE 条件（不含 WHERE 关键字）
 * @param whereParams WHERE 参数
 * @returns 是否有更新
 */
export function buildDynamicUpdate(
  table: string,
  fields: UpdateField[],
  whereClause: string,
  whereParams: any[]
): { hasUpdates: boolean; execute: () => void } {
  const updates: string[] = []
  const values: any[] = []
  
  for (const { field, value, condition = true } of fields) {
    if (condition && value !== undefined) {
      // 处理带引号的字段名（如 "order"）
      updates.push(`${field} = ?`)
      values.push(value)
    }
  }
  
  if (updates.length === 0) {
    return { hasUpdates: false, execute: () => {} }
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP')
  
  const sql = `UPDATE ${table} SET ${updates.join(', ')} WHERE ${whereClause}`
  const db = getDb()
  
  return {
    hasUpdates: true,
    execute: () => db.prepare(sql).run(...values, ...whereParams)
  }
}
