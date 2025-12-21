# qiankui-nav

个人导航页，集成书签、笔记、剪贴板管理。

## 部署

```bash
docker run -d \
  --name qiankui-nav \
  -p 3001:3001 \
  -v qiankui-data:/app/data \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  ghcr.io/qiankuishe/qiankui-nav:latest
```

Docker Compose:

```yaml
services:
  qiankui-nav:
    image: ghcr.io/qiankuishe/qiankui-nav:latest
    ports:
      - "3001:3001"
    volumes:
      - qiankui-data:/app/data
    environment:
      - JWT_SECRET=your-random-secret-key
    restart: unless-stopped

volumes:
  qiankui-data:
```

## 配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PORT` | 服务端口 | 3001 |
| `JWT_SECRET` | JWT 签名密钥 | 随机生成 |
| `CORS_ORIGINS` | 允许跨域来源（逗号分隔） | * |

## 默认账号

`admin` / `admin123`

⚠️ 首次登录后请修改密码

## 安全

- 生产环境必须设置 `JWT_SECRET`
- 建议通过反向代理配置 HTTPS
- 定期备份 `/app/data` 目录

## 技术栈

- 前端: React + TypeScript + Tailwind CSS + dnd-kit
- 后端: Fastify + better-sqlite3
- 部署: Docker 单镜像

## License

MIT
