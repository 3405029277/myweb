# Cloudflare Worker patch

把你现有 worker 里的这几处逻辑改掉即可：

## 1. 房间回收改成 10 分钟

把下面常量从 2 小时改成 10 分钟：

```js
const GM_ROOM_TTL_MS = 10 * 60 * 1000;
const XQ_ROOM_TTL_MS = 10 * 60 * 1000;
```

保持 alarm 逻辑不变，但销毁房间前继续保留这个判断：

```js
const sockets = this.state.getWebSockets();
if (sockets && sockets.length > 0) {
  await this.state.storage.setAlarm(now + GM_ROOM_TTL_MS);
  return;
}
```

## 2. 五子棋“重开”允许对局中申请

把 `msg.type === "rematch"` 这一段里的 `if (!room.gameOver) return;` 删掉。

保留双人投票后重置棋盘的逻辑：

```js
if (msg.type === "rematch") {
  if (!isPlayer) return;
  room.rematch[role] = true;
  await this.state.storage.put("gm_room", room);
  await this._bumpAlarmGM(room);
  this._broadcast({ type: "rematch_pending" });
  this._broadcast({ type: "votes", votes: { rematch: room.rematch, swap: room.swap } });

  if (room.rematch[GOMOKU_BLACK] && room.rematch[GOMOKU_WHITE] && room.blackToken && room.whiteToken) {
    room.moves = [];
    room.current = GOMOKU_BLACK;
    room.gameOver = false;
    room.winner = 0;
    room.reason = "";
    room.rematch = { [GOMOKU_BLACK]: false, [GOMOKU_WHITE]: false };
    room.swap = { [GOMOKU_BLACK]: false, [GOMOKU_WHITE]: false };
    await this.state.storage.put("gm_room", room);
    await this._bumpAlarmGM(room);
    this._broadcast({ type: "state", moves: [], current: room.current, gameOver: false });
    this._broadcast({ type: "votes", votes: { rematch: room.rematch, swap: room.swap } });
  }
}
```

## 3. 换边只保留开局前

保持这个限制即可：

```js
if (msg.type === "swap") {
  if (!isPlayer) return;
  if (!room.gameOver && room.moves.length > 0) return;
}
```

## 4. 象棋同样支持对局中申请重开

把 `xq_rematch` 的 `if (!room.gameOver) return;` 去掉，保留双方投票后清盘：

```js
if (msg.type === "xq_rematch") {
  if (!isPlayer) return;
  room.rematch[role] = true;
  await this.state.storage.put("xq_room", room);
  await this._bumpAlarmXQ(room);
  this._broadcast({ type: "xq_votes", votes: { rematch: room.rematch, swap: room.swap } });

  if (room.rematch[XQ_RED] && room.rematch[XQ_BLACK] && room.redToken && room.blackToken) {
    room.moves = [];
    room.current = XQ_RED;
    room.gameOver = false;
    room.winner = 0;
    room.reason = "";
    room.rematch = { [XQ_RED]: false, [XQ_BLACK]: false };
    room.swap = { [XQ_RED]: false, [XQ_BLACK]: false };
    await this.state.storage.put("xq_room", room);
    await this._bumpAlarmXQ(room);
    this._broadcast({ type: "xq_reset", reason: "rematch", current: room.current, moves: [] });
    this._broadcast({ type: "xq_votes", votes: { rematch: room.rematch, swap: room.swap } });
  }
}
```
