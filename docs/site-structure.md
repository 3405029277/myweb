# myweb 站点结构文档

> 最后更新：2026-06-12 (Mizuki 复刻完成)

## 一、页面清单与功能

### 核心页面
1. **index.html** - 首页
   - Hero banner (65vh) + 古诗打字机轮播（相思主题 6 句）
   - 双列 page-grid 布局（left-rail + main-column + right-rail）
   - 文章列表网格 (#postGrid)
   - 分类筛选条 (#categoryBar)
   - 侧栏：作者卡、公告卡、标签云、站点统计

2. **post.html** - 文章详情页
   - 必需钩子：`articleTitle`, `articleCategory`, `articleMeta`, `articleContent`, `articleToc`, `copyArticleLink`
   - Hero-bar 顶栏（非 banner）
   - 左侧：返回链接、导航
   - 右侧：目录、相关文章

3. **comments.html** - 留言板
   - **Supabase 集成钩子（11 个，缺一不可）**：
     - `commentInput` - 评论输入框
     - `btnPost` - 发表按钮
     - `commentList` - 评论列表容器
     - `commentAuthStatus` - 登录状态文本
     - `commentAuthTip` - 登录提示
     - `commentCount` - 评论计数
     - `pageKey` - 页面标识符（显示在界面）
     - `replyTarget` - 回复目标显示区
     - `commentTip` - 底部提示文本
     - `data-open-auth` - 登录按钮触发器
     - `data-auth-cta` - 登录引导容器
   - 脚本加载顺序：先 `supabase_all_in_one.jwt.js?v=12`，最后 `site.js`

4. **archive.html** - 文章归档
   - 时间线布局
   - 分类筛选

5. **about.html** - 关于页
   - 个人简介
   - 技能展示

6. **links.html** - 友情链接
   - 卡片网格布局
   - 链接分组

### 游戏页面
- **五子棋.html** - 五子棋 AI 对战 + 联机
- **中国象棋ai.html** - 中国象棋 AI + 联机
- **你画我猜.html** - 你画我猜联机游戏
  - 必需元素：`guessInput`, `customWordInput`, `drawCanvas`, `fullscreenCanvasBtn`, `exitFullscreenBtn`, `toastBox`
  - 全屏模式 CSS：`body.drawerFullscreenMode .topbar { display: none }`
  - 禁用移动端缩放：`maximum-scale=1`

## 二、技术栈与资源

### 样式系统
- **主样式**：`assets/site.css?v=20260612-vmss`
- **音乐播放器样式**：`assets/music-player.css?v=22`
- **第三方 CSS**：`assets/vendor/aplayer/APlayer.min.css`
- **字体**：IBM Plex Sans + Noto Serif SC (Google Fonts)

### 脚本系统
```html
<!-- 核心脚本加载顺序 (index/post/comments) -->
<script src="supabase_all_in_one.jwt.js?v=12"></script>  <!-- 仅 post/comments -->
<script src="assets/posts-manifest.js?v=20260612-vmss"></script>
<script src="assets/vendor/aplayer/APlayer.min.js"></script>
<script src="assets/vendor/meting/Meting.min.js"></script>
<script src="assets/music-config.js?v=3"></script>
<script src="assets/music-player.js?v=30"></script>
<script src="assets/site.js?v=20260612-vmss"></script>

<!-- archive/about/links 不需要 supabase_all_in_one -->
```

### 音乐播放器架构
1. **Karpov API**（优先）：`https://karpov.pics/api/music/?server={server}&type={type}&id={id}`
2. **MetingJS fallback**：`<meting-js>` 组件自动降级
3. **本地播放器 fallback**：15 秒超时后创建 `assets/music/background.wav` 本地播放器

配置文件：`assets/music-config.js?v=3`
```javascript
window.MUSIC_CONFIG = {
  source: 'netease',
  type: 'playlist',
  id: '2829883691',
  karpovEnabled: true
};
```

### 主题系统
```javascript
// localStorage 持久化配置
theme: 'light' | 'dark'           // 默认 light
wallpaperMode: 'banner' | 'full' | 'hidden'  // 默认 banner
listLayout: 'grid' | 'list'       // 默认 grid
hue: 0-360                        // 默认 275 (紫色)
```

## 三、HTML 结构规范

### 必需 data 属性
```html
<body data-page="home|post|comments|archive|about|links">
```

### 导航结构（所有页面统一）
```html
<header class="site-header" id="siteHeader">
  <div class="nav-row shell-inner">
    <a class="brand" href="index.html">
      <img class="brand-logo" src="assets/logo.png" alt="logo">
      <strong>cjx 知微录</strong>
    </a>
    <nav class="site-nav" id="siteNav">
      <!-- 主导航 + 下拉菜单 -->
    </nav>
    <div class="nav-actions">
      <!-- 搜索、设置、主题切换、移动菜单 -->
    </div>
  </div>
</header>
```

### 模态框（所有页面统一）
```html
<!-- 搜索面板 -->
<div class="search-panel site-modal" id="searchPanel" hidden>
  <div class="modal-backdrop"></div>
  <section class="modal-card">
    <button class="modal-close" data-close-search>×</button>
    <h2>搜索文章</h2>
    <input id="searchInput" type="search">
    <div class="search-results" id="searchResults"></div>
  </section>
</div>

<!-- 显示设置面板 -->
<div class="display-panel site-modal" id="displaySettings" hidden>
  <div class="modal-backdrop"></div>
  <section class="modal-card">
    <button class="modal-close" data-close-settings>×</button>
    <h2>显示设置</h2>
    <label>主题色相 <input id="hueRange" type="range" min="0" max="360"></label>
    <div class="setting-grid">
      <button data-wallpaper="banner">横幅模式</button>
      <button data-wallpaper="full">全屏模式</button>
      <button data-wallpaper="hidden">隐藏壁纸</button>
      <button data-layout="grid">网格</button>
      <button data-layout="list">列表</button>
    </div>
  </section>
</div>
```

### Hero 区域
```html
<!-- 首页：hero-banner (65vh + SVG waves) -->
<section class="hero-banner" id="siteBanner">
  <img class="banner-img is-active" src="assets/xiaowu.png" alt="">
  <div class="banner-text-overlay">
    <div class="banner-text-inner onload-animation" style="--i:0">
      <h2 class="banner-subtitle">
        <span class="typewriter" id="bannerTypewriter" 
              data-speed="100" 
              data-delete-speed="50" 
              data-pause-time="2000" 
              data-text='["古诗1","古诗2",...]'></span>
      </h2>
    </div>
  </div>
  <div class="waves" aria-hidden="true">
    <svg viewBox="0 24 150 28" preserveAspectRatio="none">
      <defs><path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s..."/></defs>
      <g class="parallax">
        <use href="#gentle-wave" x="48" y="0"></use>
        <use href="#gentle-wave" x="48" y="3"></use>
        <use href="#gentle-wave" x="48" y="5"></use>
        <use href="#gentle-wave" x="48" y="7"></use>
      </g>
    </svg>
  </div>
</section>

<!-- 其他页面：hero-bar (简化版) -->
<section class="hero-bar">
  <div class="shell-inner">
    <p>Eyebrow</p>
    <h1>页面标题</h1>
    <span>副标题</span>
  </div>
</section>
```

### Page Grid 布局
```html
<main id="siteRoute" class="shell-inner page-grid">
  <!-- 左侧栏 -->
  <aside class="left-rail">
    <section class="panel author-card onload-animation" style="--i:1">
      <a class="profile-avatar-wrap" href="about.html">
        <img class="sidebar-avatar" src="assets/avatar.jpg" alt="头像">
      </a>
      <h2>cjx 知微录</h2>
      <p class="profile-desc">
        <span class="typewriter" id="profileTypewriter"
              data-text='["签名1","签名2"]'></span>
      </p>
    </section>
    <!-- 其他侧栏卡片 -->
  </aside>

  <!-- 主列 -->
  <section class="main-column">
    <!-- 页面特定内容 -->
  </section>

  <!-- 右侧栏 -->
  <aside class="right-rail">
    <section class="panel stats-card">
      <h3>站点统计</h3>
      <div class="stat-list">
        <span>文章 <strong id="statPostCount">-</strong></span>
        <!-- 更多统计项 -->
      </div>
    </section>
  </aside>
</main>
```

## 四、测试规范

### 测试文件
1. `scripts/site-integrity.test.mjs` - 核心页面完整性
2. `scripts/import-select.test.mjs` - 导入选择器测试
3. `scripts/game-mobile-layout.test.mjs` - 游戏移动端布局
4. `scripts/draw-guess.test.mjs` - 你画我猜功能测试

### 关键断言
```javascript
// 音乐播放器（index/post/comments 必需）
assert.match(html, /supabase_all_in_one\.jwt\.js/);
assert.match(html, /assets\/vendor\/aplayer\/APlayer\.min\.css/);
assert.match(html, /assets\/vendor\/aplayer\/APlayer\.min\.js/);
assert.match(html, /assets\/vendor\/meting\/Meting\.min\.js/);
assert.match(html, /assets\/music-config\.js\?v=3/);
assert.match(html, /assets\/music-player\.css\?v=22/);
assert.match(html, /assets\/music-player\.js\?v=30/);

// 样式版本（所有页面）
assert.match(html, /assets\/site\.css\?v=20260612-vmss/);
assert.match(html, /assets\/site\.js\?v=20260612-vmss/);

// SPA 容器（所有页面）
assert.match(html, /<main id="siteRoute" class="shell-inner page-grid">/);
```

## 五、开发工作流

### 修改前必做
```bash
git add -A && git stash push -m "描述 $(date +%Y%m%d-%H%M%S)"
```

### 修改后验证
```bash
npm test  # 必须全部通过
```

### 版本号规则
- 大改（结构/功能）：更新日期版本 `20260612-vmss`
- 小改（样式/文本）：递增数字版本 `v=30 -> v=31`
- **改完必须同步更新测试断言**

### 禁止操作
❌ 删除 Supabase 钩子（comments.html 会失去留言功能）
❌ 修改 `data-page` 属性（site.js 路由依赖）
❌ 改变脚本加载顺序（依赖关系硬编码）
❌ 删除 `id="siteRoute"` 容器（SPA 基座）

## 六、设计令牌

### 颜色系统（CSS 变量）
```css
--hue: 275;  /* 可调 0-360 */
--primary: oklch(.7 .14 var(--hue));
--page-bg: oklch(.95 .01 var(--hue));
--card-bg: white;
--deep-text: oklch(.25 .02 var(--hue));
```

### 响应式断点
```css
/* 移动端优先 */
@media (min-width: 768px)  { /* 平板 */ }
@media (min-width: 1024px) { /* 桌面 */ }
@media (min-width: 1280px) { /* 大屏 */ }
```

### 动画系统
```css
/* 入场动画 */
.onload-animation {
  --i: 0;  /* 序号，用于交错延迟 */
  animation: fadeInUp 0.6s ease calc(var(--i) * 0.1s) both;
}
```

## 七、备份策略

### 关键备份点
1. 每次大改前：`git stash push -m "改动描述"`
2. 原始版本：`C:\Users\cjx\Documents\Playground\myweb-main\`（只读参考）
3. 测试通过后：考虑 `git commit`

### 恢复方法
```bash
# 查看 stash 列表
git stash list

# 恢复最新 stash（不删除）
git stash apply

# 恢复指定 stash
git stash apply stash@{2}

# 从原版复制单个文件
cp ../myweb-main/comments.html .
```

## 八、已知问题与注意事项

### 音乐播放器
- Karpov API 不可用时自动降级到 MetingJS
- MetingJS 超时 15 秒后降级到本地播放器
- **不要**手动删除 `<meting-js>` DOM（会导致 fallback 逻辑失效）

### UTF-8 编码
- 所有 HTML 必须 UTF-8 无 BOM
- Git checkout 可能损坏中文文件名文件（如"你画我猜.html"），需从原版重新复制

### 浏览器兼容
- 目标：Chrome/Edge 最新版 + Safari 16+ + Firefox 最新版
- 使用 CSS `oklch()` 色彩空间（不支持旧浏览器）

---

**维护者注意**：修改任何核心结构前，先运行 `npm test` 确认当前状态，改完再测一次。
