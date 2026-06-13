import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("你画我猜.html", "utf8");
const client = fs.readFileSync("draw-guess.js", "utf8");
const worker = fs.readFileSync("cloudflare-draw-guess-worker.js", "utf8");
const home = fs.readFileSync("index.html", "utf8");

assert.match(home, /你画我猜\.html/, "home page should link to draw-and-guess game");

assert.match(page, /你画我猜/, "game page should expose the game title");
assert.match(page, /maximum-scale=1/, "game page should disable mobile zoom");
assert.match(page, /draw-guess\.js\?v=9/, "game page should load versioned client script v9");
assert.match(page, /id="guessInput"/, "guesser should have an input box");
assert.match(page, /id="customWordInput"/, "host should be able to add custom words");
assert.match(page, /id="drawCanvas"/, "drawer should have a drawing canvas");
assert.match(page, /id="fullscreenCanvasBtn"/, "mobile users should be able to enter fullscreen drawing mode");
assert.match(page, /id="exitFullscreenBtn"/, "fullscreen drawing mode should have an exit button");
assert.match(page, /id="toastBox"/, "mobile guess feedback should be shown in a visible toast");
assert.match(page, /body\.drawerFullscreenMode\s+\.topbar\s*\{\s*display:\s*none/, "drawer fullscreen mode should hide the site topbar");
assert.match(page, /body\.drawerFullscreenMode\s+\.game-shell\s*\{\s*width:\s*100/, "drawer fullscreen mode should let the game shell fill the viewport");
assert.match(page, /换我来画/, "new round button should manually switch drawer when needed");
assert.match(page, /直接画这个词/, "custom word UI should set the current drawing word directly");
assert.match(page, /玩法规则/, "game page should explain rules for new users");
assert.match(page, /两人进入同一个房间/, "rules should explain room joining");
assert.match(page, /<aside class="panel room-panel">/, "room and rules should stay in the left panel on desktop");
assert.match(page, /rotate\(90deg\)/, "mobile fullscreen canvas should rotate into landscape when orientation lock fails");

assert.match(client, /DEFAULT_WORDS/, "client should include a default word library");
assert.match(client, /drawGuessRoom/, "client should remember the room across refreshes");
assert.match(client, /updateRoomUrl/, "client should keep room code in the URL");
assert.match(client, /wss:\/\/www\.cjx88\.eu\.cc\/draw\/ws/, "client should default to the www websocket endpoint on production");
assert.match(client, /requestNewRound/, "client should request manual turn switching when needed");
assert.match(client, /直接画这个词/, "client should label custom words as direct drawing words");
assert.match(client, /scheduleReconnect/, "client should reconnect dropped websocket sessions");
assert.match(client, /startHeartbeat/, "client should keep websocket sessions warm");
assert.match(client, /enterFullscreenCanvas/, "client should support fullscreen canvas mode");
assert.match(client, /lockLandscape/, "client should try to lock landscape in fullscreen canvas mode");
assert.match(client, /screen\.orientation\.lock\("landscape"\)/, "client should request landscape orientation lock");
assert.match(client, /rotatedFullscreen/, "client should enable CSS-rotated fullscreen fallback");
assert.match(client, /只有画画的人才能全屏画板/, "client should only allow the drawer to enter fullscreen canvas mode");
assert.match(client, /document\.body\.classList\.add\("drawerFullscreenMode"\)/, "client should switch the page into drawer fullscreen mode");
assert.match(client, /visualViewport/, "client should react to mobile visual viewport changes while fullscreen is active");
assert.match(client, /unlockOrientation/, "client should unlock orientation after exiting fullscreen canvas mode");
assert.match(client, /showToast/, "client should show visible mobile feedback");
assert.match(client, /sendGuess/, "client should send guesses through websocket");
assert.match(client, /addCustomWord/, "client should support adding room custom words");
assert.match(client, /WebSocket/, "client should connect with websocket");

assert.match(worker, /MAX_PLAYERS\s*=\s*2/, "worker should limit rooms to two player names");
assert.match(worker, /class\s+DrawGuessRoom/, "worker should define durable object room class");
assert.match(worker, /nameKey/, "worker should use nickname as the player identity");
assert.match(worker, /EMPTY_ROOM_TTL_MS\s*=\s*10 \* 60 \* 1000/, "worker should keep empty rooms for 10 minutes before cleanup");
assert.match(worker, /scheduleRoomCleanup/, "worker should schedule delayed empty-room cleanup");
assert.match(worker, /resetRoom\(/, "worker should reset empty rooms after the cleanup delay");
assert.match(worker, /roomFull/, "worker should reject a third distinct nickname");
assert.match(worker, /message\.type === "guess"/, "worker should handle guess messages");
assert.match(worker, /message\.type === "setCustomWord"/, "worker should handle direct custom word messages");
assert.match(worker, /startWord\(/, "worker should start a round from a chosen or custom word");
assert.match(worker, /startWordPick\(this\.pickNextDrawer/, "worker should auto-switch drawer after a completed round");
assert.match(worker, /message\.type === "ping"/, "worker should handle heartbeat messages");
assert.match(worker, /handleSession/, "worker should accept websocket sessions");
assert.match(worker, /轮到/, "worker should keep readable Chinese logs");

console.log("draw guess test passed");









