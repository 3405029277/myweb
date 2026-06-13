# Cloudflare Worker VIP Cookie 配置教程

## 为什么需要 Cookie

网易云音乐 API 对非 VIP 用户限制部分歌曲播放。添加 VIP 账号 Cookie 后，Worker 可以代理你的 VIP 权限播放受限歌曲。

## 获取网易云 Cookie

### 方法 1：浏览器开发者工具（推荐）

1. **打开网易云音乐网页版**
   - 访问 https://music.163.com/
   - 登录你的 VIP 账号

2. **打开开发者工具**
   - Windows/Linux: 按 `F12` 或 `Ctrl + Shift + I`
   - Mac: 按 `Cmd + Option + I`

3. **切换到 Network（网络）标签**
   - 刷新页面 `F5`
   - 点击任意一个请求（如 `weapi/v1/resource/comments/get`）

4. **复制 Cookie**
   - 在右侧 Headers（请求头）中找到 `Cookie:` 字段
   - 复制完整的 Cookie 字符串

   示例格式：
   ```
   MUSIC_U=xxx; __csrf=yyy; ntes_kaola_ad=zzz; ...
   ```

### 方法 2：浏览器扩展（EditThisCookie）

1. 安装 [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg) 扩展
2. 登录网易云音乐
3. 点击扩展图标 → Export（导出）
4. 复制导出的 JSON 格式 Cookie

## 添加 Cookie 到 Cloudflare Worker

### 方法 1：使用 Secret（推荐，安全）

```bash
# 在项目目录运行
wrangler secret put NETEASE_COOKIE -c wrangler-music.toml
```

粘贴你复制的 Cookie，按 `Enter` 确认。

**优点：**
- ✅ Cookie 不出现在代码中
- ✅ 不会被 Git 提交
- ✅ 自动加密存储

### 方法 2：环境变量（简单，但不安全）

编辑 `wrangler-music.toml`：

```toml
[vars]
MUSIC_PROVIDER = "netease"
MUSIC_PLAYLIST_ID = "2668671168"
MUSIC_QUALITY = "320000"

# 取消注释并填入你的 Cookie
NETEASE_COOKIE = "MUSIC_U=xxx; __csrf=yyy; ..."
```

**缺点：**
- ⚠️ Cookie 明文存储在配置文件
- ⚠️ 容易被 Git 提交泄露

如果使用此方法，记得添加到 `.gitignore`：

```bash
echo "wrangler-music.toml" >> .gitignore
```

## 重新部署 Worker

```bash
npm run deploy:music-worker
```

## 验证 Cookie 是否生效

1. **打开浏览器控制台**
   - 访问你的网站
   - 按 `F12` 打开控制台

2. **检查播放器加载**
   - 观察是否能加载之前失败的 VIP 歌曲
   - Network 标签查看请求是否返回有效音频 URL

3. **测试 API**
   ```bash
   # 替换 SONG_ID 为一首 VIP 歌曲 ID
   curl "https://site-music-proxy.3405029277.workers.dev/api/music/url?id=SONG_ID"
   ```

   成功返回示例：
   ```json
   {"url":"http://m701.music.126.net/xxx.mp3","br":320000}
   ```

## Cookie 维护

### 过期时间
- 网易云 Cookie 通常 **30-90 天**过期
- 过期后需重新获取并更新

### 自动续期（可选）
如果你有 VPS，可以用 [mikus-loli/Meting-API](https://github.com/mikus-loli/Meting-API) 的 Docker 版本实现自动续期：

```bash
# 需要 VPS 环境
docker run -d -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/mikus-loli/meting-api:latest
```

管理后台支持 Cookie 监测 + 自动刷新。

## 安全建议

1. **不要分享 Cookie**
   - Cookie 包含你的账号凭证
   - 泄露后他人可登录你的账号

2. **定期更换**
   - 建议每 1-2 个月手动更新
   - 发现异常登录立即更换

3. **使用 Secret**
   - 生产环境务必用 `wrangler secret put`
   - 不要在公开仓库提交 Cookie

4. **监控使用**
   - Cloudflare Dashboard 可查看 Worker 请求量
   - 异常流量及时排查

## 故障排查

**问题：VIP 歌曲仍然无法播放**

1. 检查 Cookie 是否正确复制（没有截断）
2. 确认账号是 VIP 且未过期
3. 查看 Worker 日志：
   ```bash
   wrangler tail -c wrangler-music.toml
   ```

**问题：Cookie 过期提示**

重新获取 Cookie 并更新：
```bash
wrangler secret put NETEASE_COOKIE -c wrangler-music.toml
```

**问题：部分歌曲返回 404**

某些歌曲可能因版权下架，即使有 Cookie 也无法播放。

## 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [网易云音乐 API 文档](https://binaryify.github.io/NeteaseCloudMusicApi/)
