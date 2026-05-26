# 项目结构备忘录

这个文档记录当前站点的真实结构、部署关系和最容易忘的维护点。

## 1. 项目定位

这是一个个人博客和项目展示站点，主站名称是 **cjx 知微录**。

当前能力：

- 首页展示、文章列表、项目入口。
- Markdown 文章系统。
- Supabase 登录、注册、留言和回复评论。
- APlayer 音乐播放器，支持 Karpov 音乐源、MetingJS fallback、本地 fallback。
- Cloudflare Worker 音乐代理。
- Cloudflare R2 播放过的音频缓存。
- 五子棋、中国象棋、你画我猜等独立页面。

项目目录：

```text
C:/Users/cjx/Documents/Playground/myweb
```

## 2. 本地运行

服务入口：

```text
server.js
```

常用命令：

```bash
npm install
npm start
npm test
npm run new:post -- "文章标题"
npm run import:posts
npm run deploy:music-worker
```

默认端口：

```text
12811
```

如果部署平台提供 `PORT` 环境变量，则使用平台端口。

## 3. 主站页面

核心页面：

```text
index.html      首页
post.html       文章详情页
comments.html   留言页
```

三页共用：

```text
assets/site.css
assets/site.js
assets/music-player.css
assets/music-player.js
supabase_all_in_one.jwt.js
```

三个页面都有稳定 SPA 容器：

```html
<main id="siteRoute" class="shell-inner page-grid">
```

`assets/site.js` 使用 History API 在首页、文章页和留言页之间做 SPA 导航，避免音乐播放器在切换页面时重载。游戏页面不走 SPA 路由。

## 4. 后端 Express

`server.js` 负责：

- 静态文件托管：`app.use(express.static(__dirname))`
- Markdown 文章接口
- 本地 Karpov 音乐代理兜底
- 健康检查

接口：

```text
GET /api/posts
GET /api/posts/:slug
GET /api/music/playlist
GET /api/music/url
GET /api/music/audio
GET /api/music/lyric
GET /health
```

本地服务器没有 R2，因此 `/api/music/audio` 在本地/服务器侧只是兜底重定向；正式域名下的 R2 音频缓存主要由 Cloudflare Worker 处理。

## 5. 文章系统

文章目录：

```text
posts/
```

文章格式：Markdown + front matter。

后端解析：

- `gray-matter` 解析 front matter。
- `marked` 转 HTML。

前端兜底：

- 文章接口不可用时，`assets/site.js` 会尝试读取 `posts/<slug>.md`。

注意：Typora 导入图片时，不要保留 `C:\Users\...` 或 `file:///...` 本地路径。图片应复制到 `assets/` 等公开目录，再用相对路径引用。

## 6. Supabase 评论/账号

核心文件：

```text
supabase_all_in_one.jwt.js
```

能力：

- 全局登录/注册 UI。
- 评论发布。
- 回复评论。
- 评论列表渲染。
- SPA 页面切换后的 comments remount。

维护点：

- 前端 anon key 可以公开。
- 权限控制要靠 Supabase 后台 RLS。
- 评论相关 DOM id 不要随意改，完整性测试会检查关键 API。

## 7. 音乐播放器

前端文件：

```text
assets/music-config.js
assets/music-player.js
assets/music-player.css
assets/vendor/aplayer/APlayer.min.css
assets/vendor/aplayer/APlayer.min.js
assets/vendor/meting/Meting.min.js
```

初始化顺序：

1. Karpov 源。
2. MetingJS fallback。
3. 本地 `assets/music/background.wav` fallback。

前端配置文件 `assets/music-config.js` 只放公开配置，不放 API key、cookie 或 Bearer token。

播放器特点：

- APlayer native fixed + mini。
- 桌面可拖动，位置保存在 `localStorage.siteMusicPosition`。
- 播放意图保存在 `localStorage.siteMusicWanted`。
- 音量保存在 `localStorage.siteMusicVolume`。
- Karpov 歌单 metadata 全量加载，音频和歌词按当前歌曲 lazy-load。

## 8. Cloudflare 音乐 Worker

Worker 文件：

```text
cloudflare-music-worker.js
```

部署配置：

```text
wrangler-music.toml
```

支持路由：

```text
/api/music/playlist
/api/music/url
/api/music/audio
/api/music/lyric
/music/playlist
/music/url
/music/audio
/music/lyric
```

环境变量 / Secret：

```text
KARPOV_GATEWAY_API_KEY
KARPOV_GATEWAY_COOKIE
KARPOV_GATEWAY_BASE_URL
KARPOV_MUSIC_PROVIDER
KARPOV_MUSIC_PLAYLIST_ID
KARPOV_MUSIC_QUALITY
```

R2 bucket binding：

```text
MUSIC_BUCKET
```

缓存策略：

```text
歌单 metadata       1 小时
歌词 LRC           30 天
歌曲 URL 查询结果   短缓存，按上游 expiresInSeconds 收缩
音频内容 R2 缓存    Worker 通过 /api/music/audio 返回
```

R2 音频对象路径：

```text
audio/<provider>/<song-id>/<quality>
```

R2 音频缓存限制：

```text
900MB
```

超限策略：

- 写入新音频前统计 `audio/` 总大小。
- 如果总大小加新文件超过 900MB，按上传时间删除最旧的一半对象。
- 再写入新音频。

这样做是为了减少频繁小规模清理带来的 R2 A 类操作。

## 9. Cloudflare 其它 Worker

项目里还有：

```text
cloudflare-draw-guess-worker.js
cloudflare-reverse-proxy-worker.js
wrangler.toml
wrangler-proxy.toml
```

用途：

- `draw-guess` Worker：你画我猜联机相关，包含 Durable Object。
- `reverse-proxy` Worker：反代/回源辅助。

## 10. 部署清单

主站服务器上传：

```text
server.js
index.html
post.html
comments.html
assets/
posts/
supabase_all_in_one.jwt.js
package.json
package-lock.json
scripts/
```

音乐 Worker 单独部署：

```text
cloudflare-music-worker.js
wrangler-music.toml
```

不要上传/提交：

```text
.env
.env.*
node_modules/
```

## 11. 检查命令

```bash
node --check server.js
node --check assets/music-player.js
node --check cloudflare-music-worker.js
node --check scripts/site-integrity.test.mjs
npm test
```

`npm test` 会检查：

- 站点完整性。
- 音乐播放器与 Worker/R2 关键行为。
- Markdown 导入选择。
- 游戏移动端布局。
- 你画我猜脚本。

## 12. 排查顺序

遇到问题时先分层：

1. 浏览器缓存版本号是否更新。
2. HTML 是否加载了最新 CSS/JS。
3. `assets/site.js` 或 `assets/music-player.js` 是否报错。
4. `server.js` 本地接口是否正常。
5. Cloudflare Worker 路由是否命中。
6. Worker 环境变量和 R2 binding 是否正确。
7. Supabase RLS/表结构是否允许当前操作。
8. 服务器端口和 Cloudflare 回源规则是否匹配。
