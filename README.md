# qiankui-nav

轻量级个人导航页，支持书签管理、笔记、剪贴板。单 Docker 镜像部署，SQLite 存储。

## 功能

- 📑 书签分类管理，支持拖拽排序
- 📝 笔记
- 📋 剪贴板（文本/代码/图片）
- ⚙️ 网站设置、账号管理
- 📤 数据导入导出

## 快速部署

```bash
docker run -d \
  --name qiankui-nav \
  -p 3001:3001 \
  -v qiankui-data:/app/data \
  ghcr.io/qiankuishe/qiankui-nav:latest
```

或使用 Docker Compose：

```yaml
services:
  qiankui-nav:
    image: ghcr.io/qiankuishe/qiankui-nav:latest
    ports:
      - "3001:3001"
    volumes:
      - qiankui-data:/app/data
    restart: unless-stopped

volumes:
  qiankui-data:
```

## 默认账号

- 用户名: `admin`
- 密码: `admin123`

首次登录后请修改密码。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 端口 | 3001 |
| `JWT_SECRET` | JWT 密钥 | 随机生成 |

## License

MIT
