import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import matter from "gray-matter";

const projectRoot = process.cwd();
const postsDir = path.resolve(projectRoot, "posts");

function parseArgs(argv) {
  const result = {
    source: "",
    category: "",
    tags: "",
    description: "",
    pick: "",
    overwrite: false,
    noPrompt: false
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--") && !result.source) {
      result.source = token;
      continue;
    }

    if (token === "--overwrite") {
      result.overwrite = true;
      continue;
    }

    if (token === "--no-prompt") {
      result.noPrompt = true;
      continue;
    }

    if (token.startsWith("--category=")) {
      result.category = token.slice("--category=".length);
      continue;
    }

    if (token === "--category") {
      result.category = argv[++i] || "";
      continue;
    }

    if (token.startsWith("--tags=")) {
      result.tags = token.slice("--tags=".length);
      continue;
    }

    if (token === "--tags") {
      result.tags = argv[++i] || "";
      continue;
    }

    if (token.startsWith("--description=")) {
      result.description = token.slice("--description=".length);
      continue;
    }

    if (token === "--description") {
      result.description = argv[++i] || "";
      continue;
    }

    if (token.startsWith("--pick=")) {
      result.pick = token.slice("--pick=".length);
      continue;
    }

    if (token === "--pick") {
      result.pick = argv[++i] || "";
    }
  }

  return result;
}

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

function normalizeTags(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

function firstHeading(content) {
  const match = String(content || "").match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function firstParagraph(content) {
  const blocks = String(content || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    if (/^#{1,6}\s+/.test(block)) {
      continue;
    }

    const text = block
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function summarize(content, fallback) {
  const text = firstParagraph(content);
  if (!text) {
    return fallback;
  }

  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isMarkdownFile(filePath) {
  return [".md", ".markdown"].includes(path.extname(filePath).toLowerCase());
}

function walkMarkdownFiles(dirPath) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && isMarkdownFile(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function formatRelativeList(baseDir, files) {
  return files
    .map((filePath, index) => {
      const rel = path.relative(baseDir, filePath);
      return `${String(index + 1).padStart(2, "0")}. ${rel}`;
    })
    .join("\n");
}

async function chooseSourceFile(rl, sourcePath, files, pick = "") {
  if (files.length === 1) {
    console.log(`Selected: ${path.relative(sourcePath, files[0]) || path.basename(files[0])}`);
    return files[0];
  }

  if (pick) {
    const index = Number(pick);
    if (Number.isInteger(index) && index >= 1 && index <= files.length) {
      return files[index - 1];
    }
    throw new Error(`Invalid pick value: ${pick}`);
  }

  console.log("Markdown files:");
  console.log(formatRelativeList(sourcePath, files));
  console.log("");

  while (true) {
    const answer = (await rl.question(`Choose a file [1-${files.length}]: `)).trim();
    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= files.length) {
      return files[index - 1];
    }
    console.log("Invalid selection.");
  }
}

function buildFrontMatter(meta, body) {
  const lines = [
    "---",
    `title: ${meta.title}`,
    `date: ${meta.date}`,
    `description: ${meta.description}`,
    `category: ${meta.category}`,
    "tags:"
  ];

  for (const tag of meta.tags) {
    lines.push(`  - ${tag}`);
  }

  lines.push(`gameUrl: ${meta.gameUrl || ""}`);
  lines.push("---", "");

  const normalizedBody = String(body || "").trimStart();
  lines.push(normalizedBody || "# Untitled");
  lines.push("");
  return lines.join("\n");
}

function deriveTargetBody(title, body) {
  const trimmed = String(body || "").trim();
  if (!trimmed) {
    return [
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
      "```"
    ].join("\n");
  }

  if (/^#\s+/m.test(trimmed)) {
    return trimmed;
  }

  return `# ${title}\n\n${trimmed}`;
}

async function main() {
  ensureDir(postsDir);
  const cli = parseArgs(process.argv.slice(2));

  const rl = readline.createInterface({ input, output });

  try {
    const sourceInput = (cli.source || (await rl.question("Markdown file or folder path: "))).trim();
    if (!sourceInput) {
      throw new Error("Path is required.");
    }

    const sourcePath = path.resolve(sourceInput);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Path does not exist: ${sourcePath}`);
    }

    const stats = fs.statSync(sourcePath);
    const sourceFiles = stats.isDirectory()
      ? walkMarkdownFiles(sourcePath)
      : isMarkdownFile(sourcePath)
        ? [sourcePath]
        : [];

    if (sourceFiles.length === 0) {
      throw new Error("No markdown files found.");
    }

    const selectedFiles = stats.isDirectory()
      ? [await chooseSourceFile(rl, sourcePath, sourceFiles, cli.pick)]
      : sourceFiles;

    const defaultCategory = cli.category || (cli.noPrompt ? "题解" : (await rl.question("Default category [题解]: ")).trim()) || "题解";
    const defaultTags = normalizeTags(
      cli.tags || (cli.noPrompt ? "题解, 算法" : (await rl.question("Default tags, comma separated [题解, 算法]: ")).trim()),
      ["题解", "算法"]
    );
    const defaultDescription = cli.description
      || (cli.noPrompt ? "这篇文章整理题目思路、关键结论和代码实现。" : (await rl.question("Default description [这篇文章整理题目思路、关键结论和代码实现。]: ")).trim())
      || "这篇文章整理题目思路、关键结论和代码实现。";
    let allowOverwrite = cli.overwrite;
    if (!cli.noPrompt && !allowOverwrite) {
      const overwriteAnswer = (await rl.question("Overwrite existing file? [y/N]: ")).trim().toLowerCase();
      allowOverwrite = overwriteAnswer === "y" || overwriteAnswer === "yes";
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const filePath of selectedFiles) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const baseName = path.basename(filePath, path.extname(filePath));
      const title = String(parsed.data.title || firstHeading(parsed.content) || baseName).trim();
      const slug = slugify(parsed.data.slug || baseName || title);

      if (!slug) {
        console.log(`Skip: ${filePath} (invalid slug)`);
        skippedCount += 1;
        continue;
      }

      const meta = {
        title,
        date: String(parsed.data.date || today()).trim(),
        description: String(parsed.data.description || summarize(parsed.content, defaultDescription)).trim(),
        category: String(parsed.data.category || defaultCategory).trim(),
        tags: normalizeTags(parsed.data.tags, defaultTags),
        gameUrl: String(parsed.data.gameUrl || "").trim()
      };

      const targetPath = path.join(postsDir, `${slug}.md`);
      if (fs.existsSync(targetPath) && !allowOverwrite) {
        console.log(`Skip: ${targetPath} already exists`);
        skippedCount += 1;
        continue;
      }

      const body = deriveTargetBody(title, parsed.content);
      const finalContent = buildFrontMatter(meta, body);

      fs.writeFileSync(targetPath, finalContent, "utf8");
      createdCount += 1;
      console.log(`Imported: ${path.basename(targetPath)}`);
    }

    console.log("");
    console.log(`Done. Created ${createdCount}, skipped ${skippedCount}.`);
    console.log(`Posts directory: ${postsDir}`);
  } catch (error) {
    console.error(`Failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
