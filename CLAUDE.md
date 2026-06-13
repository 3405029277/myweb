# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 重要提醒

**在修改任何代码前，请先阅读：**
1. 本文件 - 了解命令和工作流
2. `docs/directory-structure.md` - 理解项目结构和安全规则
3. `docs/site-structure.md` - 理解架构设计

**修改后必须：**
1. 运行 `npm test` 确保所有测试通过
2. 如修改 CSS/JS 资源，更新版本号（见下方"版本管理"）

---

## Commands

```bash
npm install            # install deps
npm start              # run Express server on 127.0.0.1:12811 (or $PORT)
npm test               # run all four test suites (see below)
npm run new:post -- "标题"   # scaffold a new posts/*.md article
npm run import:posts         # import existing markdown into posts/
npm run deploy:music-worker  # wrangler deploy -c wrangler-music.toml

# ⚠️ 每次改动前必须备份（如果脚本存在）
./backup-before-change.sh "改动描述"  # 创建 git stash + 物理备份
```

`npm test` chains four files and stops at the first failure:
```bash
node scripts/site-integrity.test.mjs    # whole-site source assertions
node scripts/import-select.test.mjs     # markdown import selection logic
node scripts/game-mobile-layout.test.mjs
node scripts/draw-guess.test.mjs
```
Run a single suite directly, e.g. `node scripts/site-integrity.test.mjs`.

---

## Architecture

Static-first site. Express (`server.js`) serves the repo root as static files and adds JSON/proxy APIs. The same site also runs as pure static hosting because every server feature has a client-side or Worker fallback.

### SPA Routing
`index.html`, `post.html`, `comments.html` are separate files but navigate as a SPA:
- Link clicks intercepted by `assets/site.js`
- Target page fetched, `<main id="siteRoute">` container swapped
- History API (`pushState`/`popstate`) for back/forward
- **Game pages excluded** from SPA (full page load)
- `initRoute()` dispatches per-page setup
- `routeCleanup[]` tears down on navigation

### Posts: Dual-Path with Local Fallback
- **Server route**: `/api/posts` and `/api/posts/:slug` (gray-matter + marked)
- **Client fallback**: Fetch `posts/<slug>.md` directly, parse with `parseFrontMatter` + `markdownToHtml`
- Both paths must stay behavior-compatible
- C++ syntax highlighting + `$…$` math renderer (client-side only)

### Music: Three-Layer Fallback
Priority: **Cloudflare Worker (自建) → MetingJS (第三方) → Local audio**

Orchestrated in `assets/music-player.js`:
```javascript
initKarpov().catch(initFallback)
```

**Worker API** (`cloudflare-music-worker.js`):
- `/api/music/playlist` - 歌单（trackIds + 批量 `/weapi/v3/song/detail`）
- `/api/music/url` - 播放链接（302 跳转）
- `/api/music/audio` - 音频代理 + R2 永久缓存
- `/api/music/lyric` - 歌词

**R2 缓存策略**:
- Key: `audio/{provider}/{song_id}/{quality}`
- Limit: 900MB，超限删除最旧一半
- 优先级: R2 > 网易云 API
- 支持 Range 请求（断点续播）

**VIP Cookie**: 使用 `wrangler secret` 管理，不在代码中
```bash
wrangler secret put NETEASE_COOKIE -c wrangler-music.toml
```

**Player Features**:
- APlayer native `fixed` + `mini` mode
- Draggable on desktop
- Survives SPA navigation (`__SITE_MUSIC_READY__` guard)
- Lazy audio URL + lyrics loading

### Auth/Comments
`supabase_all_in_one.jwt.js` - single global script:
- Builds auth UI (`ensureGlobalAuthUI`)
- Exposes `window.SiteComments.mountComments()`
- Threaded comments (`parent_id`)
- Remounts after SPA navigation

---

## 版本管理（Version Management）

**⚠️ 修改 CSS/JS 资源必须同步版本号！**

### 当前版本（2026-06-13）

| 文件 | 版本 | HTML 引用位置 |
|------|------|--------------|
| `assets/site.css` | `?v=20260613-final` | 所有 HTML |
| `assets/site.js` | `?v=20260613-final` | 所有 HTML |
| `assets/music-player.css` | `?v=22` | index/post/comments |
| `assets/music-player.js` | `?v=30` | index/post/comments |
| `assets/music-config.js` | `?v=3` | index/post/comments |

### 修改流程

1. **修改资源文件**（如 `site.css`）
2. **更新版本号**:
   ```html
   <!-- 所有 HTML 文件 -->
   <link rel="stylesheet" href="assets/site.css?v=NEW_VERSION">
   ```
3. **更新测试断言**:
   ```javascript
   // scripts/site-integrity.test.mjs
   assert.match(html, /site\.css\?v=NEW_VERSION/, "site.css version");
   ```
4. **运行测试**:
   ```bash
   npm test
   ```
5. **提交代码**

### 版本号规则

- **日期版本**: `YYYYMMDD-描述`（如 `20260613-final`）
- **数字版本**: 递增整数（如 `v=22` → `v=23`）
- **重大改动**: 使用日期版本
- **小修复**: 递增数字版本

---

## Conventions that Tests Enforce

`scripts/site-integrity.test.mjs` is a large set of regex assertions against source files — it is effectively a spec. Two things break it most often:

### 1. Versioned Asset Query Strings
All HTML files must load exact versions the test pins:
```html
assets/music-player.css?v=22
assets/music-player.js?v=29
assets/music-config.js?v=3
```

**Changing file contents = bump version in HTML + assertion**

### 2. No Secrets in Client/Browser Files
```javascript
// ❌ 禁止
const cookie = "MUSIC_U=xxx; __csrf=yyy";
const apiKey = "Bearer sk-xxx";

// ✅ 正确
// Cookie 在 Cloudflare Secret
// API key 在 server.js .env
```

Assertions forbid:
- `Bearer` / `API-KEY` patterns
- `MUSIC_U` / `__csrf` in `assets/music-config.js`
- Cookie headers in `cloudflare-music-worker.js` source

### 3. Player Behaviors
The test pins specific behaviors via negative assertions:
- No autoplay (`assert.doesNotMatch(..., /autoplay:\s*true/)`)
- Native mini mode (no custom slide panel)
- Lazy audio/lyric loading
- No custom chrome

**Read assertions before changing `music-player.js`/`.css`!**

---

## 常见修改场景

### 修改样式
```bash
# 1. 修改 assets/site.css
# 2. 更新版本号 20260613-final → 20260613-v2
# 3. 更新所有 HTML 引用
# 4. 更新测试断言
npm test
```

### 添加文章
```bash
npm run new:post -- "新文章标题"
# 编辑 posts/YYYY-MM-DD-新文章标题.md
```

### 修改音乐播放器
```bash
# 1. 修改 assets/music-player.js
# 2. 版本号 v=30 → v=31
# 3. 更新 index/post/comments.html 三处引用
# 4. 更新测试断言
npm test
```

### 部署 Worker
```bash
# 首次部署
wrangler login
wrangler deploy -c wrangler-music.toml

# 配置 VIP Cookie
wrangler secret put NETEASE_COOKIE -c wrangler-music.toml

# 重新部署（代码更新后）
npm run deploy:music-worker
```

---

## 🚫 禁止操作

### 绝对不要
- ❌ 提交 `.env` 文件
- ❌ 在前端代码硬编码 API key / Cookie
- ❌ 删除测试断言（除非有充分理由）
- ❌ 修改 Worker R2 缓存 key 格式（会导致所有缓存失效）
- ❌ 将 `backup-before-*` 目录添加到 git
- ❌ 绕过 `npm test`（测试失败不要提交）

### 谨慎操作（需明确用户同意）
- ⚠️ 修改 `supabase_all_in_one.jwt.js` 的 auth 逻辑
- ⚠️ 改变 SPA 路由机制
- ⚠️ 删除音乐播放器的 fallback 层
- ⚠️ 修改 Markdown 渲染逻辑（影响已有文章）

---

## Backup Workflow

**⚠️ MANDATORY: Backup before every change**

```bash
# 1. 改动前备份
./backup-before-change.sh "你要做的改动描述"

# 2. 进行修改...

# 3. 改完测试
npm test

# 4. 测试通过后提交
git add -A
git commit -m "改动描述"

# 5. 提交后可删除对应备份
rm -rf backups/backup-YYYYMMDD-HHMMSS/
```

**恢复方法：**
```bash
# 查看所有备份
git stash list

# 恢复最新备份
git stash apply stash@{0}

# 或从物理备份恢复
cp -r backups/backup-20260612-143025/* .
```

详见 `backups/README.md`

---

## Notes

### General
- ESM throughout (`"type": "module"`)
- `.env` loaded by hand-rolled `loadEnvFile` in `server.js` (not dotenv)
- Imported Typora images must use relative paths (copy to `assets/`)
- `backup-before-*` directories are throwaway snapshots (gitignored)

### Music System
- **Server** (`server.js`) and **Worker** (`cloudflare-music-worker.js`) are parallel implementations
- Same caching constants (`monthSeconds`, `songUrlBrowserSeconds`)
- Same lyric normalization (`extractLyricText`, `convertKarpovJsonLyric`)
- **When editing one, mirror the change in the other** or tests fail

### Security
- Karpov `KARPOV_GATEWAY_API_KEY` / `KARPOV_GATEWAY_COOKIE` in `server.js` env only
- Worker secrets via `wrangler secret put`
- Supabase `anon key` is public (RLS controls permissions)
- R2 bucket access only through Worker

---

## AI 协作建议

### 会话开始时
1. 阅读 `docs/session-YYYY-MM-DD.md`（如果存在）了解上次工作
2. 运行 `npm test` 确认当前状态
3. 检查 `git status` 是否有未提交改动

### 大型重构前
1. 创建新分支: `git checkout -b feature-name`
2. 备份: `./backup-before-change.sh "重构描述"`
3. 分阶段提交，每步运行 `npm test`

### 遇到测试失败
1. 查看失败的断言理解原因
2. 如果是版本号问题，检查是否漏改 HTML
3. 如果是逻辑问题，回滚改动或修复
4. **不要删除断言来通过测试**

### 会话结束时
1. 确保所有测试通过
2. 提交未完成的工作: `git add -A && git commit -m "WIP: 描述"`
3. 可选：在 `docs/` 创建会话记录 `session-YYYY-MM-DD.md`

---

**最后更新**: 2026-06-13  
**项目状态**: ✅ 生产就绪  
**核心开发者**: [@cjx](https://github.com/3405029277)
