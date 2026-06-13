import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const postsDir = path.resolve(process.cwd(), "posts");
const [rawTitle, rawSlug] = process.argv.slice(2);

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTemplate(title) {
  return [
    "---",
    `title: ${title}`,
    `date: ${today()}`,
    "description: 这篇文章整理题目思路、关键结论和代码实现。",
    "category: 题解",
    "tags:",
    "  - 题解",
    "  - 算法",
    "gameUrl:",
    "---",
    "",
    `# ${title}`,
    "",
    "## 题目链接",
    "",
    "-",
    "",
    "## 题意",
    "",
    "-",
    "",
    "## 思路",
    "",
    "-",
    "",
    "## 代码",
    "",
    "```cpp",
    "",
    "```",
    ""
  ].join("\n");
}

if (!rawTitle) {
  console.error('Usage: npm run new:post -- "Title" [slug]');
  process.exit(1);
}

const title = rawTitle.trim();
const slug = slugify(rawSlug || rawTitle);

if (!slug) {
  console.error("Failed to generate slug.");
  process.exit(1);
}

if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

const filePath = path.join(postsDir, `${slug}.md`);

if (fs.existsSync(filePath)) {
  console.error(`Post already exists: ${filePath}`);
  process.exit(1);
}

fs.writeFileSync(filePath, buildTemplate(title), "utf8");

console.log(`Created: ${filePath}`);
console.log(`Open: post.html?slug=${slug}`);
