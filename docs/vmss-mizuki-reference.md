# blog.vmss.cn (Mizuki v9) 实站逆向笔记

> 2026-06-12 用 CDP 桥接实测提取。目标:为 myweb 复刻提供精确参照。
> 技术栈:Astro + Tailwind + Svelte islands + swup(页面过渡)+ overlayscrollbars。图标为内联 SVG sprite。

## 1. 设计令牌(实测 computed 值)

```css
/* 全部颜色由 --hue 驱动,oklch 色彩系统(滑块 0-360,localStorage 持久化) */
--hue: 150;                              /* 实测时为 150(绿);可变 */
--primary: oklch(.7 .14 var(--hue));
--page-bg: oklch(.95 .01 var(--hue));    /* 浅色页面底 */
--card-bg: white;
--deep-text: oklch(.25 .02 var(--hue));
--title-active: oklch(.6 .1 var(--hue));
--btn-content: oklch(.55 .12 var(--hue));
--btn-regular-bg: oklch(.95 .025 var(--hue));
--btn-plain-bg-hover: oklch(.95 .025 var(--hue));
--enter-btn-bg: oklch(.95 .025 var(--hue));
--enter-btn-bg-hover: oklch(.9 .05 var(--hue));
--codeblock-bg: oklch(.97 .005 var(--hue));
--line-color: rgba(0,0,0,.1);
--meta-divider: rgba(0,0,0,.2);
--license-block-bg: rgba(0,0,0,.03);

--page-width: 90rem;        /* 1440px */
--radius-large: 1rem;
--banner-height: 35vh;      /* 内页 */
--banner-height-home: 65vh; /* 首页 */
--banner-height-extend: 280px;
--toc-width: calc((100vw - 90rem) / 2 - 1rem);
```

- `.card-base`:`bg rgba(255,255,255,.85)` + `backdrop-filter: blur(20px)`,圆角 16px,**无边框**,阴影 `0 4px 16px rgba(0,0,0,.08)`。
- html 根字号:`text-[14px] md:text-[16px]`。
- 字体:`ZenMaruGothic-Medium, "萝莉体 第二版", system-ui, ...`(myweb 已同款)。banner 标题同字体 weight 700。

## 2. 页面骨架(body 直接子层)

```
body.min-h-screen.lg:is-home.enable-banner
├─ #page-progress-bar                      顶部进度条
├─ div.fixed.inset-0                       固定全屏壁纸层
│   ├─ 桌面 6 张 img.object-cover (md:block)   crossfade: opacity 0/1, transition 1s
│   └─ 移动 6 张 img (md:hidden)               路径 /assets/desktop-banner/N.webp
├─ #top-row > #navbar-wrapper (sticky top-0) > #navbar (h-[4.5rem], max-w page-width)
├─ #banner-wrapper (absolute z-10, 首页 65vh)
│   ├─ #banner-carousel (slot div + <template> 懒切换,桌面/移动各一组)
│   ├─ .banner-text-overlay (absolute inset-0 居中)
│   │   ├─ h1.banner-title    text-6xl lg:text-8xl text-white drop-shadow-lg
│   │   └─ h2.banner-subtitle text-xl lg:text-3xl text-white/90 + 打字机
│   └─ #header-waves          SVG 波浪分隔(见 §6)
├─ div.absolute.z-30 > #main-grid (max-w page-width, gap 16px)
│   ├─ div.contents
│   │   ├─ #sidebar (max-w 17.5rem)        左侧栏,见 §4
│   │   └─ .right-sidebar-container        右侧栏(DOM 存在,lg:block;1699px 视口未显示,
│   │                                       推测受布局配置/更宽断点控制)
│   ├─ main#swup-container                 swup 只换这块
│   └─ .footer (lg:hidden 移动版页脚)
├─ floating-controls-container             右下浮动按钮组(音乐、回顶等,is-collapsed 折叠)
├─ #toc-wrapper (2xl:block)                页面外侧悬浮 TOC
└─ #page-height-extend (h-[300vh])         swup 过渡时撑高占位
```

## 3. 导航栏

- 左:logo 图 + `Mumuhaha Blog`(btn-plain)。
- 中 `#navbar-links-container`(md:flex):每项 `div.dropdown-container.group` 包 `a/button.btn-plain.rounded-lg.h-11.font-bold` + `.dropdown-menu > .dropdown-content`(hover 展开)。
  - 菜单实测:主页 / 归档 / 链接(GitHub、Bilibili、Gitee)/ 我的(追番 /anime/、日记 /diary/、相册 /albums/、我的设备 /devices/)/ 关于(关于 /about/、友链 /friends/)/ 其他(项目展示 /projects/、技能展示 /skills/、时间线 /timeline/)。
- 右(均 w-11 h-11 btn-plain):搜索(lg 内联输入框 + 移动 #search-switch)、#mobile-toc-switch、#display-settings-switch(色相滑块面板 `#colorSlider`)、明暗 #scheme-switch(双图标旋转切换)、移动 #nav-menu-switch。
- 移动菜单 `#nav-menu-panel.float-panel`:`.mobile-menu-item` + `.mobile-dropdown/.mobile-submenu` 折叠子菜单。
- navbar 上沿有 `div.absolute.h-8.-top-8.bg-[var(--card-bg)]` 防滚动露缝条。

## 4. 侧栏

左侧栏(每块 `widget-layout.pb-4.card-base`,标题行 = 竖条 + 粗体;响应式做了 3 份变体 md:hidden / md-only / lg):
1. **资料卡** `.card-base.p-3`:方形头像 `rounded-xl`(整体是去 /about/ 的链接,hover 黑色遮罩 + 名片图标浮现,active:scale-95);名字粗体居中;**强调色短横线** `h-1 w-5 bg-[var(--primary)] rounded-full mx-auto`;签名一行打字机;社交图标排 `btn-regular rounded-lg h-10 w-10`(Bilibili/Gitee/GitHub/QQ…)。
2. **公告**:文字 + 可关闭按钮。
3. **标签**:pill 云,«更多» 展开。
4. (sticky 区)**目录**:文章页显示 TOC,无目录时显示“当前页面没有目录”。

右侧栏(DOM 中):站点统计(文章 92 / 分类 16 / 标签 88 / 总字数 137,993 / 运行天数 1169 天 / 最后活动 6 天前)、日历、分类(名称+计数)、音乐播放器(歌单列表 + 进度)。

## 5. 主列

**分类条卡**(主列第一张卡 `#category-bar.card-base.p-3`):横向滚动 pill 条 = 🏠主页 icon-pill + `归档 92` + 竖线分隔 + 各分类 `astro 2 / c/c++ 19 / python 23 …`;激活 pill = `--primary` 底白字;两端渐隐 `.scroll-fade`。

**文章列表 = 双列网格**(桌面)。卡片 `.card-base.flex.flex-col-reverse.md:flex-col.rounded-[var(--radius-large)].overflow-hidden.onload-animation`,行内变量 `--i`(序号)+ `--interval: 50ms` 做交错入场,`--coverWidth: 28%`。

卡片解剖:
- 标题 `a`:`font-bold text-3xl text-90 hover:text-[var(--primary)]`;**before 伪元素强调竖条** `before:w-1 before:h-5 before:rounded-md before:bg-[var(--primary)] before:absolute before:left-[1.125rem]`(md 起显示);置顶帖前置 📌 pin SVG;hover 时右侧滑出 chevron(`opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0`)。
- meta 行:`text-neutral-500`,三组 `[图标 .meta-icon + 文本 text-sm font-medium]`:📅 日期、📖 分类(链到 /archive/?category=)、📄 `N 字`。
- 摘要 `.text-75`。
- 标签行:`# tag` = `btn-regular h-6 text-xs px-2 rounded-lg`,链到 /archive/?tag=。
- **右缘进入按钮**(桌面):`a.btn-regular.w-[3.25rem].absolute.right-3.top-3.bottom-3.rounded-xl` 内置大号 chevron,`bg var(--enter-btn-bg)` hover 加深,active:scale-95。正文区因此 `w-[calc(100%-3.25rem-0.75rem)]`。
- 封面图(有则占右侧 28%,移动端翻到顶部,flex-col-reverse 实现)。

**分页**:居中圆角方块,`‹ 1 2 3 4 5 … 12 ›`,当前页 primary 底。

## 6. 横幅与波浪

- 壁纸轮播 = 固定层 12 张 img 改 opacity crossfade(`transition-opacity duration-1000`),桌面/移动分组;#banner-carousel 内另有 slot+template 结构。
- 标题打字机:`span.typewriter` + `data-text='["...","..."]' data-speed=100 data-delete-speed=50 data-pause-time=2000`,内联 module script 驱动;多条文案轮换。
- **波浪**:经典 SVG `gentle-wave` 4 层 parallax:
  ```html
  <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v48h-352z"/>
  <!-- 4 个 use:opacity .25/.5/.75/1, fill var(--page-bg),
       animation-delay -2/-3/-4/-5s, duration 7/10/13/20s -->
  ```
  容器 `h-[10vh] md:h-[15vh] max-h-[9.375rem] min-h-[3.125rem] absolute -bottom-[1px]`。波浪用 `--page-bg` 填充,与下方页面底色无缝衔接。

## 7. 页脚 & 杂项

- 页脚三行:`赣ICP备…号` / `© 2026 木木em哈哈. All Rights Reserved. / RSS / Atom / Sitemap` / `Powered by Astro & Mizuki Version 9.0`。
- swup 过渡:`main#swup-container.transition-swup-fade`,html 有 `swup-enabled`。
- 全站入场动画 `onload-animation`(配合 --i/--interval 交错上浮)。
- 明暗双模式:dark 下卡片转深色(`dark:` 前缀类齐全)。

## 8. 对 myweb 的落地清单(按优先级)

1. 配色体系换 oklch + 浅色默认:`--primary/--page-bg/--btn-*` 全套挂 --hue(现有 hue 滑块直接复用)。卡片改 `白底 .85 + blur(20px) + 0 4px 16px rgba(0,0,0,.08)`,去边框、去渐变描边。
2. 文章列表改双列网格 + Mizuki 卡片解剖(标题竖条、icon meta 行、# 小标签、右缘进入按钮、28% 封面)。
3. 主列顶部加分类 pill 条卡(现 topTagBar/postFilters 合并改造)。
4. banner:壁纸 crossfade 轮播 + 站名大标题 + 打字机副标题(古诗轮播可改造成打字机文案数组,保留特色);底部 clip-path 椭圆换 SVG gentle-wave 4 层动画。
5. 导航 hover 下拉菜单 + 移动折叠子菜单。
6. onload 交错入场动画(--i/--interval)。
7. 侧栏资料卡改方头像+短横线+打字机签名+方块社交按钮;加“目录”侧栏卡。
8. 页脚补 RSS/Sitemap 行。
9. 缺失页面(友链/时间线/项目展示/技能展示…)后补。

⚠️ 动手前先看 `scripts/site-integrity.test.mjs` 相关断言,HTML/CSS 结构变更需同步测试。
