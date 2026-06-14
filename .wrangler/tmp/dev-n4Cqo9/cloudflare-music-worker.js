var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// cloudflare-music-worker.js
var NETEASE_API_BASE = "https://music.163.com";
var DEFAULT_PROVIDER = "netease";
var DEFAULT_PLAYLIST_ID = "2668671168";
var DEFAULT_QUALITY = "320000";
var monthSeconds = 30 * 24 * 60 * 60;
var monthMs = monthSeconds * 1e3;
var songUrlSeconds = 6 * 60 * 60;
var songUrlBrowserSeconds = 10 * 60;
var r2AudioLimitBytes = 900 * 1024 * 1024;
var audioCacheSeconds = monthSeconds;
var cache = /* @__PURE__ */ new Map();
var NETEASE_PRESET_KEY = "0CoJUm6Qyw8W8jud";
var NETEASE_IV = "0102030405060708";
var NETEASE_PUBLIC_KEY = "010001";
var NETEASE_MODULUS = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
var cloudflare_music_worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return corsResponse(null, 204);
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    if (url.pathname !== "/api/music/playlist" && url.pathname !== "/music/playlist" && url.pathname !== "/api/music/url" && url.pathname !== "/music/url" && url.pathname !== "/api/music/audio" && url.pathname !== "/music/audio" && url.pathname !== "/api/music/lyric" && url.pathname !== "/music/lyric") {
      return json({ error: "Not found." }, 404);
    }
    const provider = getSafeToken(url.searchParams.get("provider"), env.MUSIC_PROVIDER || DEFAULT_PROVIDER);
    if (url.pathname === "/api/music/audio" || url.pathname === "/music/audio") {
      const id = getSafeToken(url.searchParams.get("id"), "");
      const quality = getSafeToken(url.searchParams.get("quality"), env.MUSIC_QUALITY || DEFAULT_QUALITY) || DEFAULT_QUALITY;
      if (!provider || !id) return corsResponse("", 400, { "Content-Type": "text/plain; charset=utf-8" });
      try {
        return await getCachedAudioResponse(request, env, ctx, provider, id, quality);
      } catch (error) {
        return corsResponse("", error.statusCode || 502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      }
    }
    if (url.pathname === "/api/music/url" || url.pathname === "/music/url") {
      const id = getSafeToken(url.searchParams.get("id"), "");
      const quality = getSafeToken(url.searchParams.get("quality"), env.MUSIC_QUALITY || DEFAULT_QUALITY) || DEFAULT_QUALITY;
      if (!provider || !id) return corsResponse("", 400, { "Content-Type": "text/plain; charset=utf-8" });
      try {
        const urlInfo = await getSongUrl(env, provider, id, quality);
        if (!urlInfo.available || !urlInfo.url) {
          return corsResponse("", 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        }
        const browserTtlSeconds = Math.min(songUrlBrowserSeconds, getSongUrlTtlSeconds(urlInfo));
        return corsResponse("", 302, { Location: urlInfo.url, "Cache-Control": `private, max-age=${browserTtlSeconds}` });
      } catch (error) {
        return corsResponse("", error.statusCode || 502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      }
    }
    if (url.pathname === "/api/music/lyric" || url.pathname === "/music/lyric") {
      const id = getSafeToken(url.searchParams.get("id"), "");
      if (!provider || !id) return corsResponse("", 400, { "Content-Type": "text/plain; charset=utf-8" });
      try {
        return await cachedResponse(request, monthSeconds, async () => {
          const lyric = await getSongLyric(env, provider, id);
          return corsResponse(lyric, 200, { "Content-Type": "text/plain; charset=utf-8" });
        });
      } catch (error) {
        return corsResponse("", error.statusCode || 502, { "Content-Type": "text/plain; charset=utf-8" });
      }
    }
    const playlistId = getSafeToken(url.searchParams.get("playlistId"), env.MUSIC_PLAYLIST_ID || DEFAULT_PLAYLIST_ID);
    const limit = getLimit(url.searchParams.get("limit"));
    if (!provider || !playlistId) return json({ error: "Missing music provider or playlist id." }, 400);
    try {
      return await cachedResponse(request, 3600, async () => {
        const playlist = await buildNeteasePlaylist(env, { provider, playlistId, limit });
        return json(playlist);
      });
    } catch (error) {
      const status = error.statusCode || 502;
      return json({
        error: status === 503 ? "Music service is not configured." : "Music provider request failed.",
        details: error.details || void 0
      }, status);
    }
  }
};
function corsResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      ...extraHeaders
    }
  });
}
__name(corsResponse, "corsResponse");
function json(value, status = 200) {
  return corsResponse(JSON.stringify(value), status, {
    "Content-Type": "application/json; charset=utf-8"
  });
}
__name(json, "json");
async function cachedResponse(request, ttlSeconds, factory) {
  const cache2 = caches.default;
  const cacheKey2 = new URL(request.url);
  cacheKey2.searchParams.set("_cacheVer", "v4-trackids");
  const cacheRequest = new Request(cacheKey2.toString(), request);
  const cached = await cache2.match(cacheRequest);
  if (cached) return cached;
  const response = await factory();
  const ttl = typeof ttlSeconds === "function" ? ttlSeconds() : ttlSeconds;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}`);
  const cacheable = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
  if (response.status >= 200 && response.status < 400) await cache2.put(cacheRequest, cacheable.clone());
  return cacheable;
}
__name(cachedResponse, "cachedResponse");
function getCached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}
__name(getCached, "getCached");
function setCached(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
__name(setCached, "setCached");
function cacheKey(parts) {
  return parts.map((part) => String(part == null ? "" : part)).join("|");
}
__name(cacheKey, "cacheKey");
function getSafeToken(value, fallback) {
  const token = String(value || fallback || "").trim();
  return /^[a-z0-9_-]+$/i.test(token) ? token : "";
}
__name(getSafeToken, "getSafeToken");
function getLimit(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.min(500, Math.floor(n)));
}
__name(getLimit, "getLimit");
function getSongUrlTtlSeconds(urlInfo) {
  if (!urlInfo.available || !urlInfo.url) return 3600;
  if (urlInfo.expiresInSeconds > 120) return Math.min(songUrlSeconds, urlInfo.expiresInSeconds - 60);
  return songUrlSeconds;
}
__name(getSongUrlTtlSeconds, "getSongUrlTtlSeconds");
async function fetchNetease(env, endpoint, params = {}) {
  const cookie = env.NETEASE_COOKIE || "";
  const csrfToken = extractCsrfToken(cookie);
  const url = new URL(endpoint, NETEASE_API_BASE);
  const headers = {
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://music.163.com"
  };
  if (cookie) headers.Cookie = cookie;
  const encryptedParams = await weapiEncrypt(params, csrfToken);
  const body = new URLSearchParams(encryptedParams).toString();
  const response = await fetch(url.toString(), {
    method: "POST",
    headers,
    body
  });
  if (!response.ok) {
    const error = new Error("Netease API request failed.");
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  if (data.code !== 200) {
    const error = new Error("Netease API returned error code.");
    error.statusCode = 502;
    error.details = data.message || `Code ${data.code}`;
    throw error;
  }
  return data;
}
__name(fetchNetease, "fetchNetease");
function extractCsrfToken(cookie) {
  const match = cookie.match(/__csrf=([^;]+)/);
  return match ? match[1] : "";
}
__name(extractCsrfToken, "extractCsrfToken");
async function weapiEncrypt(params, csrfToken) {
  const text = JSON.stringify({ ...params, csrf_token: csrfToken });
  const secretKey = randomString(16);
  const encText = await aesEncrypt(text, NETEASE_PRESET_KEY, NETEASE_IV);
  const params_encrypted = await aesEncrypt(encText, secretKey, NETEASE_IV);
  const encSecKey = rsaEncrypt(secretKey, NETEASE_PUBLIC_KEY, NETEASE_MODULUS);
  return {
    params: params_encrypted,
    encSecKey
  };
}
__name(weapiEncrypt, "weapiEncrypt");
async function aesEncrypt(text, key, iv) {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const ivBytes = encoder.encode(iv);
  const textBytes = encoder.encode(text);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ivBytes },
    cryptoKey,
    textBytes
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
__name(aesEncrypt, "aesEncrypt");
function rsaEncrypt(text, pubKey, modulus) {
  const reversedText = text.split("").reverse().join("");
  const hexText = Array.from(reversedText).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const bi = BigInt("0x" + hexText);
  const biExp = BigInt("0x" + pubKey);
  const biMod = BigInt("0x" + modulus);
  const biRet = modPow(bi, biExp, biMod);
  return biRet.toString(16).padStart(256, "0");
}
__name(rsaEncrypt, "rsaEncrypt");
function modPow(base, exponent, modulus) {
  if (modulus === 1n) return 0n;
  let result = 1n;
  base = base % modulus;
  while (exponent > 0n) {
    if (exponent % 2n === 1n) result = result * base % modulus;
    exponent = exponent >> 1n;
    base = base * base % modulus;
  }
  return result;
}
__name(modPow, "modPow");
function randomString(length) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
__name(randomString, "randomString");
function normalizeArtists(song) {
  const artists = song?.ar || song?.artists;
  if (Array.isArray(artists)) return artists.map((item) => item?.name || item?.title || item).filter(Boolean).join(" / ") || "Unknown";
  if (artists && typeof artists === "object") return artists.name || artists.title || "Unknown";
  if (typeof artists === "string" && artists.trim()) return artists.trim();
  return "Unknown";
}
__name(normalizeArtists, "normalizeArtists");
function toHttpsUrl(value) {
  return typeof value === "string" ? value.replace(/^http:\/\//i, "https://") : value;
}
__name(toHttpsUrl, "toHttpsUrl");
function normalizeSong(song, playlistCover) {
  const id = song?.id;
  const album = song?.al || song?.album;
  return {
    id: id == null ? "" : String(id),
    name: song?.name || song?.title || "Unknown",
    artist: normalizeArtists(song),
    cover: toHttpsUrl(album?.picUrl || song?.picUrl || playlistCover || "assets/avatar.jpg")
  };
}
__name(normalizeSong, "normalizeSong");
function normalizeSongUrl(body) {
  const data = body.data || [];
  if (!Array.isArray(data) || data.length === 0) {
    return { available: false, url: "", expiresInSeconds: 0 };
  }
  const song = data[0];
  return {
    available: song.code === 200 && !!song.url,
    url: toHttpsUrl(song.url || ""),
    expiresInSeconds: Math.floor((song.expiresIn || 0) / 1e3)
  };
}
__name(normalizeSongUrl, "normalizeSongUrl");
function normalizeLyric(body) {
  const lrc = body.lrc?.lyric || "";
  const tlyric = body.tlyric?.lyric || "";
  return normalizeLyricText(lrc + (tlyric ? "\n" + tlyric : ""));
}
__name(normalizeLyric, "normalizeLyric");
function normalizeLyricText(text) {
  if (typeof text !== "string" || !text.trim()) return "";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.join("\n");
}
__name(normalizeLyricText, "normalizeLyricText");
async function getCachedAudioResponse(request, env, ctx, provider, id, quality) {
  if (!env.MUSIC_BUCKET) return redirectToSongUrl(env, provider, id, quality);
  const key = getAudioKey(provider, id, quality);
  const range = parseRangeHeader(request.headers.get("Range"));
  const cached = await env.MUSIC_BUCKET.get(key, range ? { range } : void 0);
  if (cached) return audioObjectResponse(cached, range);
  const urlInfo = await getSongUrl(env, provider, id, quality);
  if (!urlInfo.available || !urlInfo.url) return corsResponse("", 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  const response = await fetch(urlInfo.url, { headers: { Accept: "audio/*,*/*" } });
  if (!response.ok || !response.body) return corsResponse("", response.status || 502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  const contentType = response.headers.get("Content-Type") || "audio/mpeg";
  const contentLength = Number(response.headers.get("Content-Length") || 0);
  if (contentLength > 0 && contentLength < r2AudioLimitBytes) {
    ctx.waitUntil(storeAudioObject(env, key, response.clone(), contentType, contentLength));
  }
  return corsResponse(response.body, 200, {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": `public, max-age=${audioCacheSeconds}, s-maxage=${audioCacheSeconds}`
  });
}
__name(getCachedAudioResponse, "getCachedAudioResponse");
async function redirectToSongUrl(env, provider, id, quality) {
  const urlInfo = await getSongUrl(env, provider, id, quality);
  if (!urlInfo.available || !urlInfo.url) return corsResponse("", 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  return corsResponse("", 302, { Location: urlInfo.url, "Cache-Control": "no-store" });
}
__name(redirectToSongUrl, "redirectToSongUrl");
function getAudioKey(provider, id, quality) {
  return `audio/${provider}/${encodeURIComponent(id)}/${quality}`;
}
__name(getAudioKey, "getAudioKey");
function parseRangeHeader(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;
  const offset = Number(match[1]);
  const end = match[2] ? Number(match[2]) : NaN;
  if (!Number.isSafeInteger(offset) || offset < 0) return null;
  if (!Number.isNaN(end)) {
    if (!Number.isSafeInteger(end) || end < offset) return null;
    return { offset, length: end - offset + 1 };
  }
  return { offset };
}
__name(parseRangeHeader, "parseRangeHeader");
function audioObjectResponse(object, range) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", `public, max-age=${audioCacheSeconds}, s-maxage=${audioCacheSeconds}`);
  headers.set("Content-Type", headers.get("Content-Type") || "audio/mpeg");
  if (range) {
    const offset = range.offset || 0;
    const length = range.length || Math.max(0, object.size - offset);
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
__name(audioObjectResponse, "audioObjectResponse");
async function storeAudioObject(env, key, response, contentType, size) {
  await evictOldAudioObjects(env, size);
  await env.MUSIC_BUCKET.put(key, response.body, {
    httpMetadata: { contentType },
    customMetadata: { cachedAt: (/* @__PURE__ */ new Date()).toISOString() }
  });
}
__name(storeAudioObject, "storeAudioObject");
async function evictOldAudioObjects(env, incomingSize) {
  let cursor;
  const objects = [];
  let total = 0;
  do {
    const page = await env.MUSIC_BUCKET.list({ prefix: "audio/", cursor });
    objects.push(...page.objects);
    total += page.objects.reduce((sum, item) => sum + (item.size || 0), 0);
    cursor = page.truncated ? page.cursor : void 0;
  } while (cursor);
  if (total + incomingSize <= r2AudioLimitBytes) return;
  objects.sort((a, b) => new Date(a.uploaded || 0) - new Date(b.uploaded || 0));
  const deleteCount = Math.max(1, Math.ceil(objects.length / 2));
  const deleteKeys = objects.slice(0, deleteCount).map((item) => item.key);
  if (deleteKeys.length) await env.MUSIC_BUCKET.delete(deleteKeys);
}
__name(evictOldAudioObjects, "evictOldAudioObjects");
async function getSongUrl(env, provider, id, quality) {
  const key = cacheKey(["url", provider, id, quality]);
  const cached = getCached(key);
  if (cached) return cached;
  const edgeCache = caches.default;
  const edgeRequest = new Request(`https://site-music-cache.local/url/${provider}/${encodeURIComponent(id)}/${quality}`);
  const edgeCached = await edgeCache.match(edgeRequest);
  if (edgeCached) {
    const result2 = await edgeCached.json();
    setCached(key, result2, getSongUrlTtlSeconds(result2) * 1e3);
    return result2;
  }
  const body = await fetchNetease(env, "/weapi/song/enhance/player/url/v1", {
    ids: [id],
    level: qualityToLevel(quality),
    encodeType: "mp3"
  });
  const result = normalizeSongUrl(body);
  const ttlSeconds = getSongUrlTtlSeconds(result);
  setCached(key, result, ttlSeconds * 1e3);
  if (result.available && result.url) {
    await edgeCache.put(edgeRequest, corsResponse(JSON.stringify(result), 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`
    }).clone());
  }
  return result;
}
__name(getSongUrl, "getSongUrl");
async function getSongLyric(env, provider, id) {
  const key = cacheKey(["lyric", provider, id]);
  const cached = getCached(key);
  if (cached !== null) return cached;
  const body = await fetchNetease(env, "/weapi/song/lyric", { id, lv: -1, tv: -1 });
  const lyric = normalizeLyric(body);
  setCached(key, lyric, monthMs);
  return lyric;
}
__name(getSongLyric, "getSongLyric");
async function buildNeteasePlaylist(env, { provider, playlistId, limit }) {
  const key = cacheKey(["playlist-v4-trackids", provider, playlistId, limit]);
  const cached = getCached(key);
  if (cached) return cached;
  const detailBody = await fetchNetease(env, "/weapi/v6/playlist/detail", {
    id: playlistId,
    n: 1e5,
    s: 8
  });
  const playlist = detailBody.playlist || {};
  const coverImgUrl = playlist.coverImgUrl;
  const playlistName = playlist.name || "Music Playlist";
  const trackIds = (playlist.trackIds || []).map((item) => item.id || item);
  let allTracks = [];
  if (trackIds.length === 0) {
    allTracks = playlist.tracks || [];
  } else {
    const targetIds = limit > 0 ? trackIds.slice(0, limit) : trackIds;
    const batchSize = 1e3;
    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batchIds = targetIds.slice(i, i + batchSize);
      const songBody = await fetchNetease(env, "/weapi/v3/song/detail", {
        c: JSON.stringify(batchIds.map((id) => ({ id }))),
        ids: JSON.stringify(batchIds)
      });
      const songs = songBody.songs || [];
      allTracks.push(...songs);
    }
  }
  const audio = [];
  let skipped = 0;
  for (const track of allTracks) {
    const song = normalizeSong(track, coverImgUrl);
    if (!song.id) {
      skipped += 1;
      continue;
    }
    audio.push({ id: song.id, name: song.name, artist: song.artist, cover: song.cover });
  }
  const result = {
    source: "netease-worker",
    provider,
    playlistId,
    title: playlistName,
    count: audio.length,
    skipped,
    audio
  };
  setCached(key, result, 60 * 60 * 1e3);
  return result;
}
__name(buildNeteasePlaylist, "buildNeteasePlaylist");
function qualityToLevel(quality) {
  const q = String(quality).toLowerCase();
  if (q.includes("128") || q === "standard") return "standard";
  if (q.includes("192") || q === "higher") return "higher";
  if (q.includes("320") || q === "exhigh") return "exhigh";
  if (q.includes("flac") || q === "lossless") return "lossless";
  return "exhigh";
}
__name(qualityToLevel, "qualityToLevel");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4oaQUx/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = cloudflare_music_worker_default;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4oaQUx/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-music-worker.js.map
