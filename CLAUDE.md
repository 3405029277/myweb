# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install            # install deps
npm start              # run Express server on 127.0.0.1:12811 (or $PORT)
npm test               # run all four test suites (see below)
npm run new:post -- "标题"   # scaffold a new posts/*.md article
npm run import:posts         # import existing markdown into posts/
npm run deploy:music-worker  # wrangler deploy -c wrangler-music.toml

# ⚠️ 每次改动前必须备份
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

## Architecture

Static-first site. Express (`server.js`) serves the repo root as static files and adds JSON/proxy APIs. The same site also runs as pure static hosting because every server feature has a client-side or Worker fallback.

**SPA routing (`assets/site.js`).** `index.html`, `post.html`, `comments.html` are separate files but navigate as a SPA: link clicks are intercepted, the target page is fetched, and the `<main id="siteRoute" class="shell-inner page-grid">` container is swapped via `DOMParser` + `importNode`. History API (`pushState`/`popstate`) drives back/forward. Game pages (`五子棋.html`, `中国象棋ai.html`, `你画我猜.html`) are deliberately excluded from SPA interception and load as full page navigations. `initRoute()` dispatches per-page setup; `routeCleanup[]` tears down listeners/observers on each navigation to avoid leaks.

**Posts: dual-path with local fallback.** `server.js` exposes `/api/posts` and `/api/posts/:slug`, parsing `posts/*.md` with `gray-matter` + `marked`. When the API is unavailable (static hosting), `site.js` fetches `posts/<slug>.md` directly and renders it with its own `parseFrontMatter` + `markdownToHtml` + `renderMathText`. Both paths must stay behavior-compatible. C++ syntax highlighting and a lightweight `$…$`/`$$…$$` math renderer are client-side only.

**Music: three-layer fallback.** Priority is Karpov server proxy → MetingJS → local `assets/music/background.wav`, orchestrated in `assets/music-player.js` (`initKarpov().catch(initFallback)`). The player is APlayer in native `fixed` + `mini` mode, draggable on desktop, and survives SPA navigation via the `__SITE_MUSIC_READY__` guard. Playlist metadata loads eagerly; audio URLs and lyrics load lazily per track (`buildAudioUrl`/`buildLyricUrl`).

**`server.js` and `cloudflare-music-worker.js` are parallel implementations** of the same `/api/music/{playlist,url,audio,lyric}` routes — same caching constants (`monthSeconds`, `songUrlBrowserSeconds`), same lyric normalization (`extractLyricText`, `convertKarpovJsonLyric`). The Worker additionally caches audio bytes in R2 (binding `MUSIC_BUCKET`, 900MB cap, evicts oldest half via `evictOldAudioObjects`). When editing one, mirror the change in the other or `site-integrity.test.mjs` will fail.

**Auth/comments (`supabase_all_in_one.jwt.js`)** is a single global script loaded by all three HTML pages. It builds its own auth UI (`ensureGlobalAuthUI`) and exposes `window.SiteComments.mountComments()` so `initRoute` can remount threaded comments (`parent_id`) after SPA navigation.

## Conventions that the tests enforce

`scripts/site-integrity.test.mjs` is a large set of regex assertions against source files — it is effectively a spec. Two things break it most often:

- **Versioned asset query strings.** All three HTML files must load the exact versions the test pins, e.g. `assets/music-player.css?v=22`, `assets/music-player.js?v=29`, `assets/music-config.js?v=3`. Bumping a file's contents means bumping the `?v=N` in every HTML file *and* the assertion.
- **No secrets in client/browser files.** `assets/music-config.js` and `cloudflare-music-worker.js` source are asserted to contain no `Bearer`/API-key/cookie patterns. Karpov `KARPOV_GATEWAY_API_KEY`/`KARPOV_GATEWAY_COOKIE` live only in `server.js` env (`.env`, gitignored) or Worker secrets.

The test also pins specific player behaviors (no autoplay, native mini mode, lazy audio/lyric loading, no custom slide-panel chrome). Read the relevant assertions before changing `music-player.js`/`.css` — many forbid old approaches via `assert.doesNotMatch`.

## Notes

- ESM throughout (`"type": "module"`). `.env` is loaded by a hand-rolled `loadEnvFile` in `server.js`, not dotenv.
- Imported Typora images must not keep `C:\Users\...` or `file:///` paths — copy to `assets/` and use relative paths (`import-posts.mjs` handles this).
- `backup-before-*` directories are throwaway snapshots; ignore them.

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
