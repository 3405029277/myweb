# myweb

## 本地运行

```bash
npm install
npm start
```

默认地址：

```text
http://127.0.0.1:3000
```

## 当前模式

- 首页显示项目入口、文章列表、留言板入口
- 文章放在 `posts/` 目录，格式为 Markdown
- 文章列表接口：`/api/posts`
- 文章详情接口：`/api/posts/:slug`
- 文章页如果接口临时不可用，会尝试从 `posts/<slug>.md` 直接兜底加载

## 发文章

新建文章：

```bash
npm run new:post -- "题解标题"
```

导入已有 Markdown：

```bash
npm run import:posts
```

## 检查

```bash
npm test
```
