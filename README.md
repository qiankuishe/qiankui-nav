# qiankui-nav

🚀 A lightweight self-hosted navigation page with bookmarks, notes, and clipboard. Single Docker image, SQLite storage, zero external dependencies.

轻量级自托管导航页，支持书签分类、笔记、剪贴板。单镜像部署，SQLite 存储，开箱即用。

## Features / 功能

- � JBookmark categories with drag & drop / 书签分类，支持拖拽排序
- � 分Notes / 笔记
- � C记lipboard / 剪贴板
- ⚙️ User settings / 用户设置
- 📤 Data import/export / 数据导入导出
- � 数Single Docker image / 单镜像部署
- 💾 SQLite storage / SQLite 存储

## Quick Start / 快速开始

### Docker

```bash
docker run -d \
  --name qiankui-nav \
  -p 3000:3000 \
  -v qiankui-data:/app/data \
  -e JWT_SECRET=your-secret-key \
  ghcr.io/qiankuishe/qiankui-nav:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  qiankui-nav:
    image: ghcr.io/qiankuishe/qiankui-nav:latest
    ports:
      - "3000:3000"
    volumes:
      - qiankui-data:/app/data
    environment:
      - JWT_SECRET=your-secret-key-change-me
    restart: unless-stopped

volumes:
  qiankui-data:
```

## Default Account / 默认账号

- Username / 用户名: `admin`
- Password / 密码: `admin123`

⚠️ Please change the password after first login! / 首次登录后请立即修改密码！

## Environment Variables / 环境变量

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `JWT_SECRET` | JWT secret key | random |
| `DATABASE_PATH` | SQLite database path | ./data/navigation.db |

## Development / 开发

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Development
npm run dev

# Build
npm run build

# Start
npm start
```

## Build Docker Image / 构建镜像

```bash
docker build -t qiankui-nav .
```

## License

MIT
