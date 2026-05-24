import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const postsDir = path.join(__dirname, "posts");
const port = process.env.PORT ? Number(process.env.PORT) : 12622;

marked.setOptions({
  gfm: true,
  breaks: false
});

function normalizePostMeta(slug, data = {}) {
  const tags = Array.isArray(data.tags)
    ? data.tags.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug;
  const description = typeof data.description === "string" && data.description.trim()
    ? data.description.trim()
    : "";
  const category = typeof data.category === "string" && data.category.trim()
    ? data.category.trim()
    : "Article";
  const gameUrl = typeof data.gameUrl === "string" ? data.gameUrl.trim() : "";

  return {
    slug,
    title,
    date: data.date || "",
    description,
    category,
    tags,
    gameUrl
  };
}

async function readPostFile(filename) {
  const slug = filename.replace(/\.md$/i, "");
  const fullPath = path.join(postsDir, filename);
  const source = await fs.readFile(fullPath, "utf8");
  const parsed = matter(source);
  const meta = normalizePostMeta(slug, parsed.data);
  const html = marked.parse(parsed.content);
  return {
    ...meta,
    html
  };
}

async function listPosts() {
  const entries = await fs.readdir(postsDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);

  const posts = await Promise.all(markdownFiles.map(readPostFile));
  return posts
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(({ html, ...meta }) => meta);
}

app.use(express.static(__dirname));

app.get("/api/posts", async (_, res) => {
  try {
    const posts = await listPosts();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to load posts." });
  }
});

app.get("/api/posts/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const post = await readPostFile(slug + ".md");
    res.json(post);
  } catch (error) {
    res.status(404).json({ error: "Post not found." });
  }
});

app.get("/health", (_, res) => res.send("ok"));

app.listen(port, "0.0.0.0", () => {
  console.log("Server listening on port", port);
});
