// Cloudflare Worker + Durable Object for draw-and-guess rooms.

const MAX_PLAYERS = 2;
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/draw/ws") return new Response("draw guess worker ok", { status: 200 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const room = cleanRoom(url.searchParams.get("room") || "default");
    const id = env.DRAW_GUESS_ROOMS.idFromName(room);
    return env.DRAW_GUESS_ROOMS.get(id).fetch(request);
  }
};

export class DrawGuessRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.players = new Map();
    this.strokes = [];
    this.drawerId = "";
    this.word = "";
    this.endsAt = 0;
    this.roundTimer = null;
    this.cleanupTimer = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const name = cleanName(url.searchParams.get("name") || "玩家");
    const nameKey = makeNameKey(name);
    if (!this.players.has(nameKey) && this.players.size >= MAX_PLAYERS) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      server.send(JSON.stringify({ type: "roomFull", text: "房间已满，只允许两名玩家。" }));
      server.close(1000, "roomFull");
      return new Response(null, { status: 101, webSocket: client });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.handleSession(nameKey, server, name);
    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(id, socket, name) {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    const old = this.sessions.get(id);
    if (old) this.sendSocket(old, { type: "log", text: `${name} 已在新设备重新连接` });
    try { old?.close(1000, "replaced"); } catch (error) {}
    this.sessions.set(id, socket);
    this.players.set(id, { id, name });
    socket.send(JSON.stringify({ type: "hello", clientId: id }));
    socket.addEventListener("message", (event) => this.handleMessage(id, event.data));
    socket.addEventListener("close", () => this.removeSession(id, socket));
    socket.addEventListener("error", () => this.removeSession(id, socket));
    this.broadcastLog(`${name} 加入房间`);
    if (!this.drawerId) this.startWordPick(id);
    else this.broadcastState(!this.word);
  }

  handleMessage(id, raw) {
    let message;
    try { message = JSON.parse(raw); } catch (error) { return; }
    if (message.type === "ping") return this.send(id, { type: "pong" });
    if (message.type === "newRound") return this.startWordPick(this.pickNextDrawer(this.drawerId || id));
    if (message.type === "pickWord") this.pickWord(id, message.word);
    if (message.type === "setCustomWord") this.setCustomWord(id, message.word);
    if (message.type === "stroke" && id === this.drawerId) this.addStroke(message.stroke);
    if (message.type === "clear" && id === this.drawerId) this.clearCanvas();
    if (message.type === "undo" && id === this.drawerId) this.undoStroke();
    if (message.type === "guess") this.handleGuess(id, message.text);
  }

  startWordPick(drawerId) {
    if (!drawerId || !this.players.has(drawerId)) drawerId = this.players.keys().next().value || "";
    if (!drawerId) return this.scheduleRoomCleanup();
    this.drawerId = drawerId;
    this.word = "";
    this.strokes = [];
    this.endsAt = 0;
    clearTimeout(this.roundTimer);
    this.broadcast({ type: "clear" });
    const socket = this.sessions.get(drawerId);
    if (socket) socket.send(JSON.stringify({ type: "wordChoices", words: this.randomWords(3) }));
    const drawer = this.players.get(drawerId);
    if (drawer) this.broadcastLog(`轮到 ${drawer.name} 画画`);
    this.broadcastState(true);
  }

  pickWord(id, word) {
    if (id !== this.drawerId) return;
    const clean = cleanWord(word);
    if (!clean) return;
    this.startWord(clean);
  }

  setCustomWord(id, word) {
    if (id !== this.drawerId) return;
    const clean = cleanWord(word);
    if (!clean) return;
    this.startWord(clean);
    const player = this.players.get(id);
    this.broadcastLog(`${player?.name || "玩家"} 直接画自定义词：${clean}`);
  }

  startWord(clean) {
    this.word = clean;
    this.endsAt = Date.now() + 90 * 1000;
    clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => {
      if (this.word) {
        this.broadcastLog(`时间到，答案是 ${this.word}`);
        this.startWordPick(this.pickNextDrawer(this.drawerId));
      }
    }, 90 * 1000);
    this.broadcastState(false);
  }

  addStroke(stroke) {
    if (!stroke || !Array.isArray(stroke.points)) return;
    this.strokes.push({
      color: String(stroke.color || "#111827").slice(0, 20),
      size: Math.max(2, Math.min(22, Number(stroke.size) || 7)),
      points: stroke.points.slice(0, 500).map((point) => ({
        x: Math.max(0, Math.min(1, Number(point.x) || 0)),
        y: Math.max(0, Math.min(1, Number(point.y) || 0))
      }))
    });
    this.broadcast({ type: "stroke", stroke: this.strokes[this.strokes.length - 1] }, this.drawerId);
  }

  clearCanvas() { this.strokes = []; this.broadcast({ type: "clear" }, this.drawerId); this.broadcastState(false); }
  undoStroke() { this.strokes.pop(); this.broadcast({ type: "undo" }, this.drawerId); this.broadcastState(false); }

  handleGuess(id, text) {
    if (!this.word || id === this.drawerId) return;
    const player = this.players.get(id);
    const correct = Boolean(normalizeGuess(text) && normalizeGuess(text) === normalizeGuess(this.word));
    this.send(id, { type: "guessResult", correct, self: true, word: this.word, name: player?.name });
    if (!correct) return;
    this.broadcast({ type: "guessResult", correct: true, word: this.word, name: player?.name || "玩家" });
    this.broadcastLog(`${player?.name || "玩家"} 猜对了：${this.word}`);
    this.startWordPick(this.pickNextDrawer(this.drawerId));
  }

  removeSession(id, socket) {
    if (this.sessions.get(id) !== socket) return;
    const player = this.players.get(id);
    this.sessions.delete(id);
    this.players.delete(id);
    if (player) this.broadcastLog(`${player.name} 离开房间`);
    if (!this.players.size) return this.scheduleRoomCleanup();
    if (id === this.drawerId) this.startWordPick(this.players.keys().next().value || "");
    else this.broadcastState(!this.word);
  }

  scheduleRoomCleanup() {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => {
      if (!this.sessions.size && !this.players.size) this.resetRoom();
    }, EMPTY_ROOM_TTL_MS);
  }

  resetRoom() {
    clearTimeout(this.roundTimer);
    clearTimeout(this.cleanupTimer);
    this.players.clear();
    this.sessions.clear();
    this.strokes = [];
    this.drawerId = "";
    this.word = "";
    this.endsAt = 0;
  }

  pickNextDrawer(currentId) {
    const ids = [...this.players.keys()];
    if (!ids.length) return "";
    const index = ids.indexOf(currentId);
    return ids[(index + 1 + ids.length) % ids.length];
  }

  randomWords(count) {
    const pool = [...DEFAULT_WORDS];
    const picked = [];
    while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return picked;
  }

  broadcastState(needsWordPick = false) {
    const players = [...this.players.values()];
    for (const [id, socket] of this.sessions) {
      this.sendSocket(socket, {
        type: "state",
        players,
        drawerId: this.drawerId,
        word: id === this.drawerId ? this.word : "",
        maskedWord: this.word ? maskWord(this.word, id === this.drawerId) : "",
        strokes: this.strokes,
        endsAt: this.endsAt,
        needsWordPick
      });
    }
  }

  broadcastLog(text) { this.broadcast({ type: "log", text }); }
  broadcast(payload, exceptId = "") { for (const [id, socket] of this.sessions) if (id !== exceptId) this.sendSocket(socket, payload); }
  send(id, payload) { const socket = this.sessions.get(id); if (socket) this.sendSocket(socket, payload); }
  sendSocket(socket, payload) { try { socket.send(JSON.stringify(payload)); } catch (error) {} }
}

function cleanRoom(value) { return String(value).trim().replace(/[^\w-]/g, "").slice(0, 40) || "default"; }
function cleanName(value) { return String(value).trim().slice(0, 16) || "玩家"; }
function makeNameKey(value) { return cleanName(value).toLowerCase(); }
function cleanWord(value) { return String(value).trim().replace(/\s+/g, "").slice(0, 12); }
function normalizeGuess(value) { return cleanWord(value).toLowerCase(); }
function maskWord(word, reveal) { return reveal ? word : `${"□".repeat([...word].length)}（${[...word].length}字）`; }
