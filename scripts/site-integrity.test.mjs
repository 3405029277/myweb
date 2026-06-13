import assert from "node:assert/strict";
import fs from "node:fs";

const textFiles = [
  "index.html",
  "post.html",
  "comments.html",
  "archive.html",
  "about.html",
  "links.html",
  "assets/site.css",
  "assets/site.js",
  "assets/music-player.css",
  "assets/music-player.js",
  "README.md"
];

for (const file of textFiles) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.includes(0), false, `${file} should not contain NUL bytes`);
}

const css = fs.readFileSync("assets/site.css", "utf8");
assert.equal(css.includes("\\n"), false, "CSS should not contain literal escaped newlines");
assert.match(css, /\.prose pre\s*\{[\s\S]*color:/, "code block should define explicit text color");
assert.match(css, /\.profile-avatar-wrap:hover\s+\.sidebar-avatar\s*\{[\s\S]*rotate\(360deg\)/, "sidebar avatar should rotate on hover");
assert.match(css, /\.brand:hover\s+\.brand-logo\s*\{[\s\S]*rotate\(-8deg\)/, "brand logo should tilt left on hover");
assert.match(css, /\.page-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(250px,\s*var\(--left-w\)\)\s+minmax\(0,\s*1fr\)\s+minmax\(250px,\s*var\(--right-w\)\)/, "layout should keep two side rails plus center");

const siteJs = fs.readFileSync("assets/site.js", "utf8");
const supabaseJs = fs.readFileSync("supabase_all_in_one.jwt.js", "utf8");
const serverJs = fs.readFileSync("server.js", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");

assert.equal(siteJs.includes("year: 'long'"), false, "Intl year option must not use invalid long value");
assert.equal(siteJs.includes('year: "long"'), false, "Intl year option must not use invalid long value");
assert.match(siteJs, /posts\/.*\.md/, "post page should fall back to local markdown files");
assert.match(siteJs, /markdownToHtml/, "site script should render local markdown fallback");
assert.match(siteJs, /renderMathText/, "article renderer should support simple math display");
assert.match(siteJs, /renderSidebarStats/, "home page should render right rail stats");
assert.match(siteJs, /pushState/, "site script should use History API for blog navigation");
assert.match(siteJs, /popstate/, "site script should support browser back and forward navigation");
assert.match(siteJs, /DOMParser/, "site script should parse fetched blog pages for SPA routing");
assert.match(siteJs, /五子棋|中国象棋ai|你画我猜/, "site script should leave game pages out of SPA routing");

for (const file of ["index.html", "post.html", "comments.html"]) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /supabase_all_in_one\.jwt\.js/, `${file} should load global auth script`);
  assert.match(html, /assets\/vendor\/aplayer\/APlayer\.min\.css/, `${file} should load local APlayer CSS`);
  assert.match(html, /assets\/vendor\/aplayer\/APlayer\.min\.js/, `${file} should load local APlayer JS`);
  assert.match(html, /assets\/vendor\/meting\/Meting\.min\.js/, `${file} should load local MetingJS`);
  assert.match(html, /assets\/music-config\.js\?v=3/, `${file} should load music config`);
  assert.match(html, /assets\/music-player\.css\?v=22/, `${file} should load versioned music player stylesheet`);
  assert.match(html, /assets\/music-player\.js\?v=30/, `${file} should load versioned music player script`);
  assert.match(html, /<main id="siteRoute" class="shell-inner page-grid">/, `${file} should expose stable SPA route container`);
}

for (const file of ["archive.html", "about.html", "links.html"]) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /assets\/site\.css\?v=20260613-mobile-v2/, `${file} should load the Mizuki redesign stylesheet`);
  assert.match(html, /assets\/site\.js\?v=20260613-mobile-v2/, `${file} should load the Mizuki redesign script`);
  assert.match(html, /<main id="siteRoute" class="shell-inner page-grid">/, `${file} should expose stable SPA route container`);
}

assert.match(siteJs, /initSearchPanel/, "site script should initialize a search panel");
assert.match(siteJs, /initDisplaySettings/, "site script should initialize display settings");
assert.match(siteJs, /postListLayout/, "site script should persist post list layout preference");
assert.match(siteJs, /wallpaperMode/, "site script should persist wallpaper mode preference");
assert.match(siteJs, /renderArchivePage/, "site script should render archive page filters and groups");
assert.match(siteJs, /renderCalendarWidget/, "site script should render the calendar widget");
assert.match(siteJs, /floating-toc-btn/, "article pages should expose a floating TOC control");
assert.match(serverJs, /wordCount/, "post API should include word count metadata");
assert.match(serverJs, /readingTime/, "post API should include reading time metadata");
assert.match(serverJs, /yearMonth/, "post API should include archive month metadata");
assert.match(serverJs, /pinned/, "post API should include pinned metadata");
assert.match(serverJs, /cover/, "post API should include cover metadata");

const musicJs = fs.readFileSync("assets/music-player.js", "utf8");
const musicCss = fs.readFileSync("assets/music-player.css", "utf8");
const musicConfigJs = fs.readFileSync("assets/music-config.js", "utf8");
const musicWorkerJs = fs.readFileSync("cloudflare-music-worker.js", "utf8");
assert.match(musicJs, /createElement\("meting-js"\)/, "music player should create MetingJS element for remote playlists");
assert.match(musicJs, /fetch\(/, "music player should fetch Karpov playlist through server proxy");
assert.match(musicJs, /cfg\.endpoint|\/api\/music\/playlist/, "music player should use configured music endpoint");
assert.match(musicJs, /new APlayer/, "music player should keep local APlayer fallback");
assert.match(musicJs, /createAPlayerContainer\(\)/, "direct APlayer paths should use a nested player container like MetingJS");
assert.match(musicConfigJs, /SITE_MUSIC_CONFIG/, "music config should expose global music config");
assert.match(musicConfigJs, /source:\s*"karpov"/, "music config should prefer Karpov source");
assert.match(musicConfigJs, /endpoint:\s*"\/api\/music\/playlist"/, "music config should point at music proxy route");
assert.match(musicConfigJs, /limit:\s*0/, "music config should request the full playlist metadata list");
assert.match(musicConfigJs, /:server[\s\S]*:type[\s\S]*:id/, "MetingJS api should keep placeholder template");
assert.doesNotMatch(musicConfigJs, /Bearer\s+|KARPOV_GATEWAY_API_KEY|api[_-]?key/i, "browser music config should not contain Karpov secrets");
assert.match(musicWorkerJs, /KARPOV_GATEWAY_API_KEY/, "music Worker should read Karpov API key from Worker environment");
assert.match(musicWorkerJs, /KARPOV_GATEWAY_COOKIE/, "music Worker should support Karpov cookie from Worker environment");
assert.match(musicWorkerJs, /\/api\/music\/playlist/, "music Worker should serve the same music proxy route");
assert.match(musicWorkerJs, /\/api\/music\/url/, "music Worker should keep lazy Karpov audio URL route");
assert.match(musicWorkerJs, /\/api\/music\/audio/, "music Worker should expose R2-backed audio proxy route");
assert.match(musicWorkerJs, /\/api\/music\/lyric/, "music Worker should lazy-proxy Karpov lyrics per track");
assert.match(musicWorkerJs, /cachedResponse/, "music Worker should cache playlist, audio URL, and lyric responses at Cloudflare edge");
assert.match(musicWorkerJs, /MUSIC_BUCKET/, "music Worker should use an R2 bucket binding for cached audio");
assert.match(musicWorkerJs, /r2AudioLimitBytes\s*=\s*900 \* 1024 \* 1024/, "music Worker should limit R2 audio cache to 900MB");
assert.match(musicWorkerJs, /evictOldAudioObjects/, "music Worker should evict oldest R2 audio objects when over cache limit");
assert.match(musicWorkerJs, /Math\.ceil\(objects\.length \/ 2\)/, "music Worker should delete the oldest half of cached audio when over the R2 limit");
assert.match(musicWorkerJs, /Accept-Ranges/, "music Worker should support browser audio range requests");
assert.match(musicWorkerJs, /monthSeconds\s*=\s*30 \* 24 \* 60 \* 60/, "music Worker should cache stable music resources for about one month");
assert.match(musicWorkerJs, /getSongUrlTtlSeconds/, "music Worker should shorten audio URL cache when upstream reports expiry");
assert.match(musicWorkerJs, /songUrlBrowserSeconds\s*=\s*10 \* 60/, "music Worker should only browser-cache signed audio redirects briefly");
assert.match(musicWorkerJs, /private, max-age=\$\{browserTtlSeconds\}/, "music Worker should give signed audio redirects a short private browser cache");
assert.match(musicWorkerJs, /site-music-cache\.local\/url/, "music Worker should edge-cache Karpov audio URL lookup results");
assert.match(musicWorkerJs, /cachedResponse\(request,\s*monthSeconds/, "music Worker should cache Karpov lyrics for about one month");
assert.doesNotMatch(musicWorkerJs, /cachedResponse\(request,\s*(?:1800|86400)|30 \* 60 \* 1000|24 \* 60 \* 60 \* 1000/, "music Worker should not use old short lyric cache TTLs");
assert.match(musicWorkerJs, /Access-Control-Allow-Origin/, "music Worker should allow browser music requests");
assert.match(musicWorkerJs, /extractLyricText/, "music Worker should normalize nested Karpov lyric responses");
assert.match(musicWorkerJs, /convertKarpovJsonLyric/, "music Worker should convert Karpov JSON-line lyrics into standard LRC");
assert.match(musicWorkerJs, /code !== 0 && body\.code !== 200/, "music Worker should accept Karpov code 200 success envelopes");
assert.doesNotMatch(musicWorkerJs, /mk_[A-Za-z0-9_-]+|sid=[A-Za-z0-9_-]+|csrf_token=[A-Za-z0-9_-]+/, "music Worker source should not contain Karpov secrets");
assert.doesNotMatch(musicJs, /player\.play\(\)\.catch/, "music player should not assume APlayer play returns a Promise");
assert.doesNotMatch(musicJs, /player\.play\(\)/, "music player should not autoplay without a user gesture");
assert.match(musicJs, /siteMusicWanted/, "music player should remember play intent across pages");
assert.match(musicJs, /siteMusicPosition/, "music player should remember dragged position on desktop");
assert.match(musicJs, /__SITE_MUSIC_READY__|getElementById\("siteMusicPlayer"\)/, "music player should guard against duplicate SPA initialization");
assert.match(musicJs, /assets\/music\/background\.wav/, "music player should default to local music asset path");
assert.match(musicJs, /fixed:\s*true|setAttribute\("fixed",\s*"true"\)/, "music player should use APlayer native fixed mode");
assert.match(musicJs, /mini:\s*true|setAttribute\("mini",\s*"true"\)/, "music player should start as APlayer native round mini mode");
assert.match(musicJs, /lrcType:\s*lyricsEnabled \? 3 : 0/, "music player should lazy-load Karpov lyrics through APlayer async lyric mode");
assert.match(musicJs, /buildAudioUrl/, "music player should lazy-load Karpov audio only when APlayer needs a track");
assert.match(musicJs, /replaceEndpointPath\("\/audio"\)/, "music player should stream tracks through the same-origin audio proxy");
assert.match(musicJs, /buildLyricUrl/, "music player should lazy-load Karpov lyrics per current track");
assert.match(musicJs, /siteMusicKarpovPlaylistFullLazyV1/, "music player should use a full-playlist local cache key");
assert.match(musicJs, /stripLyrics/, "music player should normalize track metadata before APlayer init");
assert.match(musicCss, /\.aplayer-fixed[\s\S]*bottom:/, "music player should position the native fixed player");
assert.match(musicCss, /aplayer-narrow[\s\S]*border-radius:\s*50%/, "music player native mini state should be circular");
assert.match(musicCss, /site-music-drag-handle/, "music player should style the drag handle");
assert.match(musicCss, /\.aplayer-fixed \.aplayer-lrc[\s\S]*display:\s*block/, "music player should show lyrics outside native mini mode");
assert.match(musicJs, /initKarpov\(\)\.catch\(initFallback\)/, "music player should fall back to Meting when Karpov is unavailable");
assert.doesNotMatch(musicJs, /site-music-force-mini/, "music player should not use forced mini chrome overrides");
assert.doesNotMatch(musicJs, /site-music-toggle|is-collapsed/, "music player should not use the custom expanded panel toggle");
assert.doesNotMatch(musicCss, /translate[XY]\(/, "music player should not use custom slide panels");
assert.doesNotMatch(musicCss, /\.site-music-player::after/, "music player should not render a custom floating tab");
assert.doesNotMatch(musicJs, /classList\.add\("is-open"\)/, "music player should not force custom open state");

assert.match(serverJs, /KARPOV_GATEWAY_API_KEY/, "server should read Karpov API key from environment");
assert.match(serverJs, /loadEnvFile/, "server should load local .env when host has no environment variable UI");
assert.match(gitignore, /^\.env$/m, ".gitignore should prevent committing local secret env file");
assert.match(serverJs, /\/api\/music\/playlist/, "server should expose Karpov music playlist proxy");
assert.match(serverJs, /\/api\/music\/url/, "server should expose lazy Karpov audio URL proxy");
assert.match(serverJs, /\/api\/music\/audio/, "server should expose audio proxy fallback route");
assert.match(serverJs, /\/api\/music\/lyric/, "server should expose lazy Karpov lyric proxy");
assert.match(serverJs, /Cache-Control/, "server should add cache headers for music proxy responses");
assert.match(serverJs, /monthSeconds\s*=\s*30 \* 24 \* 60 \* 60/, "server should cache stable music resources for about one month");
assert.match(serverJs, /getSongUrlTtlSeconds/, "server should shorten audio URL cache when upstream reports expiry");
assert.match(serverJs, /songUrlBrowserSeconds\s*=\s*10 \* 60/, "server should only browser-cache signed audio redirects briefly");
assert.match(serverJs, /private, max-age=\$\{browserTtlSeconds\}/, "server should give signed audio redirects a short private browser cache");
assert.doesNotMatch(serverJs, /max-age=1800|max-age=86400|30 \* 60 \* 1000|24 \* 60 \* 60 \* 1000/, "server should not use old short lyric cache TTLs");
assert.match(serverJs, /headers\.Authorization\s*=\s*`Bearer|Authorization:\s*`Bearer/, "server should call Karpov with bearer auth server-side");
assert.match(serverJs, /convertKarpovJsonLyric/, "server should convert Karpov JSON-line lyrics into standard LRC");

assert.match(supabaseJs, /ensureGlobalAuthUI/, "auth script should create global auth UI");
assert.match(supabaseJs, /SiteComments/, "comments script should expose SPA remount API");
assert.match(supabaseJs, /mountComments/, "comments script should remount comments after SPA navigation");
assert.match(supabaseJs, /parent_id/, "comments script should support threaded replies");
assert.match(supabaseJs, /comment-thread/, "comments script should render comment-thread markup");

console.log("site integrity test passed");
