/**
 * online.js
 * 轻量 WebSocket 联机客户端（兼容旧用法 + 支持 token 断线重连）
 *
 * ✅ 兼容旧五子棋/转发用法：
 *   new OnlineClient({ wsBase, wsPath, onInit, onMove, onPresence, onMessage, onStatus })
 *
 * ✅ 支持：
 * - 自动确保 URL 里有 ?room=xxxx
 * - 支持固定 query（例如 {game:"xq"}）
 * - 支持动态 query（例如 want=red/black/spectate）
 * - token 本地持久化（用于断线重连/续座）
 * - wsBase 支持数组：自动轮询多线路（适合“国内/海外”双线路兜底）
 */
(function () {
  class OnlineClient {
    constructor(opts) {
      opts = opts || {};

      const defaultBase = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
      const base = opts.wsBase || defaultBase;

      // wsBase 支持字符串或数组：['wss://a.com','wss://b.com']
      this.wsBases = Array.isArray(base) ? base.filter(Boolean) : [base];
      if (!this.wsBases.length) this.wsBases = [defaultBase];
      this._wsBaseIndex = 0;

      this.wsPath = opts.wsPath || "/relay";

      // 固定 query（例如 {game:"xq"}）
      this.baseQuery = opts.query || {};

      // 可变 query（例如 want）
      this.extraQuery = {};

      // 显式 roomId（可选）
      this.roomId = opts.roomId || null;

      // token 存储 key 前缀（每个 room 单独存）
      this.tokenKeyPrefix = opts.tokenKeyPrefix || "";

      // 连接超时（移动网络下经常会“卡住不触发 onclose”）
      this.connectTimeoutMs = Number.isFinite(opts.connectTimeoutMs) ? opts.connectTimeoutMs : 8000;
      this._connectTimeoutTimer = null;

      // 兼容旧回调
      this.onInit = opts.onInit || (() => {});
      this.onMove = opts.onMove || (() => {});

      // 通用回调
      this.onMessage = opts.onMessage || (() => {});
      this.onStatus = opts.onStatus || (() => {});
      this.onPresence = opts.onPresence || (() => {});
      this.onRole = opts.onRole || (() => {});

      this.ws = null;

      this.role = 0;
      this.token = "";

      this.autoReconnect = true;
      this._closedByUser = false;
      this._reconnectTimer = null;
    }

    // ===== public =====
    setExtraQuery(q) {
      this.extraQuery = { ...(q || {}) };
    }

    clearExtraQuery() {
      this.extraQuery = {};
    }

    clearToken() {
      this.token = "";
      const k = this._tokenKey();
      if (k) localStorage.removeItem(k);
    }

    connect() {
      this._closedByUser = false;
      this._clearReconnectTimer();
      this._clearConnectTimeout();
      // ✅ 如果已经有连接（open/connecting），先关掉避免“重复连接=房间人数变多/按钮失效”
      if (this.ws) {
        try { this.ws.onopen = this.ws.onclose = this.ws.onmessage = this.ws.onerror = null; } catch {}
        try { this.ws.close(); } catch {}
        this.ws = null;
      }


      const roomId = this._ensureRoom();
      this.token = this._loadToken();

      const wsUrl = this._buildWsUrl(roomId);
      this._emitStatus("connecting", { wsUrl });

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        this._emitStatus("error", { error: e });
        this._rotateWsBase();
        this._scheduleReconnect();
        return;
      }

      // 连接超时兜底（尤其移动端）
      this._connectTimeoutTimer = setTimeout(() => {
        if (!this.ws) return;
        if (this.ws.readyState !== WebSocket.OPEN) {
          try { this.ws.close(); } catch {}
          this._emitStatus("timeout");
        }
      }, this.connectTimeoutMs);

      this.ws.onopen = () => {
        this._clearConnectTimeout();
        this._emitStatus("connected");
      };

      this.ws.onclose = () => {
        this._clearConnectTimeout();
        this._emitStatus("disconnected");
        if (!this._closedByUser && this.autoReconnect) {
          // 多线路：下一次重连换一个 wsBase
          this._rotateWsBase();
          this._scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose 统一重连
      };

      this.ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        // 角色/token
        if (msg.type === "init" || msg.type === "role") {
          if (typeof msg.you === "number") {
            this.role = msg.you;
            this.onRole(this.role);
          }
          if (msg.token) {
            this.token = String(msg.token);
            this._saveToken(this.token);
          }
        }

        // presence
        if (msg.type === "presence" && typeof msg.n === "number") {
          this.onPresence(msg.n);
        }

        // 兼容旧回调
        if (msg.type === "init") this.onInit(msg);
        if (msg.type === "move" || msg.type === "xq_move") this.onMove(msg);

        // 通用回调
        this.onMessage(msg);
      };
    }

    close() {
      this._closedByUser = true;
      this._clearReconnectTimer();
      this._clearConnectTimeout();
      if (this.ws) {
        try { this.ws.close(); } catch {}
      }
      this.ws = null;
      this._emitStatus("closed");
    }

    send(obj) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
      try {
        this.ws.send(JSON.stringify(obj));
        return true;
      } catch {
        return false;
      }
    }

    getShareUrl() {
      const roomId = this._ensureRoom();
      const u = new URL(location.href);
      u.searchParams.set("room", roomId);
      return u.toString();
    }

    async copyLink() {
      const url = this.getShareUrl();
      await navigator.clipboard.writeText(url);
      return url;
    }

    // ===== internal =====
    _emitStatus(status, extra) {
      const payload = { status, ...(extra || {}) };
      // 1) 新版：对象
      try { this.onStatus(payload); } catch {}
      // 2) 旧版：字符串（避免旧页面 if (s==='connecting') 失效）
      try { this.onStatus(status); } catch {}
    }

    _currentWsBase() {
      return this.wsBases[this._wsBaseIndex] || this.wsBases[0];
    }

    _rotateWsBase() {
      if (this.wsBases.length <= 1) return;
      this._wsBaseIndex = (this._wsBaseIndex + 1) % this.wsBases.length;
    }

    _buildWsUrl(roomId) {
      const u = new URL(this._currentWsBase() + this.wsPath);

      // 1) room
      u.searchParams.set("room", roomId);

      // 2) token（用于断线重连）
      if (this.token) u.searchParams.set("token", this.token);

      // 3) query
      const q = { ...this.baseQuery, ...this.extraQuery };
      for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === "") continue;
        u.searchParams.set(k, String(v));
      }

      return u.toString();
    }

    _ensureRoom() {
      // 如果显式指定 roomId，就用它（但仍写进 URL，保证可分享）
      if (this.roomId) {
        const u = new URL(location.href);
        u.searchParams.set("room", this.roomId);
        history.replaceState(null, "", u.toString());
        return this.roomId;
      }

      // 否则从 URL 获取/创建
      const u = new URL(location.href);
      let room = u.searchParams.get("room");
      if (!room) {
        room = Math.random().toString(36).slice(2, 10);
        u.searchParams.set("room", room);
        history.replaceState(null, "", u.toString());
      }
      return room;
    }

    _tokenKey() {
      if (!this.tokenKeyPrefix) return "";
      const roomId = this.roomId || new URL(location.href).searchParams.get("room") || "";
      if (!roomId) return "";
      return `${this.tokenKeyPrefix}:${roomId}`;
    }

    _loadToken() {
      const k = this._tokenKey();
      if (!k) return "";
      return localStorage.getItem(k) || "";
    }

    _saveToken(token) {
      const k = this._tokenKey();
      if (!k) return;
      try { localStorage.setItem(k, token); } catch {}
    }

    _scheduleReconnect() {
      this._clearReconnectTimer();
      this._reconnectTimer = setTimeout(() => {
        if (!this._closedByUser) this.connect();
      }, 1200);
    }

    _clearReconnectTimer() {
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
    }

    _clearConnectTimeout() {
      if (this._connectTimeoutTimer) {
        clearTimeout(this._connectTimeoutTimer);
        this._connectTimeoutTimer = null;
      }
    }
  }

  window.OnlineClient = OnlineClient;
})();
