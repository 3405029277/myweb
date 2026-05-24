(function () {
  "use strict";
  const CUSTOM_WORD_LABEL = "直接画这个词";
  const DEFAULT_WORDS = [
    "苹果", "西瓜", "火锅", "奶茶", "月亮", "太阳", "雨伞", "书包", "手机", "电脑",
    "飞机", "火车", "地铁", "汽车", "自行车", "轮船", "城堡", "学校", "医院", "超市",
    "熊猫", "老虎", "兔子", "企鹅", "海豚", "鲨鱼", "蝴蝶", "蜜蜂", "恐龙", "机器人",
    "篮球", "足球", "羽毛球", "乒乓球", "滑板", "跳绳", "游泳", "跑步", "钓鱼", "露营",
    "钢琴", "吉他", "小提琴", "麦克风", "相机", "电视", "冰箱", "洗衣机", "电风扇", "台灯",
    "蛋糕", "饺子", "面条", "汉堡", "披萨", "寿司", "冰淇淋", "巧克力", "爆米花", "糖葫芦",
    "长城", "故宫", "东方明珠", "兵马俑", "黄山", "西湖", "沙漠", "森林", "海边", "雪山",
    "医生", "老师", "警察", "厨师", "画家", "司机", "宇航员", "程序员", "魔术师", "消防员",
    "春节", "红包", "烟花", "灯笼", "龙舟", "月饼", "风筝", "雪人", "圣诞树", "生日帽",
    "钥匙", "眼镜", "耳机", "闹钟", "地图", "镜子", "牙刷", "拖鞋", "雨衣", "礼物"
  ];

  const $ = (id) => document.getElementById(id);
  const els = {
    name: $("nameInput"), room: $("roomInput"), endpoint: $("endpointInput"), join: $("joinBtn"),
    newRound: $("newRoundBtn"), status: $("statusBox"), wordPick: $("wordPickPanel"), wordChoices: $("wordChoices"),
    canvas: $("drawCanvas"), color: $("colorInput"), size: $("sizeInput"), clear: $("clearBtn"), undo: $("undoBtn"),
    guess: $("guessInput"), guessBtn: $("guessBtn"), customWord: $("customWordInput"), addWord: $("addWordBtn"),
    players: $("playersList"), log: $("logList"), roundTitle: $("roundTitle"), roleText: $("roleText"),
    timer: $("timerText"), copyRoom: $("copyRoomBtn"), canvasPanel: $("canvasPanel"),
    fullscreen: $("fullscreenCanvasBtn"), exitFullscreen: $("exitFullscreenBtn"), toast: $("toastBox")
  };

  const ctx = els.canvas.getContext("2d");
  let ws = null;
  let clientId = "";
  let currentDrawerId = "";
  let currentWord = "";
  let isDrawing = false;
  let lastPoint = null;
  let strokes = [];
  let localStroke = null;
  let timerHandle = 0;
  let reconnectTimer = 0;
  let reconnectAttempts = 0;
  let manualClose = false;
  let heartbeatTimer = 0;

  init();

  function init() {
    const url = new URL(location.href);
    const savedRoom = localStorage.getItem("drawGuessRoom") || "";
    els.room.value = normalizeRoom(url.searchParams.get("room") || savedRoom || makeRoomCode());
    localStorage.setItem("drawGuessRoom", els.room.value);
    ensureRoomInUrl(els.room.value);
    els.name.value = localStorage.getItem("drawGuessName") || "";
    els.endpoint.value = localStorage.getItem("drawGuessEndpoint") || defaultEndpoint();
    resizeCanvas();
    addEvents();
    renderCanvas();
  }

  function addEvents() {
    window.addEventListener("resize", renderCanvas);
    els.join.addEventListener("click", connectRoom);
    els.newRound.addEventListener("click", requestNewRound);
    els.clear.addEventListener("click", clearCanvas);
    els.undo.addEventListener("click", undoStroke);
    els.guessBtn.addEventListener("click", sendGuess);
    els.guess.addEventListener("keydown", (event) => { if (event.key === "Enter") sendGuess(); });
    els.addWord.addEventListener("click", addCustomWord);
    els.customWord.addEventListener("keydown", (event) => { if (event.key === "Enter") addCustomWord(); });
    els.copyRoom.addEventListener("click", copyRoomLink);
    els.fullscreen.addEventListener("click", enterFullscreenCanvas);
    els.exitFullscreen.addEventListener("click", exitFullscreenCanvas);
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) { els.canvasPanel.classList.remove("fullscreenCanvas", "rotatedFullscreen"); unlockOrientation(); }
      setTimeout(renderCanvas, 80);
    });
    els.canvas.addEventListener("pointerdown", startDraw);
    els.canvas.addEventListener("pointermove", moveDraw);
    els.canvas.addEventListener("pointerup", endDraw);
    els.canvas.addEventListener("pointercancel", endDraw);
  }

  function connectRoom() {
    const name = els.name.value.trim();
    const room = normalizeRoom(els.room.value);
    if (!name || !room) return setStatus("请先填写昵称和房间号。", "bad");
    localStorage.setItem("drawGuessName", name);
    localStorage.setItem("drawGuessRoom", room);
    localStorage.setItem("drawGuessEndpoint", els.endpoint.value.trim());
    els.room.value = room;
    updateRoomUrl(room);
    const endpoint = buildWsUrl(room, name);
    manualClose = true;
    if (ws) ws.close();
    manualClose = false;
    ws = new WebSocket(endpoint);
    ws.addEventListener("open", () => {
      reconnectAttempts = 0;
      startHeartbeat();
      setStatus("已连接，等待房间同步。", "ok");
    });
    ws.addEventListener("message", (event) => handleMessage(JSON.parse(event.data)));
    ws.addEventListener("close", () => {
      stopHeartbeat();
      setConnected(false);
      if (manualClose) return;
      setStatus("连接断开，正在自动重连。", "bad");
      scheduleReconnect();
    });
    ws.addEventListener("error", () => setStatus("连接失败，请检查 Worker 地址。", "bad"));
  }

  function buildWsUrl(room, name) {
    let raw = els.endpoint.value.trim() || defaultEndpoint();
    if (raw.startsWith("/")) {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      raw = `${protocol}//${location.host}${raw}`;
    }
    const url = new URL(raw);
    url.searchParams.set("room", room);
    url.searchParams.set("name", name);
    return url.toString();
  }

  function handleMessage(message) {
    if (message.type === "pong") return;
    if (message.type === "hello") { clientId = message.clientId; setConnected(true); }    if (message.type === "roomFull") { setStatus(message.text || "房间已满。", "bad"); showToast(message.text || "房间已满。", "bad"); return; }
    if (message.type === "state") renderState(message);
    if (message.type === "stroke") { strokes.push(message.stroke); renderCanvas(); }
    if (message.type === "clear") { strokes = []; renderCanvas(); }
    if (message.type === "undo") { strokes.pop(); renderCanvas(); }
    if (message.type === "guessResult") handleGuessResult(message);
    if (message.type === "log") addLog(message.text);
    if (message.type === "wordChoices") renderWordChoices(message.words || []);
  }

  function renderState(state) {
    currentDrawerId = state.drawerId || "";
    currentWord = state.word || "";
    strokes = Array.isArray(state.strokes) ? state.strokes : strokes;
    const isDrawer = clientId && clientId === currentDrawerId;
    if (!currentDrawerId) els.roundTitle.textContent = "等待玩家加入";
    else if (!state.maskedWord) els.roundTitle.textContent = isDrawer ? "请选择一个词开始画" : "等待画手选词";
    else els.roundTitle.textContent = `题目：${state.maskedWord}`;
    els.roleText.textContent = isDrawer ? (currentWord ? `当前身份：画画，答案是 ${currentWord}` : "当前身份：画手，请先选词") : "当前身份：猜词";
    els.guess.disabled = !ws || isDrawer || !currentDrawerId || !state.maskedWord;
    els.guessBtn.disabled = els.guess.disabled;
    els.clear.disabled = !isDrawer || !currentWord;
    els.undo.disabled = !isDrawer || !currentWord;
    els.newRound.disabled = !ws;
    els.addWord.disabled = !ws;
    els.wordPick.style.display = state.needsWordPick && isDrawer ? "block" : "none";
    renderPlayers(state.players || []);
    renderCanvas();
    startTimer(state.endsAt || 0);
  }


  function renderPlayers(players) {
    if (!players.length) { els.players.innerHTML = '<div class="muted">暂无玩家</div>'; return; }
    els.players.innerHTML = players.map((player) => {
      const role = player.id === currentDrawerId ? "画手" : "猜词";
      return `<div class="list-row"><span>${escapeHtml(player.name)}</span><strong>${role}</strong></div>`;
    }).join("");
  }

  function renderWordChoices(words) {
    els.wordChoices.innerHTML = words.map((word) => `<button type="button" data-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join("");
    els.wordChoices.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => send({ type: "pickWord", word: button.dataset.word }));
    });
  }

  function sendGuess() {
    const text = els.guess.value.trim();
    if (!text) return;
    send({ type: "guess", text });
    els.guess.value = "";
  }

  function handleGuessResult(result) {
    if (result.correct) setStatus(`${result.name || "有人"} 猜对了：${result.word}`, "ok");
    else if (result.self) setStatus("不对，再试一次。", "bad");
  }

  function requestNewRound() {
    send({ type: "newRound" });
    setStatus("已切换画手，等待对方选词。", "ok");
  }

  function addCustomWord() {
    const word = els.customWord.value.trim();
    if (!word) return;
    send({ type: "setCustomWord", word });
    els.customWord.value = "";
  }

  function startDraw(event) {
    if (!canDraw()) return;
    event.preventDefault();
    isDrawing = true;
    lastPoint = getPoint(event);
    localStroke = { color: els.color.value, size: Number(els.size.value), points: [lastPoint] };
    els.canvas.setPointerCapture(event.pointerId);
  }

  function moveDraw(event) {
    if (!isDrawing || !localStroke) return;
    const point = getPoint(event);
    localStroke.points.push(point);
    drawLine(localStroke, lastPoint, point);
    lastPoint = point;
  }

  function endDraw() {
    if (!isDrawing || !localStroke) return;
    isDrawing = false;
    if (localStroke.points.length > 1) { strokes.push(localStroke); send({ type: "stroke", stroke: localStroke }); }
    localStroke = null;
    lastPoint = null;
  }

  function clearCanvas() { if (canDraw()) { strokes = []; renderCanvas(); send({ type: "clear" }); } }
  function undoStroke() { if (canDraw()) { strokes.pop(); renderCanvas(); send({ type: "undo" }); } }

  function renderCanvas() {
    resizeCanvas();
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
    for (const stroke of strokes) drawStroke(stroke);
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(240, Math.floor(rect.height * ratio));
    if (els.canvas.width !== width || els.canvas.height !== height) { els.canvas.width = width; els.canvas.height = height; }
  }

  function drawStroke(stroke) { for (let i = 1; i < stroke.points.length; i += 1) drawLine(stroke, stroke.points[i - 1], stroke.points[i]); }
  function drawLine(stroke, from, to) {
    ctx.strokeStyle = stroke.color || "#111827";
    ctx.lineWidth = stroke.size || 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x * els.canvas.width, from.y * els.canvas.height);
    ctx.lineTo(to.x * els.canvas.width, to.y * els.canvas.height);
    ctx.stroke();
  }

  function getPoint(event) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  function canDraw() { return ws && ws.readyState === WebSocket.OPEN && clientId === currentDrawerId && currentWord; }
  function send(payload) { if (!ws || ws.readyState !== WebSocket.OPEN) return setStatus("还没有连接房间。", "bad"); ws.send(JSON.stringify(payload)); }
  function setConnected(connected) { els.join.textContent = connected ? "重新加入" : "加入房间"; els.newRound.disabled = !connected; els.addWord.disabled = !connected; }
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = `status ${kind || ""}`.trim();
    showToast(text, kind);
  }

  function showToast(text, kind) {
    els.toast.textContent = text;
    els.toast.className = `toast show ${kind || ""}`.trim();
    clearTimeout(els.toast._timer);
    els.toast._timer = setTimeout(() => {
      els.toast.className = "toast";
    }, kind === "bad" ? 2200 : 1600);
  }

  function addLog(text) {
    const item = document.createElement("div");
    item.className = "list-row";
    item.innerHTML = `<span>${escapeHtml(text)}</span>`;
    if (els.log.querySelector(".muted")) els.log.innerHTML = "";
    els.log.prepend(item);
    while (els.log.children.length > 40) els.log.lastElementChild.remove();
  }

  function startTimer(endsAt) {
    clearInterval(timerHandle);
    const tick = () => {
      if (!endsAt) { els.timer.textContent = "--"; return; }
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      els.timer.textContent = `${left}s`;
    };
    tick();
    if (endsAt) timerHandle = setInterval(tick, 1000);
  }

  async function copyRoomLink() {
    const room = normalizeRoom(els.room.value) || makeRoomCode();
    localStorage.setItem("drawGuessRoom", room);
    const url = new URL(location.href);
    url.searchParams.set("room", room);
    try { await navigator.clipboard.writeText(url.toString()); setStatus("房间链接已复制。", "ok"); }
    catch (error) { setStatus(`房间号：${room}`, "ok"); }
  }

  function enterFullscreenCanvas() {
    els.canvasPanel.classList.add("fullscreenCanvas", "rotatedFullscreen");
    const fullscreenPromise = els.canvasPanel.requestFullscreen ? els.canvasPanel.requestFullscreen().catch(() => {}) : Promise.resolve();
    fullscreenPromise.then(lockLandscape).finally(() => setTimeout(renderCanvas, 160));
  }

  function exitFullscreenCanvas() {
    els.canvasPanel.classList.remove("fullscreenCanvas", "rotatedFullscreen");
    unlockOrientation();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    setTimeout(renderCanvas, 120);
  }

  async function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
    } catch (error) {}
  }

  function unlockOrientation() {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (error) {}
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    const name = els.name.value.trim();
    const room = normalizeRoom(els.room.value);
    if (!name || !room) return;
    reconnectAttempts += 1;
    const delay = Math.min(8000, 800 * reconnectAttempts);
    reconnectTimer = setTimeout(connectRoom, delay);
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 20000);
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
  }

  function defaultEndpoint() {
    if (location.hostname === "www.cjx88.eu.cc" || location.hostname === "cjx88.eu.cc") return "wss://www.cjx88.eu.cc/draw/ws";
    return "/draw/ws";
  }
  function makeRoomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
  function normalizeRoom(value) { return String(value || "").trim().replace(/[^\w-]/g, "").slice(0, 20); }
  function ensureRoomInUrl(room) { updateRoomUrl(room); }
  function updateRoomUrl(room) { const url = new URL(location.href); url.searchParams.set("room", room); history.replaceState(null, "", url.toString()); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }

  window.__DRAW_GUESS_WORDS__ = DEFAULT_WORDS;
})();








