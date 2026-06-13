import fs from "node:fs";
import assert from "node:assert/strict";

const files = [
  { path: "五子棋.html", label: "gomoku" },
  { path: "中国象棋ai.html", label: "xiangqi" }
];

for (const file of files) {
  const html = fs.readFileSync(file.path, "utf8");
  assert.match(html, /@media\s*\(max-width:\s*520px\)/, `${file.label} should have phone media rules`);
  assert.match(html, /100dvh/, `${file.label} should use dynamic viewport height`);
  assert.match(html, /mobile-board-first/, `${file.label} should mark the board-first mobile layout`);
  if (file.label === "xiangqi") {
    assert.match(html, /\.controls/, `xiangqi should keep its mobile control bar`);
  }
  if (file.label === "gomoku") {
    assert.match(html, /mobile-primary-bar/, `gomoku should define a compact primary mobile bar`);
    assert.match(html, /mobile-drawer/, `gomoku should define a mobile overflow drawer`);
    assert.match(html, /id="mobileMore"/, `gomoku should expose a more button`);
    assert.match(html, /const\s+SIZE\s*=\s*17\b/, `gomoku should use a 17x17 board`);
    assert.match(html, /previewMove/, `gomoku should track preview moves before placing`);
    assert.match(html, /confirmPreviewOrMove/, `gomoku should require confirming a preview before placing`);
  }
}

console.log("game mobile layout test passed");

