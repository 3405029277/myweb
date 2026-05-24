# Game Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both game pages more comfortable on phones with a board-first layout.

**Architecture:** Keep the existing single-file game pages. Add mobile-only CSS and minimal DOM hooks so controls become bottom overlays while board sizing uses available dynamic viewport space.

**Tech Stack:** Static HTML, inline CSS/JS, Node test scripts.

---

### Task 1: Mobile Layout Contract Test

**Files:**
- Create: `scripts/game-mobile-layout.test.mjs`
- Modify: `package.json`

- [ ] Write a Node test that reads both game HTML files and asserts mobile layout markers exist.
- [ ] Run `node scripts/game-mobile-layout.test.mjs` and confirm it fails before implementation.
- [ ] Add the test to `npm test`.

### Task 2: Gomoku Mobile Layout

**Files:**
- Modify: `五子棋.html`

- [ ] Make the phone layout board-first with compact header and bottom overlay controls.
- [ ] Keep desktop layout unchanged.
- [ ] Preserve existing element ids so game logic continues working.

### Task 3: Xiangqi Mobile Layout

**Files:**
- Modify: `中国象棋ai.html`

- [ ] Make the phone layout board-first with compact header and bottom overlay controls.
- [ ] Adjust `fitBoard()` mobile spacing if needed so the board is not squeezed by controls.
- [ ] Preserve existing element ids and online logic.

### Task 4: Verification

**Files:**
- Existing tests only.

- [ ] Run `npm test`.
- [ ] Start local server if visual checking is needed.
- [ ] Inspect mobile-sized layout for no obvious overlap.
