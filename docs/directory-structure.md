# 项目目录结构

**最后更新**: 2026-06-13  
**用途**: AI 协作时快速理解项目布局，避免误改关键文件

---

## 📁 根目录文件

### 核心 HTML 页面
```
index.html              # 首页（三栏布局：个人信息 + 项目 + 文章）
post.html               # 文章详情页（Markdown 渲染）
comments.html           # 留言板（Supabase 评论系统）
archive.html            # 归档页（按时间排序文章列表）
about.html              # 关于页（个人介绍）
links.html              # 友链页
```

### 游戏页面
```
五子棋.html
中国象棋ai.html
你画我猜.html
```

### 服务端文件
```
server.js                       # Express 服务入口
                                # - 静态文件托管
                                # - /api/posts 接口（gray-matter + marked）
                                # - /api/posts/:slug 单篇文章
                                # - 本地 .env 加载

supabase_all_in_one.jwt.js      # Supabase 全局脚本
                                # - JWT 登录/注册
                                # - 评论 CRUD
                                # - 构建全局 auth UI
                                # - 暴露 window.SiteComments.mountComments()
```

### Worker 文件
```
cloudflare-music-worker.js      # 音乐 API Worker
                                # - 网易云 WEAPI 加密
                                # - /api/music/playlist（trackIds + 批量查询）
                                # - /api/music/audio（R2 缓存）
                                # - /api/music/url（302 跳转）
                                # - /api/music/lyric
                                # - R2 自动淘汰（900MB 限制）

wrangler-music.toml             # Worker 部署配置
                                # - R2 bucket 绑定：MUSIC_BUCKET
                                # - 环境变量：MUSIC_PROVIDER / PLAYLIST_ID / QUALITY
                                # ⚠️ NETEASE_COOKIE 用 wrangler secret 管理
```

### 配置文件
```
package.json                    # 依赖 + 脚本
.gitignore                      # 忽略 .env / backup-* / node_modules
.env                            # 本地环境变量（已 gitignore）
```

---

## 📁 assets/ - 静态资源

### 核心 JS/CSS
```
site.css                        # 全局样式
                                # - Mizuki 设计系统（oklch colors）
                                # - 浅色/深色主题切换
                                # - 响应式布局（900px / 768px / 560px）
                                # - 版本号：?v=20260613-final

site.js                         # SPA 核心逻辑
                                # - 路由拦截（initRoute / routeCleanup）
                                # - 主题切换（localStorage）
                                # - Markdown 渲染（fallback）
                                # - 色相调节（--site-hue）
                                # - 版本号：?v=20260613-final
```

### 音乐播放器
```
music-config.js                 # 播放器配置（公开）
                                # - endpoint: Worker URL
                                # - playlistId: 2668671168
                                # - fallback: 本地 background.wav
                                # ⚠️ 无密钥/Cookie

music-player.js                 # 播放器逻辑
                                # - 三层 fallback（Karpov → MetingJS → 本地）
                                # - APlayer 固定迷你模式
                                # - 桌面可拖动
                                # - 跨页面保持播放
                                # - 版本号：?v=30

music-player.css                # 播放器样式
                                # - 固定定位 + 拖拽支持
                                # - 移动端 bottom margin 修复
                                # - 版本号：?v=22
```

### 其他资源
```
avatar.jpg                      # 个人头像
music/background.wav            # 本地音频 fallback
vendor/                         # 第三方库（APlayer / MetingJS）
```

---

## 📁 posts/ - 文章目录

```
posts/
├── 2024-01-01-示例文章.md
├── 2024-02-15-另一篇.md
└── ...

格式：YYYY-MM-DD-标题.md
Front matter 必需字段：
---
title: "标题"
date: YYYY-MM-DD
tags: [tag1, tag2]
---
```

**创建命令**:
```bash
npm run new:post -- "文章标题"
```

---

## 📁 scripts/ - 工具脚本

```
site-integrity.test.mjs         # 核心测试
                                # - 版本号一致性
                                # - 安全检查（无 API key/Cookie）
                                # - 文件结构完整性
                                # - Worker 逻辑验证

import-select.test.mjs          # Markdown 导入逻辑测试
game-mobile-layout.test.mjs     # 游戏页面移动端测试
draw-guess.test.mjs             # 你画我猜脚本测试

import-posts.mjs                # 导入 Markdown 工具
new-post.mjs                    # 新建文章脚手架
```

**测试命令**:
```bash
npm test                        # 运行所有测试
```

---

## 📁 docs/ - 项目文档

```
site-structure.md               # 完整架构文档
session-2026-06-12.md           # 会话记录（Mizuki 复刻）
vmss-mizuki-reference.md        # Mizuki 设计参考
cloudflare-worker-vip-cookie.md # VIP Cookie 配置教程
directory-structure.md          # 本文件
```

---

## 🚫 不提交的目录/文件

```
.env                            # 本地环境变量
.env.*                          # 环境变量模板
node_modules/                   # npm 依赖
backup-before-*/                # 临时备份
backups/                        # 手动备份
```

---

## ⚠️ 关键版本号（必须同步）

所有 HTML 文件必须加载一致的版本：

| 文件 | 版本 | 位置 |
|------|------|------|
| `site.css` | `?v=20260613-final` | 所有 HTML |
| `site.js` | `?v=20260613-final` | 所有 HTML |
| `music-player.css` | `?v=22` | 3 个主页面 |
| `music-player.js` | `?v=30` | 3 个主页面 |
| `music-config.js` | `?v=3` | 3 个主页面 |

**修改资源后必须**:
1. 更新文件版本号
2. 更新 `scripts/site-integrity.test.mjs` 断言
3. 更新所有 HTML 引用
4. 运行 `npm test` 验证

---

## 🔐 安全规则

### ✅ 可以提交
- HTML / CSS / JS 源码
- 测试脚本
- Markdown 文章
- 公开配置（music-config.js）

### ❌ 绝对不能提交
- `.env` 文件
- 包含真实 Cookie 的 `wrangler-music.toml`
- Supabase service_role key
- 任何 `Bearer` token / API key

### 🔍 验证命令
```bash
# 检查是否有敏感信息
git diff | grep -E "MUSIC_U=|__csrf=|Bearer|API.*KEY"
```

---

## 🛠️ AI 协作指南

### 修改文件前必须做
1. 运行 `./backup-before-change.sh "改动描述"`（如果存在）
2. 阅读 `CLAUDE.md` 了解命令和约定
3. 检查 `docs/site-structure.md` 理解架构

### 修改后必须做
1. 运行 `npm test` 确保测试通过
2. 更新版本号（如修改 CSS/JS）
3. 提交前检查 `git diff` 无敏感信息

### 不要做
- ❌ 删除 `scripts/site-integrity.test.mjs` 的任何断言
- ❌ 在前端代码硬编码 API key / Cookie
- ❌ 修改 `supabase_all_in_one.jwt.js` 的 auth 逻辑（除非用户明确要求）
- ❌ 改变 Worker R2 缓存 key 格式（会导致缓存失效）
- ❌ 将 `backup-*` 目录添加到 git

---

## 📊 项目统计

- **总文件数**: ~50（不含 node_modules）
- **代码行数**: ~15,000 行
- **测试覆盖**: 4 个测试套件
- **部署位置**: 
  - 主站：自托管 Node.js
  - Worker：Cloudflare Workers
  - 音频缓存：Cloudflare R2 (900MB)
  - 评论数据：Supabase PostgreSQL

---

**维护建议**:
- 每月检查网易云 Cookie 是否过期
- 监控 R2 容量（接近 900MB 时会自动淘汰）
- 定期更新依赖：`npm update`
- 新会话开始前阅读 `docs/session-YYYY-MM-DD.md` 了解上次工作
