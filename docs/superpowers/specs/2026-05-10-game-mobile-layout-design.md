# Game Mobile Layout Design

Goal: optimize the game pages for phone play by prioritizing board size and moving controls out of the top-heavy layout.

Chosen direction: full-screen board first. On small screens, the board should occupy the center of the viewport, essential state stays in a compact top overlay, and common actions sit in a bottom overlay. Secondary controls can remain available but must not squeeze the board.

Scope:
- Update `五子棋.html` mobile layout.
- Update `中国象棋ai.html` mobile layout.
- Preserve existing game logic, online room flow, and desktop layout.
- Add a lightweight integrity test for the expected mobile layout hooks.

Acceptance:
- Mobile CSS uses dynamic viewport height.
- Header/status is compact and overlay-like on phones.
- Bottom controls are fixed/overlay-like on phones.
- Game board keeps a stable large area without being pushed off-screen.
