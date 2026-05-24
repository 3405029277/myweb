import assert from "node:assert/strict";
import fs from "node:fs";

const textFiles = [
  "index.html",
  "post.html",
  "comments.html",
  "assets/site.css",
  "assets/site.js",
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
}

assert.match(supabaseJs, /ensureGlobalAuthUI/, "auth script should create global auth UI");
assert.match(supabaseJs, /parent_id/, "comments script should support threaded replies");
assert.match(supabaseJs, /comment-thread/, "comments script should render comment-thread markup");

console.log("site integrity test passed");
