# cjx 知微录 / myweb

个人博客与项目展示站点，采用静态页面 + SPA 架构，评论系统基于 Supabase，音乐播放器使用自建 Cloudflare Worker API + R2 缓存。

## ✨ 核心特性

- **📝 Markdown 文章系统** - 支持 front matter、自动目录、代码高亮、数学公式渲染
- **💬 Supabase 评论** - JWT 登录、注册、多级回复、SPA 无刷新切换
- **🎵 音乐播放器** - APlayer 迷你固定播放器，桌面可拖动，移动端自适应，跨页面保持播放
- **☁️ Cloudflare Worker 音乐 API** - 自建网易云代理，WEAPI 加密，R2 永久音频缓存（900MB 限额）
- **🎮 独立小游戏** - 五子棋、中国象棋 AI、你画我猜等互动页面
- **🎨 Mizuki 设计** - 毛玻璃质感，浅色/深色主题，色相可调（0-360°）

## 🚀 快速开始

### 本地运行

```bash
npm install
npm start
```

服务默认运行在 `http://127.0.0.1:12811`（或环境变量 `PORT` 指定端口）

### 常用命令

```bash
npm test                          # 运行所有测试
npm run new:post -- "文章标题"      # 创建新文章
npm run import:posts              # 导入 Markdown 文件
npm run deploy:music-worker       # 部署音乐 Worker
```

## 📂 项目结构

```
.
├── index.html                     # 首页（三栏布局）
├── post.html                      # 文章详情页
├── comments.html                  # 留言板
├── archive.html / about.html      # 归档 / 关于
├── server.js                      # Express 服务入口（/api/posts）
├── supabase_all_in_one.jwt.js     # Supabase 登录/评论逻辑
├── cloudflare-music-worker.js     # 音乐 Worker（网易云 API 代理）
├── wrangler-music.toml            # Worker 部署配置
├── assets/
│   ├── site.css                   # 全局样式（Mizuki 主题）
│   ├── site.js                    # SPA 路由、主题切换、文章渲染
│   ├── music-config.js            # 音乐播放器配置（公开）
│   ├── music-player.js            # 播放器逻辑（三层 fallback）
│   ├── music-player.css           # 播放器样式
│   └── vendor/                    # APlayer 本地依赖
├── posts/                         # Markdown 文章目录
├── scripts/                       # 测试脚本、发文工具
├── docs/                          # 项目文档、架构说明
└── backups/                       # 临时备份（.gitignore）
```

## 🎵 音乐系统架构

### 三层 Fallback 机制

```
Cloudflare Worker (优先)
    ↓ 失败
MetingJS 第三方 API
    ↓ 失败
本地音频 background.wav
```

### Worker API 路由

| 路由 | 功能 | 缓存策略 |
|------|------|----------|
| `/api/music/playlist` | 歌单信息（trackIds + 批量查询） | 1 小时 |
| `/api/music/url` | 播放链接（302 跳转） | 10 分钟（浏览器端） |
| `/api/music/audio` | 音频代理 + R2 缓存 | R2 永久缓存 |
| `/api/music/lyric` | 歌词（LRC 格式） | 30 天 |

### R2 音频缓存

- **总容量限制**：900MB
- **自动淘汰**：超限时删除最旧一半音频
- **存储路径**：`audio/{provider}/{song_id}/{quality}`
- **命中优先级**：R2 > 网易云 API
- **Range 请求支持**：支持断点续播

### VIP Cookie 配置

Worker 支持网易云 VIP Cookie，用于播放受限歌曲：

```bash
# 使用 wrangler secret（推荐）
wrangler secret put NETEASE_COOKIE -c wrangler-music.toml
```

详细配置教程：[docs/cloudflare-worker-vip-cookie.md](docs/cloudflare-worker-vip-cookie.md)

## 📝 文章发布

### 创建新文章

```bash
npm run new:post -- "文章标题"
```

自动生成模板：

```markdown
---
title: "文章标题"
date: 2026-06-13
tags: []
---

文章内容...
```

### 导入已有 Markdown

```bash
npm run import:posts
```

**注意**：从 Typora 等编辑器导入的图片需复制到 `assets/` 并使用相对路径，不要保留 `C:\Users\...` 或 `file:///` 本地路径。

## 🧪 测试

```bash
npm test
```

测试套件：
- `site-integrity.test.mjs` - 核心文件完整性、版本一致性、安全断言
- `import-select.test.mjs` - Markdown 导入选择逻辑
- `game-mobile-layout.test.mjs` - 游戏页面移动端布局
- `draw-guess.test.mjs` - 你画我猜脚本验证

## 🔐 环境变量

### 本地开发（.env）

```env
# 网易云音乐 API（已迁移到 Cloudflare Worker）
# KARPOV_GATEWAY_API_KEY=已废弃
# KARPOV_GATEWAY_COOKIE=已废弃

# 服务端口（可选，默认 12811）
PORT=12811
```

**⚠️ `.env` 已在 `.gitignore`，不要提交！**

### Cloudflare Worker 配置

在 `wrangler-music.toml` 或 Cloudflare Dashboard 设置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MUSIC_PROVIDER` | 音乐平台 | `netease` |
| `MUSIC_PLAYLIST_ID` | 默认歌单 ID | `2668671168` |
| `MUSIC_QUALITY` | 音质（比特率） | `320000` |
| `NETEASE_COOKIE` | VIP Cookie（Secret） | - |

### Supabase 配置

前端 `supabase_all_in_one.jwt.js` 需配置：
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`（可公开，权限由 RLS 控制）

## 📦 部署

### 主站部署

上传以下文件到服务器：

```
server.js
index.html, post.html, comments.html, archive.html, about.html
五子棋.html, 中国象棋ai.html, 你画我猜.html
assets/
posts/
supabase_all_in_one.jwt.js
package.json
scripts/
```

启动服务：

```bash
npm install --production
PORT=12811 node server.js
```

### Worker 部署

```bash
# 首次部署
wrangler login
wrangler deploy -c wrangler-music.toml

# 配置 VIP Cookie
wrangler secret put NETEASE_COOKIE -c wrangler-music.toml
```

**确认 R2 绑定**：
- Binding name: `MUSIC_BUCKET`
- Bucket: `site-music-cache`

## 🔒 安全说明

### 已防护

- ✅ 网易云 Cookie 存储在 Cloudflare Secret，不在代码
- ✅ `.env` 已被 gitignore，本地密钥不会提交
- ✅ 前端配置文件无 API key / Bearer token
- ✅ Supabase RLS 规则控制评论权限
- ✅ R2 bucket 仅 Worker 可访问，不公开

### 风险提示

- 🔴 **不要提交** `.env`、`wrangler-music.toml`（含真实 Cookie）
- 🟡 **定期更新** 网易云 Cookie（30-90 天过期）
- 🟡 **监控流量** Worker 免费额度 10 万请求/天

## 🛠️ 技术栈

- **前端**：原生 JS + SPA 路由（History API）
- **后端**：Node.js + Express
- **数据库**：Supabase（PostgreSQL + RLS）
- **CDN/缓存**：Cloudflare Workers + R2
- **播放器**：APlayer（固定迷你模式）
- **样式**：CSS 变量 + Mizuki 设计语言
- **测试**：Node.js Assert（无外部框架）

## 📄 许可

MIT License

---

**项目状态**：✅ 生产就绪  
**最后更新**：2026-06-13  
**维护者**：[@cjx](https://github.com/3405029277)
