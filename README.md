# cjx 知微录 / myweb

个人博客与项目展示站点，主站使用 Node.js + Express 托管静态页面和 Markdown 文章接口，评论/账号使用 Supabase，音乐代理与缓存使用 Cloudflare Worker + R2。

## 功能概览

- 首页三栏布局：个人信息、项目入口、文章列表、站点统计。
- Markdown 文章系统：`posts/` 目录存放文章，支持 front matter、目录、代码块和本地 Markdown 兜底渲染。
- 留言/评论系统：Supabase 登录、注册、评论、回复和 SPA remount。
- 音乐播放器：APlayer 固定迷你播放器，桌面可拖动，移动端适配，页面切换时保持播放。
- Karpov 音乐源：服务端/Worker 代理请求，前端不暴露 API key 或 cookie。
- Cloudflare R2 音频缓存：播放过的歌曲通过 Worker 缓存到 R2，缓存上限 900MB，超限删除最旧一半。
- 独立小游戏页面：五子棋、中国象棋、你画我猜等。

## 目录结构

```text
.
├── index.html                 # 首页
├── post.html                  # 文章详情页
├── comments.html              # 留言页
├── server.js                  # Express 服务入口
├── supabase_all_in_one.jwt.js # Supabase 登录/评论逻辑
├── cloudflare-music-worker.js # 音乐代理、歌词/歌单缓存、R2 音频缓存
├── wrangler-music.toml        # 音乐 Worker 部署配置
├── assets/
│   ├── site.css
│   ├── site.js
│   ├── music-config.js        # 公开音乐配置，不放密钥
│   ├── music-player.css
│   ├── music-player.js
│   └── vendor/                # APlayer / MetingJS 本地依赖
├── posts/                     # Markdown 文章
├── scripts/                   # 测试、发文、导入脚本
└── docs/                      # 项目结构备忘
```

## 本地运行

```bash
npm install
npm start
```

默认监听：

```text
http://127.0.0.1:12811
```

如果部署平台设置了 `PORT` 环境变量，会优先使用平台端口。

## 常用命令

```bash
npm test
npm run new:post -- "文章标题"
npm run import:posts
npm run deploy:music-worker
```

## 环境变量

本地可以在 `.env` 中配置，`.env` 已被 `.gitignore` 忽略，不要提交。

```text
KARPOV_GATEWAY_API_KEY=你的 Karpov API key
KARPOV_GATEWAY_COOKIE=可选 cookie
KARPOV_GATEWAY_BASE_URL=https://ldc.karpov.cn
KARPOV_MUSIC_PROVIDER=netease
KARPOV_MUSIC_PLAYLIST_ID=2668671168
KARPOV_MUSIC_QUALITY=MP3_320
```

服务器端 `server.js` 会读取 `.env`，浏览器端 `assets/music-config.js` 只保存公开配置，不包含密钥。

## 音乐系统

### 浏览器侧

`assets/music-player.js` 会优先使用 Karpov 源：

```text
/api/music/playlist  # 歌单元数据
/api/music/audio     # 音频代理/R2 缓存
/api/music/lyric     # 歌词
```

Karpov 不可用时回退到 MetingJS，再失败时回退本地 `assets/music/background.wav`。

### Cloudflare Worker

`cloudflare-music-worker.js` 支持：

```text
/api/music/playlist
/api/music/url
/api/music/audio
/api/music/lyric
```

缓存策略：

```text
歌单 metadata       1 小时
歌词 LRC           30 天
歌曲 URL 查询结果   短缓存，按上游过期时间收缩
音频内容 R2 缓存    30 天响应缓存，R2 总量限制 900MB
```

R2 绑定要求：

```text
Binding name: MUSIC_BUCKET
```

R2 对象路径示例：

```text
audio/netease/<song-id>/MP3_320
```

当 `audio/` 缓存总量加上新歌超过 900MB 时，Worker 会按上传时间删除最旧的一半音频对象，再写入新歌。

## Cloudflare 手动部署提示

如果在 Cloudflare 后台手动部署 Worker，需要确认：

1. Worker 代码是最新的 `cloudflare-music-worker.js`。
2. R2 bucket 已绑定到 Worker。
3. 绑定名是 `MUSIC_BUCKET`。
4. Karpov API key/cookie 配在 Worker 的变量或 Secret 中。
5. 路由指向站点域名下的 `/api/music/*`。

如果使用 Wrangler 部署，需要确保 `wrangler-music.toml` 与后台绑定保持一致。

## 文章发布

新建文章：

```bash
npm run new:post -- "题解标题"
```

导入已有 Markdown：

```bash
npm run import:posts
```

注意：从 Typora 导入的图片不要保留 `C:\Users\...` 或 `file:///...` 本地路径，应复制到 `assets/` 或其它公开资源目录后使用相对路径。

## 测试

```bash
npm test
```

测试覆盖：

- 站点核心 HTML/JS/CSS 完整性。
- 音乐播放器、Worker、R2 缓存关键断言。
- Markdown 导入选择逻辑。
- 游戏移动端布局。
- 你画我猜脚本。

## 部署上传清单

主站服务器通常需要上传：

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

不要上传或提交：

```text
.env
.env.*
node_modules/
```

## 安全说明

- Karpov API key 和 cookie 只放在服务器/Worker 环境变量里。
- 前端配置文件不得出现 `Bearer`、API key、cookie 等敏感信息。
- Supabase 前端 anon key 可公开，但数据库规则/RLS 要在 Supabase 后台控制权限。
- R2 音频缓存仅通过 Worker 访问，不需要公开 bucket 列表。
