import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-import-select-"));
const sourceDir = path.join(tempRoot, "source");
const postsDir = path.join(repoRoot, "posts");
const targetSlug = "alpha";

fs.mkdirSync(sourceDir, { recursive: true });
fs.writeFileSync(path.join(sourceDir, "alpha.md"), "# Alpha\n\nBody alpha.\n", "utf8");
fs.writeFileSync(path.join(sourceDir, "beta.md"), "# Beta\n\nBody beta.\n", "utf8");

try {
  const result = spawnSync(process.execPath, ["scripts/import-posts.mjs", sourceDir, "--pick=1", "--no-prompt", "--category=Notes", "--tags=Import,Markdown", "--description=Imported from local markdown.", "--overwrite"], {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: "0" },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(path.join(postsDir, `${targetSlug}.md`)), "selected file should be imported");
  assert.ok(!fs.existsSync(path.join(postsDir, "beta.md")), "unselected file should not be imported");

  console.log("import selection test passed");
} finally {
  fs.rmSync(path.join(postsDir, `${targetSlug}.md`), { force: true });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
