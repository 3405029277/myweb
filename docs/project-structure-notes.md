# 项目结构备忘录

这个文档是给现在的我和以后的我看的，重点记录这个网站当前的页面结构、代码入口、接口和部署关系。

## 1. 项目是什么

这是一个以 `Node + Express + 静态页面` 为主的网站项目，主站名字是 **cjx 知微录**。

当前主要内容分成四类：

- 首页展示
- Markdown 文章系统
- 留言/账号系统
- 几个独立小游戏页面

项目根目录：`C:/Users/cjx/Documents/Playground/myweb`

## 2. 运行方式

核心启动文件：`C:/Users/cjx/Documents/Playground/myweb/server.js`

`package.json` 里的主要脚本：

```json
{
  "start": "node server.js",
  "test": "node scripts/site-integrity.test.mjs && node scripts/import-select.test.mjs && node scripts/game-mobile-layout.test.mjs && node scripts/draw-guess.test.mjs",
  "new:post": "node scripts/new-post.mjs",
  "import:posts": "node scripts/import-posts.mjs"
}
```

启动逻辑：

- `npm install`
- `npm start`

服务监听端口：

- 默认端口：`12622`
- 如果平台提供环境变量，则优先使用 `process.env.PORT`

对应代码：

```js
const port = process.env.PORT ? Number(process.env.PORT) : 12622;
app.listen(port, "0.0.0.0", () => {
  console.log("Server listening on port", port);
});
```

## 3. 后端结构

后端很轻，主要负责两件事：

- 托管整个站点的静态文件
- 提供文章列表和文章详情接口

### 3.1 静态资源托管

```js
app.use(express.static(__dirname));
```

这意味着 `myweb` 目录下的 html、css、js、图片等文件都可以直接访问。

### 3.2 文章接口

接口有两个：

- `GET /api/posts`
- `GET /api/posts/:slug`

文章来源目录：`C:/Users/cjx/Documents/Playground/myweb/posts`

文章格式：Markdown + front matter。

后端用到的库：

- `gray-matter`：解析 front matter
- `marked`：把 Markdown 转成 HTML

### 3.3 健康检查

健康检查接口：

- `GET /health`

返回：`ok`

这个接口适合用来测试服务是否正常启动。

## 4. 前端页面结构

当前主站核心是 3 个页面：

- `index.html`：首页
- `post.html`：文章详情页
- `comments.html`：留言页

它们共用一套样式和一套主逻辑脚本：

- 样式：`C:/Users/cjx/Documents/Playground/myweb/assets/site.css`
- 主脚本：`C:/Users/cjx/Documents/Playground/myweb/assets/site.js`
- 音乐播放器样式：`C:/Users/cjx/Documents/Playground/myweb/assets/music-player.css`
- 音乐播放器脚本：`C:/Users/cjx/Documents/Playground/myweb/assets/music-player.js`
- 评论/账号逻辑：`C:/Users/cjx/Documents/Playground/myweb/supabase_all_in_one.jwt.js`

### 4.1 首页 `index.html`

首页是三栏结构：

- 左栏：个人信息、页面导航、文章分类
- 中栏：一言、展示图、项目区、文章区
- 右栏：热门文章、博客信息、热门标签

顶部导航包含：

- 首页
- 文章
- 项目
- 归档
- 留言

首页中部主要模块：

1. `quote-card`
   - 显示一段固定文案

2. `xiaowu-showcase`
   - 首页展示图
   - 带轻微视差效果

3. `projects`
   - 项目区
   - 当前入口包括：
     - `五子棋.html`
     - `中国象棋ai.html`
     - `你画我猜.html`
     - 对应项目笔记文章

4. `posts`
   - 文章列表区
   - 支持文章列表加载、分类/标签信息展示

首页还有一个首屏加载动画：

- 头像环形进度
- 随机诗句轮播
- 百分比进度文本

对应逻辑在 `site.js` 的 `setupPageLoader()`。

### 4.2 文章页 `post.html`

文章页延续三栏布局：

- 左栏：站点简介和返回入口
- 中栏：文章正文
- 右栏：目录和快捷入口

主要功能：

- 根据 URL 上的 `slug` 加载文章
- 显示分类、标题、日期、标签
- 生成目录
- 支持复制文章链接
- 渲染 Markdown 正文
- 渲染数学文本样式
- 高亮 C++ 代码块

文章加载优先方式：

1. 请求 `/api/posts/:slug`
2. 如果接口不可用，再尝试前端兜底读取文章信息

### 4.3 留言页 `comments.html`

留言页也是统一三栏结构，但中间主区换成评论交互。

主要功能：

- 登录
- 注册
- 忘记密码
- 退出登录
- 注销账号
- 发表评论
- 回复评论

页面元素包括：

- 邮箱输入框
- 密码输入框
- 用户名输入框
- 登录/注册/找回密码按钮
- 评论输入框
- 评论列表区域

账号与评论逻辑主要依赖：

- `supabase_all_in_one.jwt.js`

## 5. 公共前端行为

`assets/site.js` 负责大多数公共行为：

- 主题切换（亮色 / 暗色）
- 顶部导航移动端展开
- 顶部滚动进度条
- 首页文章加载
- 文章详情加载
- Markdown 渲染补充处理
- 数学文本替换渲染
- C++ 代码高亮
- 首页展示图视差效果
- 首屏加载动画

### 5.1 主题系统

主题状态保存在浏览器：

- `localStorage.theme`

支持：

- `light`
- `dark`

### 5.2 文章数据兜底

首页里有一个 `window.__SITE_POSTS__`，作为接口失败时的兜底数据。

目前至少内置了两篇：

- `gomoku-product-notes`
- `xiangqi-ui-notes`

## 6. 独立页面 / 小游戏

当前项目里有几个独立页面，不走文章系统主流程，但属于网站内容的一部分：

- `C:/Users/cjx/Documents/Playground/myweb/五子棋.html`
- `C:/Users/cjx/Documents/Playground/myweb/中国象棋ai.html`
- `C:/Users/cjx/Documents/Playground/myweb/你画我猜.html`

相关脚本：

- `C:/Users/cjx/Documents/Playground/myweb/draw-guess.js`
- `C:/Users/cjx/Documents/Playground/myweb/online.js`

另外还有备份文件夹：

- `backup-before-*`

这些目录是你之前改 UI 或玩法时留下的快照，后面如果要清理，先确认没有仍在参考的版本。

## 7. Cloudflare 相关文件

项目里有两个 Cloudflare Worker 相关文件：

- `C:/Users/cjx/Documents/Playground/myweb/cloudflare-draw-guess-worker.js`
- `C:/Users/cjx/Documents/Playground/myweb/cloudflare-reverse-proxy-worker.js`

对应配置文件：

- `C:/Users/cjx/Documents/Playground/myweb/wrangler.toml`
- `C:/Users/cjx/Documents/Playground/myweb/wrangler-proxy.toml`

当前用途大致分两类：

1. `draw-guess` Worker
   - 用于你画我猜联机相关能力
   - 配了 Durable Object：`DrawGuessRoom`

2. `reverse-proxy` Worker
   - 用于 Cloudflare 反代/回源链路
   - 最近这次问题就是这里相关的“端口回源规则”还指向旧端口

## 8. 当前部署关系备忘

这是这次最该记住的一段。

### 8.1 真实网站服务

你当前网站程序本身能访问，实际可用地址是：

- `http://93.115.101.176:12811/`

这说明：

- Node 服务是活的
- 程序本身没挂
- 公网高位端口能通

### 8.2 域名访问失败的真正原因

不是代码问题，也不是 `npm install` 问题。

这次故障的真实原因是：

- **端口回源规则还指向之前的旧端口**

所以域名请求虽然进了 Cloudflare/代理层，但最后被转发到了错误端口，导致打不开。

### 8.3 端口回源规则是干什么的

它的作用就是：

- 用户访问域名
- 前面的代理层再把请求转到你真正运行应用的端口

也就是把类似这种访问：

- `https://你的域名`

转给真正应用：

- `http://93.115.101.176:12811`

或者：

- `http://127.0.0.1:12811`

### 8.4 以后迁机时最容易忘的点

如果以后再换机器、换端口、换面板，优先检查这几项：

1. Node 实际监听端口变没变
2. 面板里域名绑定的目标端口对不对
3. Cloudflare 或代理层的回源规则对不对
4. 旧的端口转发/反代规则有没有残留

## 9. 内容文件分布

你以后最常改的地方，大概率是这些：

- 首页：`C:/Users/cjx/Documents/Playground/myweb/index.html`
- 文章页：`C:/Users/cjx/Documents/Playground/myweb/post.html`
- 留言页：`C:/Users/cjx/Documents/Playground/myweb/comments.html`
- 公共样式：`C:/Users/cjx/Documents/Playground/myweb/assets/site.css`
- 公共交互：`C:/Users/cjx/Documents/Playground/myweb/assets/site.js`
- 文章目录：`C:/Users/cjx/Documents/Playground/myweb/posts`
- 服务入口：`C:/Users/cjx/Documents/Playground/myweb/server.js`

## 10. 我给自己的一句话总结

这个项目不是传统前后端分离系统，更接近：

- 一个 Express 托管的静态站
- 外加 Markdown 文章 API
- 外加 Supabase 留言/账号能力
- 外加几个独立游戏页面
- 外加 Cloudflare 代理/Worker 辅助能力

以后排查时，先分清问题在哪一层：

- 页面文件层
- 前端脚本层
- Node 接口层
- Supabase 层
- Cloudflare / 回源 / 域名层

这样就不容易又绕回“是不是 Node 没装好”这种假问题里。
