import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getAuthUser } from '../auth.js'

/**
 * 共享认证中间件
 * 验证用户登录状态，将用户信息附加到 request.user
 */
export function registerAuthMiddleware(fastify: FastifyInstance, options?: { exclude?: string[] }) {
  const excludePaths = options?.exclude || []
  
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 检查是否在排除列表中
    if (excludePaths.some(path => request.url.includes(path))) {
      return
    }
    
    const user = getAuthUser(request)
    if (!user) {
      return reply.status(401).send({ success: false, error: '未登录' })
    }
    ;(request as any).user = user
  })
}

/**
 * 获取当前用户 ID
 */
export function getUserId(request: FastifyRequest): string {
  return (request as any).user.userId
}
