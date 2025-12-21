import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export async function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || './data/navigation.db'
  
  // 确保目录存在
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      icon_url TEXT,
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clipboard_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      is_public INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);
    CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_clipboard_user ON clipboard_items(user_id);
  `)

  // 数据库迁移：为已有表添加 is_public 字段
  const columns = db.prepare("PRAGMA table_info(clipboard_items)").all() as { name: string }[]
  if (!columns.some(c => c.name === 'is_public')) {
    db.exec('ALTER TABLE clipboard_items ADD COLUMN is_public INTEGER DEFAULT 0')
    console.log('✅ Added is_public column to clipboard_items')
  }
  if (!columns.some(c => c.name === 'is_pinned')) {
    db.exec('ALTER TABLE clipboard_items ADD COLUMN is_pinned INTEGER DEFAULT 0')
    console.log('✅ Added is_pinned column to clipboard_items')
  }

  // 数据库迁移：为 notes 表添加 is_pinned 字段
  const noteColumns = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]
  if (!noteColumns.some(c => c.name === 'is_pinned')) {
    db.exec('ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0')
    console.log('✅ Added is_pinned column to notes')
  }

  // 创建默认管理员账号和示例数据
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10)
    const { v4: uuidv4 } = await import('uuid')
    const adminId = uuidv4()
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, settings)
      VALUES (?, 'admin', ?, '{"website_name":"qiankui导航","theme":"light"}')
    `).run(adminId, passwordHash)
    
    // 预设导航数据 - 与原项目 daohang-qk 保持一致
    const presetCategories = [
      {
        name: '常用推荐', order: 0,
        links: [
          { title: 'GitHub', url: 'https://github.com', description: '代码托管平台', iconUrl: 'https://github.com/favicon.ico' },
          { title: 'ChatGPT', url: 'https://chat.openai.com', description: 'OpenAI对话AI', iconUrl: 'https://chat.openai.com/favicon.ico' },
          { title: 'YouTube', url: 'https://www.youtube.com', description: '全球视频平台', iconUrl: 'https://www.youtube.com/favicon.ico' },
          { title: 'Notion', url: 'https://www.notion.so', description: '全能笔记工具', iconUrl: 'https://www.notion.so/favicon.ico' },
          { title: 'Google', url: 'https://www.google.com', description: '全球搜索引擎', iconUrl: 'https://www.google.com/favicon.ico' },
          { title: 'Twitter/X', url: 'https://twitter.com', description: '全球社交平台', iconUrl: 'https://twitter.com/favicon.ico' },
        ]
      },
      {
        name: '搜索引擎', order: 1,
        links: [
          { title: '百度', url: 'https://www.baidu.com', description: '中文搜索引擎', iconUrl: 'https://www.baidu.com/favicon.ico' },
          { title: 'Bing', url: 'https://www.bing.com', description: '微软搜索引擎', iconUrl: 'https://www.bing.com/favicon.ico' },
          { title: 'DuckDuckGo', url: 'https://duckduckgo.com', description: '隐私保护搜索', iconUrl: 'https://duckduckgo.com/favicon.ico' },
          { title: 'Yandex', url: 'https://yandex.com', description: '俄罗斯搜索引擎', iconUrl: 'https://yandex.com/favicon.ico' },
        ]
      },
      {
        name: '开发工具', order: 2,
        links: [
          { title: 'GitLab', url: 'https://gitlab.com', description: 'DevOps平台', iconUrl: 'https://gitlab.com/favicon.ico' },
          { title: 'Stack Overflow', url: 'https://stackoverflow.com', description: '开发者问答社区', iconUrl: 'https://stackoverflow.com/favicon.ico' },
          { title: 'CodePen', url: 'https://codepen.io', description: '前端代码演示', iconUrl: 'https://codepen.io/favicon.ico' },
          { title: 'Replit', url: 'https://replit.com', description: '云端IDE', iconUrl: 'https://replit.com/favicon.ico' },
          { title: 'VS Code Web', url: 'https://vscode.dev', description: '在线VS Code', iconUrl: 'https://vscode.dev/favicon.ico' },
          { title: 'npm', url: 'https://www.npmjs.com', description: 'Node包管理器', iconUrl: 'https://www.npmjs.com/favicon.ico' },
          { title: 'Docker Hub', url: 'https://hub.docker.com', description: '容器镜像仓库', iconUrl: 'https://hub.docker.com/favicon.ico' },
        ]
      },
      {
        name: '技术文档', order: 3,
        links: [
          { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', description: 'Web技术权威文档', iconUrl: 'https://developer.mozilla.org/favicon.ico' },
          { title: 'React', url: 'https://react.dev', description: 'React官方文档', iconUrl: 'https://react.dev/favicon.ico' },
          { title: 'Vue.js', url: 'https://vuejs.org', description: 'Vue官方文档', iconUrl: 'https://vuejs.org/favicon.ico' },
          { title: 'TypeScript', url: 'https://www.typescriptlang.org', description: 'TS官方文档', iconUrl: 'https://www.typescriptlang.org/favicon.ico' },
          { title: 'Node.js', url: 'https://nodejs.org', description: 'Node.js官网', iconUrl: 'https://nodejs.org/favicon.ico' },
          { title: 'Tailwind CSS', url: 'https://tailwindcss.com', description: '原子化CSS框架', iconUrl: 'https://tailwindcss.com/favicon.ico' },
          { title: 'Next.js', url: 'https://nextjs.org', description: 'React全栈框架', iconUrl: 'https://nextjs.org/favicon.ico' },
          { title: 'Vite', url: 'https://vitejs.dev', description: '前端构建工具', iconUrl: 'https://vitejs.dev/favicon.ico' },
        ]
      },
      {
        name: '设计资源', order: 4,
        links: [
          { title: 'Figma', url: 'https://www.figma.com', description: '协作设计工具', iconUrl: 'https://www.figma.com/favicon.ico' },
          { title: 'Dribbble', url: 'https://dribbble.com', description: '设计师作品展示', iconUrl: 'https://dribbble.com/favicon.ico' },
          { title: 'Behance', url: 'https://www.behance.net', description: 'Adobe创意社区', iconUrl: 'https://www.behance.net/favicon.ico' },
          { title: 'Unsplash', url: 'https://unsplash.com', description: '免费高清图片', iconUrl: 'https://unsplash.com/favicon.ico' },
          { title: 'Icons8', url: 'https://icons8.com', description: '图标和插画资源', iconUrl: 'https://icons8.com/favicon.ico' },
          { title: 'Coolors', url: 'https://coolors.co', description: '配色方案生成器', iconUrl: 'https://coolors.co/favicon.ico' },
          { title: 'Pexels', url: 'https://www.pexels.com', description: '免费图片视频', iconUrl: 'https://www.pexels.com/favicon.ico' },
          { title: 'Canva', url: 'https://www.canva.com', description: '在线设计平台', iconUrl: 'https://www.canva.com/favicon.ico' },
        ]
      },
      {
        name: 'AI工具', order: 5,
        links: [
          { title: 'Claude', url: 'https://claude.ai', description: 'Anthropic对话AI', iconUrl: 'https://claude.ai/favicon.ico' },
          { title: 'Midjourney', url: 'https://www.midjourney.com', description: 'AI图像生成', iconUrl: 'https://www.midjourney.com/favicon.ico' },
          { title: 'Hugging Face', url: 'https://huggingface.co', description: 'AI模型社区', iconUrl: 'https://huggingface.co/favicon.ico' },
          { title: 'Perplexity', url: 'https://www.perplexity.ai', description: 'AI搜索引擎', iconUrl: 'https://www.perplexity.ai/favicon.ico' },
          { title: 'Stable Diffusion', url: 'https://stability.ai', description: 'AI图像生成', iconUrl: 'https://stability.ai/favicon.ico' },
          { title: 'Gemini', url: 'https://gemini.google.com', description: 'Google AI助手', iconUrl: 'https://gemini.google.com/favicon.ico' },
          { title: 'Copilot', url: 'https://copilot.microsoft.com', description: '微软AI助手', iconUrl: 'https://copilot.microsoft.com/favicon.ico' },
        ]
      },
      {
        name: '视频娱乐', order: 6,
        links: [
          { title: 'B站', url: 'https://www.bilibili.com', description: '弹幕视频网站', iconUrl: 'https://www.bilibili.com/favicon.ico' },
          { title: 'Netflix', url: 'https://www.netflix.com', description: '流媒体平台', iconUrl: 'https://www.netflix.com/favicon.ico' },
          { title: 'Twitch', url: 'https://www.twitch.tv', description: '游戏直播平台', iconUrl: 'https://www.twitch.tv/favicon.ico' },
          { title: '抖音', url: 'https://www.douyin.com', description: '短视频平台', iconUrl: 'https://www.douyin.com/favicon.ico' },
          { title: 'Spotify', url: 'https://www.spotify.com', description: '音乐流媒体', iconUrl: 'https://www.spotify.com/favicon.ico' },
          { title: '网易云音乐', url: 'https://music.163.com', description: '音乐平台', iconUrl: 'https://music.163.com/favicon.ico' },
        ]
      },
      {
        name: '社交社区', order: 7,
        links: [
          { title: 'Reddit', url: 'https://www.reddit.com', description: '社区论坛', iconUrl: 'https://www.reddit.com/favicon.ico' },
          { title: 'LinkedIn', url: 'https://www.linkedin.com', description: '职业社交网络', iconUrl: 'https://www.linkedin.com/favicon.ico' },
          { title: '微博', url: 'https://weibo.com', description: '中文社交平台', iconUrl: 'https://weibo.com/favicon.ico' },
          { title: '知乎', url: 'https://www.zhihu.com', description: '中文问答社区', iconUrl: 'https://www.zhihu.com/favicon.ico' },
          { title: 'Discord', url: 'https://discord.com', description: '社群语音聊天', iconUrl: 'https://discord.com/favicon.ico' },
          { title: 'Telegram', url: 'https://telegram.org', description: '即时通讯软件', iconUrl: 'https://telegram.org/favicon.ico' },
        ]
      },
      {
        name: '效率办公', order: 8,
        links: [
          { title: 'Trello', url: 'https://trello.com', description: '看板项目管理', iconUrl: 'https://trello.com/favicon.ico' },
          { title: 'Slack', url: 'https://slack.com', description: '团队协作通讯', iconUrl: 'https://slack.com/favicon.ico' },
          { title: 'Zoom', url: 'https://zoom.us', description: '视频会议软件', iconUrl: 'https://zoom.us/favicon.ico' },
          { title: '飞书', url: 'https://www.feishu.cn', description: '字节办公套件', iconUrl: 'https://www.feishu.cn/favicon.ico' },
          { title: '钉钉', url: 'https://www.dingtalk.com', description: '阿里办公套件', iconUrl: 'https://www.dingtalk.com/favicon.ico' },
          { title: 'Obsidian', url: 'https://obsidian.md', description: '本地知识库', iconUrl: 'https://obsidian.md/favicon.ico' },
          { title: 'Linear', url: 'https://linear.app', description: '项目管理工具', iconUrl: 'https://linear.app/favicon.ico' },
        ]
      },
      {
        name: '云服务', order: 9,
        links: [
          { title: 'AWS', url: 'https://aws.amazon.com', description: '亚马逊云服务', iconUrl: 'https://aws.amazon.com/favicon.ico' },
          { title: 'Vercel', url: 'https://vercel.com', description: '前端部署平台', iconUrl: 'https://vercel.com/favicon.ico' },
          { title: 'Netlify', url: 'https://www.netlify.com', description: '静态站点托管', iconUrl: 'https://www.netlify.com/favicon.ico' },
          { title: 'Cloudflare', url: 'https://www.cloudflare.com', description: 'CDN和安全服务', iconUrl: 'https://www.cloudflare.com/favicon.ico' },
          { title: '阿里云', url: 'https://www.aliyun.com', description: '阿里巴巴云计算', iconUrl: 'https://www.aliyun.com/favicon.ico' },
          { title: '腾讯云', url: 'https://cloud.tencent.com', description: '腾讯云计算服务', iconUrl: 'https://cloud.tencent.com/favicon.ico' },
          { title: 'Railway', url: 'https://railway.app', description: '应用部署平台', iconUrl: 'https://railway.app/favicon.ico' },
          { title: 'Supabase', url: 'https://supabase.com', description: '开源Firebase替代', iconUrl: 'https://supabase.com/favicon.ico' },
        ]
      },
      {
        name: '学习资源', order: 10,
        links: [
          { title: 'Coursera', url: 'https://www.coursera.org', description: '在线课程平台', iconUrl: 'https://www.coursera.org/favicon.ico' },
          { title: 'Udemy', url: 'https://www.udemy.com', description: '技能学习平台', iconUrl: 'https://www.udemy.com/favicon.ico' },
          { title: 'freeCodeCamp', url: 'https://www.freecodecamp.org', description: '免费编程学习', iconUrl: 'https://www.freecodecamp.org/favicon.ico' },
          { title: 'LeetCode', url: 'https://leetcode.com', description: '算法刷题平台', iconUrl: 'https://leetcode.com/favicon.ico' },
          { title: '掘金', url: 'https://juejin.cn', description: '开发者社区', iconUrl: 'https://juejin.cn/favicon.ico' },
          { title: 'Medium', url: 'https://medium.com', description: '优质文章平台', iconUrl: 'https://medium.com/favicon.ico' },
          { title: 'Dev.to', url: 'https://dev.to', description: '开发者博客社区', iconUrl: 'https://dev.to/favicon.ico' },
        ]
      },
      {
        name: '实用工具', order: 11,
        links: [
          { title: 'TinyPNG', url: 'https://tinypng.com', description: '图片压缩工具', iconUrl: 'https://tinypng.com/favicon.ico' },
          { title: 'Remove.bg', url: 'https://www.remove.bg', description: 'AI抠图工具', iconUrl: 'https://www.remove.bg/favicon.ico' },
          { title: 'DeepL', url: 'https://www.deepl.com', description: 'AI翻译工具', iconUrl: 'https://www.deepl.com/favicon.ico' },
          { title: 'JSON Editor', url: 'https://jsoneditoronline.org', description: 'JSON在线编辑', iconUrl: 'https://jsoneditoronline.org/favicon.ico' },
          { title: 'Regex101', url: 'https://regex101.com', description: '正则表达式测试', iconUrl: 'https://regex101.com/favicon.ico' },
          { title: 'Carbon', url: 'https://carbon.now.sh', description: '代码截图工具', iconUrl: 'https://carbon.now.sh/favicon.ico' },
        ]
      },
    ]
    
    // 插入所有预设分类和链接
    for (const cat of presetCategories) {
      const catId = uuidv4()
      db.prepare(`INSERT INTO categories (id, user_id, name, "order") VALUES (?, ?, ?, ?)`).run(catId, adminId, cat.name, cat.order)
      
      for (let i = 0; i < cat.links.length; i++) {
        const link = cat.links[i]
        db.prepare(`INSERT INTO links (id, user_id, category_id, title, url, description, icon_url, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(uuidv4(), adminId, catId, link.title, link.url, link.description, link.iconUrl, i)
      }
    }
    
    // 示例笔记
    db.prepare(`INSERT INTO notes (id, user_id, title, content) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), adminId, '欢迎使用qiankui导航', '这是一个示例笔记。\n\n您可以在这里记录重要信息、待办事项或任何想法。\n\n## 功能特点\n- 支持 Markdown 格式\n- 自动保存\n- 快速搜索')
    
    // 示例剪贴板（含公开便签示例）
    db.prepare(`INSERT INTO clipboard_items (id, user_id, type, title, content, is_public) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), adminId, 'text', '示例文本', '这是一个示例剪贴板内容，您可以在这里保存常用的文本片段。', 0)
    db.prepare(`INSERT INTO clipboard_items (id, user_id, type, title, content, is_public) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), adminId, 'code', '示例代码', 'console.log("Hello, World!");', 0)
    db.prepare(`INSERT INTO clipboard_items (id, user_id, type, title, content, is_public) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), adminId, 'text', '欢迎访问', '这是一个公开便签，访客可以在登录页看到它！', 1)
    db.prepare(`INSERT INTO clipboard_items (id, user_id, type, title, content, is_public) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), adminId, 'code', 'Docker 部署', 'docker run -d -p 3001:3001 -v nav-data:/app/data qiankui-nav', 1)
    
    console.log('✅ Created default admin user (admin/admin123) with 12 categories and 72 links')
  }

  console.log('✅ Database initialized')
}
