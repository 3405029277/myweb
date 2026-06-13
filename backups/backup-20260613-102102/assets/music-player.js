(function () {
  "use strict";

  if (window.__SITE_MUSIC_READY__ || document.getElementById("siteMusicPlayer")) return;
  window.__SITE_MUSIC_READY__ = true;

  if (!window.APlayer || !window.customElements) return;

  var cfg = window.SITE_MUSIC_CONFIG || {};
  var shell = document.createElement("div");
  shell.id = "siteMusicPlayer";
  shell.className = "site-music-player";
  document.body.appendChild(shell);

  var initialVolume = Number(localStorage.getItem("siteMusicVolume") || 0.45);
  var lyricsEnabled = cfg.lyrics !== false;
  var karpovCacheKey = "siteMusicKarpovPlaylistFullLazyV1";

  if (cfg.source === "karpov" && cfg.endpoint) {
    initKarpov().catch(initFallback);
  } else {
    initFallback();
  }

  function initKarpov() {
    var url = new URL(cfg.endpoint, window.location.origin);
    url.searchParams.set("provider", cfg.provider || "netease");
    url.searchParams.set("playlistId", cfg.playlistId || cfg.id || "");
    url.searchParams.set("limit", String(cfg.limit || 0));
    url.searchParams.set("quality", cfg.quality || "MP3_320");
    url.searchParams.set("lyrics", "0");

    console.log("[Music] Karpov URL:", url.toString());
    return fetchKarpovPlaylist(url.toString(), 0)
      .catch(function (err) {
        console.warn("[Music] Karpov fetch failed:", err);
        var cached = getCachedKarpovPlaylist();
        if (cached) return cached;
        throw new Error("No playable music");
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.audio) || !data.audio.length) throw new Error("No playable music");
        data.audio = data.audio.map(stripLyrics).filter(Boolean);
        if (!data.audio.length) throw new Error("No playable music");
        setCachedKarpovPlaylist(data);
        var player = new APlayer({
          container: createAPlayerContainer(),
          fixed: true, mini: true, autoplay: false,
          loop: "all", order: "list", preload: "none",
          volume: initialVolume, mutex: true,
          lrcType: lyricsEnabled ? 3 : 0,
          audio: data.audio
        });
        bindEvents(player);
      });
  }

  function stripLyrics(track) {
    if (!track || typeof track !== "object") return null;
    var id = track.id || track.songId || track.song_id;
    var url = id ? buildAudioUrl(id) : track.url;
    if (typeof url !== "string" || !url) return null;
    return {
      id: id ? String(id) : "",
      name: typeof track.name === "string" ? track.name : "Unknown",
      artist: typeof track.artist === "string" ? track.artist : "Unknown",
      url: url,
      cover: typeof track.cover === "string" ? track.cover : "assets/avatar.jpg",
      lrc: lyricsEnabled && id ? buildLyricUrl(id) : ""
    };
  }

  function buildAudioUrl(id) {
    var endpoint = cfg.audioEndpoint || replaceEndpointPath("/audio");
    var url = new URL(endpoint, window.location.origin);
    url.searchParams.set("provider", cfg.provider || "netease");
    url.searchParams.set("id", String(id));
    url.searchParams.set("quality", cfg.quality || "MP3_320");
    return url.toString();
  }

  function buildLyricUrl(id) {
    var endpoint = cfg.lyricEndpoint || replaceEndpointPath("/lyric");
    var url = new URL(endpoint, window.location.origin);
    url.searchParams.set("provider", cfg.provider || "netease");
    url.searchParams.set("id", String(id));
    return url.toString();
  }

  function replaceEndpointPath(nextPath) {
    return (cfg.endpoint || "/api/music/playlist").replace(/\/playlist(?:\?.*)?$/, nextPath);
  }

  function normalizeLrc(value) {
    if (typeof value !== "string") return "";
    var lines = value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (lines.length && lines.every(function (line) { return /^\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(line); })) return value;
    return convertKarpovJsonLyric(value);
  }

  function convertKarpovJsonLyric(text) {
    return text.split(/\r?\n/).map(function (line) {
      var trimmed = line.trim();
      if (/^\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(trimmed)) return trimmed;
      try {
        var item = JSON.parse(trimmed);
        if (!Number.isFinite(item && item.t) || !Array.isArray(item.c)) return "";
        var content = item.c.map(function (part) { return part && (part.tx || part.text) || ""; }).join("").trim();
        return content ? formatLrcTime(item.t) + content : "";
      } catch (error) {
        return "";
      }
    }).filter(Boolean).join("\n");
  }

  function formatLrcTime(ms) {
    var total = Math.max(0, Number(ms) / 1000);
    var minutes = Math.floor(total / 60);
    var seconds = Math.floor(total % 60);
    var hundredths = Math.floor((total - Math.floor(total)) * 100);
    return "[" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(hundredths).padStart(2, "0") + "]";
  }

  function fetchKarpovPlaylist(url, attempt) {
    return fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("Music request failed");
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.audio) || !data.audio.length) throw new Error("No playable music");
        return data;
      })
      .catch(function (error) {
        if (attempt >= 2) throw error;
        return delay(900).then(function () { return fetchKarpovPlaylist(url, attempt + 1); });
      });
  }

  function getCachedKarpovPlaylist() {
    try {
      var cached = JSON.parse(localStorage.getItem(karpovCacheKey) || "null");
      if (!cached || cached.expiresAt <= Date.now() || !cached.data) return null;
      return cached.data;
    } catch (error) {
      return null;
    }
  }

  function setCachedKarpovPlaylist(data) {
    try {
      localStorage.setItem(karpovCacheKey, JSON.stringify({ data: data, expiresAt: Date.now() + 6 * 60 * 60 * 1000 }));
    } catch (error) {}
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function initFallback() {
    console.log("[Music] Fallback triggered. cfg:", cfg);
    var metingCfg = getMetingConfig();
    console.log("[Music] metingCfg:", metingCfg, "customElements.get('meting-js'):", window.customElements.get("meting-js"));
    if (metingCfg && window.customElements.get("meting-js")) initMeting(metingCfg);
    else initLocal();
  }

  function getMetingConfig() {
    if (cfg.fallback && cfg.fallback.source === "meting" && cfg.fallback.id) return cfg.fallback;
    if (cfg.id) return cfg;
    return null;
  }

  function initMeting(metingCfg) {
    console.log("[Music] initMeting with config:", metingCfg);
    var meting = document.createElement("meting-js");
    meting.setAttribute("server", metingCfg.server || "netease");
    meting.setAttribute("type", metingCfg.type || "playlist");
    meting.setAttribute("id", String(metingCfg.id));
    if (metingCfg.api) meting.setAttribute("api", metingCfg.api);
    meting.setAttribute("fixed", "true");
    meting.setAttribute("mini", "true");
    meting.setAttribute("autoplay", "false");
    meting.setAttribute("loop", "all");
    meting.setAttribute("order", "list");
    meting.setAttribute("preload", "none");
    meting.setAttribute("volume", String(initialVolume));
    meting.setAttribute("mutex", "true");
    shell.appendChild(meting);
    var tries = 0;
    var t = setInterval(function () {
      if (meting.aplayer) {
        clearInterval(t);
        console.log("[Music] MetingJS initialized successfully");
        bindEvents(meting.aplayer);
      }
      else if (++tries > 40) {
        clearInterval(t);
        console.warn("[Music] MetingJS timeout after", tries, "tries. Falling back to local.");
        initLocal();
      }
    }, 200);
  }

  function initLocal() {
    console.log("[Music] initLocal() called - creating local APlayer fallback");
    try {
      var player = new APlayer({
        container: createAPlayerContainer(),
        fixed: true, mini: true, autoplay: false,
        loop: "all", order: "list", preload: "none",
        volume: initialVolume, mutex: true,
        audio: [{ name: "BGM", artist: "Local",
                  url: "assets/music/background.wav",
                  cover: "assets/avatar.jpg" }]
      });
      console.log("[Music] Local APlayer created successfully");
      bindEvents(player);
    } catch (err) {
      console.error("[Music] initLocal() failed:", err);
    }
  }

  function createAPlayerContainer() {
    var container = document.createElement("div");
    shell.appendChild(container);
    return container;
  }

  function bindEvents(ap) {
    ensureMiniMode();
    setupDragHandle();
    ap.on("play", function () { localStorage.setItem("siteMusicWanted", "1"); });
    ap.on("pause", function () { localStorage.setItem("siteMusicWanted", "0"); });
    ap.on("volumechange", function () {
      localStorage.setItem("siteMusicVolume", String(ap.audio.volume));
    });
  }

  function ensureMiniMode() {
    var root = shell.querySelector(".aplayer.aplayer-fixed");
    if (root) root.classList.add("aplayer-narrow");
  }

  function setupDragHandle() {
    var root = shell.querySelector(".aplayer.aplayer-fixed");
    if (!root || root.querySelector(".site-music-drag-handle")) return;

    var handle = document.createElement("button");
    handle.className = "site-music-drag-handle";
    handle.type = "button";
    handle.setAttribute("aria-label", "拖动音乐播放器");
    handle.textContent = "拖动";
    root.appendChild(handle);

    syncPositionForViewport(root);
    window.addEventListener("resize", function () { syncPositionForViewport(root); });

    handle.addEventListener("pointerdown", function (event) {
      if (isMobile()) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      var rect = root.getBoundingClientRect();
      var startX = event.clientX;
      var startY = event.clientY;
      var startLeft = rect.left;
      var startTop = rect.top;

      function move(moveEvent) {
        var nextLeft = clamp(startLeft + moveEvent.clientX - startX, 8, window.innerWidth - rect.width - 8);
        var nextTop = clamp(startTop + moveEvent.clientY - startY, 42, window.innerHeight - rect.height - 8);
        setPosition(root, nextLeft, nextTop);
      }

      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        var next = root.getBoundingClientRect();
        localStorage.setItem("siteMusicPosition", JSON.stringify({ left: Math.round(next.left), top: Math.round(next.top) }));
      }

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  }

  function syncPositionForViewport(root) {
    if (isMobile()) {
      resetPosition(root);
      return;
    }
    applyStoredPosition(root);
  }

  function applyStoredPosition(root) {
    try {
      var pos = JSON.parse(localStorage.getItem("siteMusicPosition") || "null");
      if (!pos || typeof pos.left !== "number" || typeof pos.top !== "number") return;
      var rect = root.getBoundingClientRect();
      setPosition(root, clamp(pos.left, 8, window.innerWidth - rect.width - 8), clamp(pos.top, 42, window.innerHeight - rect.height - 8));
    } catch (error) {}
  }

  function setPosition(root, left, top) {
    root.style.left = left + "px";
    root.style.top = top + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
  }

  function resetPosition(root) {
    root.style.left = "";
    root.style.top = "";
    root.style.right = "";
    root.style.bottom = "";
  }

  function isMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }
})();
