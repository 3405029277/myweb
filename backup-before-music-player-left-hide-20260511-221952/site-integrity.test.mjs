import assert from "node:assert/strict";
import fs from "node:fs";

const textFiles = [
  "index.html",
  "post.html",
  "comments.html",
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

assert.equal(siteJs.includes("year: 'long'"), false, "Intl year option must not use invalid long value");
assert.equal(siteJs.includes('year: "long"'), false, "Intl year option must not use invalid long value");
assert.match(siteJs, /posts\/.*\.md/, "post page should fall back to local markdown files");
assert.match(siteJs, /markdownToHtml/, "site script should render local markdown fallback");
assert.match(siteJs, /renderMathText/, "article renderer should support simple math display");
assert.match(siteJs, /renderSidebarStats/, "home page should render right rail stats");

for (const file of ["index.html", "post.html", "comments.html"]) {
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /supabase_all_in_one\.jwt\.js/, `${file} should load global auth script`);
  assert.match(html, /assets\/vendor\/aplayer\/APlayer\.min\.css/, `${file} should load local APlayer CSS`);
  assert.match(html, /assets\/vendor\/aplayer\/APlayer\.min\.js/, `${file} should load local APlayer JS`);
  assert.match(html, /assets\/music-player\.js\?v=5/, `${file} should load versioned music player script`);
}

const musicJs = fs.readFileSync("assets/music-player.js", "utf8");
const musicCss = fs.readFileSync("assets/music-player.css", "utf8");
assert.match(musicJs, /new APlayer/, "music player should initialize APlayer");
assert.match(musicJs, /fetch\(/, "music player should check that local audio exists before initializing");
assert.match(musicJs, /response\.ok/, "music player should skip missing audio sources cleanly");
assert.doesNotMatch(musicJs, /player\.play\(\)\.catch/, "music player should not assume APlayer play returns a Promise");
assert.doesNotMatch(musicJs, /player\.play\(\)/, "music player should not autoplay without a user gesture");
assert.match(musicJs, /siteMusicWanted/, "music player should remember play intent across pages");
assert.match(musicJs, /assets\/music\/background\.wav/, "music player should default to local music asset path");
assert.match(musicCss, /\.site-music-player\s*\{[\s\S]*bottom:\s*12px/, "music player should dock near the bottom");
assert.match(musicCss, /\.site-music-player:not\(:hover\)/, "music player should stay collapsed until hover or focus");
assert.match(musicCss, /\.site-music-player::after/, "collapsed music player should show a side tab");
assert.match(musicCss, /content:\s*"BGM"/, "collapsed music player should use a compact music label");
assert.match(musicJs, /classList\.add\("is-open"\)/, "music player should support tap-to-open on mobile");

assert.match(supabaseJs, /ensureGlobalAuthUI/, "auth script should create global auth UI");
assert.match(supabaseJs, /parent_id/, "comments script should support threaded replies");
assert.match(supabaseJs, /comment-thread/, "comments script should render comment-thread markup");

console.log("site integrity test passed");
