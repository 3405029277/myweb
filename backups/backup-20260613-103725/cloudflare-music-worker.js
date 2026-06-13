const DEFAULT_BASE_URL = "https://ldc.karpov.cn";
const DEFAULT_PROVIDER = "netease";
const DEFAULT_PLAYLIST_ID = "2668671168";
const DEFAULT_QUALITY = "MP3_320";
const monthSeconds = 30 * 24 * 60 * 60;
const monthMs = monthSeconds * 1000;
const songUrlSeconds = 6 * 60 * 60;
const songUrlBrowserSeconds = 10 * 60;
const r2AudioLimitBytes = 900 * 1024 * 1024;
const audioCacheSeconds = monthSeconds;
const cache = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return corsResponse(null, 204);
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    if (url.pathname !== "/api/music/playlist" && url.pathname !== "/music/playlist" &&
        url.pathname !== "/api/music/url" && url.pathname !== "/music/url" &&
        url.pathname !== "/api/music/audio" && url.pathname !== "/music/audio" &&
        url.pathname !== "/api/music/lyric" && url.pathname !== "/music/lyric") {
      return json({ error: "Not found." }, 404);
    }

    const provider = getSafeToken(url.searchParams.get("provider"), env.KARPOV_MUSIC_PROVIDER || DEFAULT_PROVIDER);

    if (url.pathname === "/api/music/audio" || url.pathname === "/music/audio") {
      const id = getSafeToken(url.searchParams.get("id"), "");
      const quality = getSafeToken(url.searchParams.get("quality"), env.KARPOV_MUSIC_QUALITY || DEFAULT_QUALITY) || DEFAULT_QUALITY;
      if (!provider || !id) return corsResponse("", 400, { "Content-Type": "text/plain; charset=utf-8" });
      try {
        return await getCachedAudioResponse(request, env, ctx, provider, id, quality);
      } catch (error) {
        return corsResponse("", error.statusCode || 502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      }
    }

    if (url.pathname === "/api/music/url" || url.pathname === "/music/url") {
      const id = getSafeToken(url.searchParams.get("id"), "");
      const quality = getSafeToken(url.searchParams.get("quality"), env.KARPOV_MUSIC_QUALITY || DEFAULT_QUALITY) || DEFAULT_QUALITY;
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

    const playlistId = getSafeToken(url.searchParams.get("playlistId"), env.KARPOV_MUSIC_PLAYLIST_ID || DEFAULT_PLAYLIST_ID);
    const limit = getLimit(url.searchParams.get("limit"));

    if (!provider || !playlistId) return json({ error: "Missing music provider or playlist id." }, 400);

    try {
      return await cachedResponse(request, 3600, async () => {
        const playlist = await buildKarpovPlaylist(env, { provider, playlistId, limit });
        return json(playlist);
      });
    } catch (error) {
      const status = error.statusCode || 502;
      return json({
        error: status === 503 ? "Music service is not configured." : "Music provider request failed.",
        details: error.details || undefined
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

function json(value, status = 200) {
  return corsResponse(JSON.stringify(value), status, {
    "Content-Type": "application/json; charset=utf-8"
  });
}

async function cachedResponse(request, ttlSeconds, factory) {
  const cache = caches.default;
  const cached = await cache.match(request);
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
  if (response.status >= 200 && response.status < 400) await cache.put(request, cacheable.clone());
  return cacheable;
}

function getCached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function cacheKey(parts) {
  return parts.map((part) => String(part == null ? "" : part)).join("|");
}

function getSafeToken(value, fallback) {
  const token = String(value || fallback || "").trim();
  return /^[a-z0-9_-]+$/i.test(token) ? token : "";
}

function getLimit(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

function getSongUrlTtlSeconds(urlInfo) {
  if (!urlInfo.available || !urlInfo.url) return 3600;
  if (urlInfo.expiresInSeconds > 120) return Math.min(songUrlSeconds, urlInfo.expiresInSeconds - 60);
  return songUrlSeconds;
}

function unwrapKarpovData(body) {
  if (!body || typeof body !== "object") return body;
  if (Object.prototype.hasOwnProperty.call(body, "data")) return body.data;
  return body;
}

async function fetchKarpov(env, pathname, params = {}) {
  const apiKey = env.KARPOV_GATEWAY_API_KEY || "";
  const cookie = env.KARPOV_GATEWAY_COOKIE || "";
  if (!apiKey && !cookie) {
    const error = new Error("Music service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const baseUrl = env.KARPOV_GATEWAY_BASE_URL || DEFAULT_BASE_URL;
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const url = new URL(String(pathname).replace(/^\/+/, ""), base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  const headers = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(url.toString(), { headers });
  const body = await response.json().catch(() => null);
  if (!response.ok || (body && typeof body.code === "number" && body.code !== 0 && body.code !== 200)) {
    const error = new Error("Music provider request failed.");
    error.statusCode = response.ok ? 502 : response.status;
    error.details = body && body.message ? body.message : undefined;
    throw error;
  }
  return body;
}

function normalizeArtists(song) {
  const artists = song?.artists || song?.singers || song?.artist || song?.singer || song?.ar;
  if (Array.isArray(artists)) return artists.map((item) => item?.name || item?.title || item).filter(Boolean).join(" / ") || "Unknown";
  if (artists && typeof artists === "object") return artists.name || artists.title || "Unknown";
  if (typeof artists === "string" && artists.trim()) return artists.trim();
  return "Unknown";
}

function toHttpsUrl(value) {
  return typeof value === "string" ? value.replace(/^http:\/\//i, "https://") : value;
}

function normalizeSong(song, playlistCover) {
  const id = song?.id || song?.mid || song?.songmid || song?.songId || song?.song_id;
  return {
    id: id == null ? "" : String(id),
    name: song?.name || song?.title || song?.songname || "Unknown",
    artist: normalizeArtists(song),
    cover: toHttpsUrl(song?.cover_url || song?.coverUrl || song?.cover || song?.pic_url || song?.picUrl || song?.album?.cover || playlistCover || "assets/avatar.jpg")
  };
}

function normalizeSongUrl(body) {
  const payload = unwrapKarpovData(body) || {};
  const audio = payload.audio || payload.data || payload;
  return {
    available: payload.available !== false,
    url: toHttpsUrl(audio.url || payload.url || ""),
    expiresInSeconds: Number(audio.expires_in_seconds || audio.expiresInSeconds || payload.expires_in_seconds || 0)
  };
}

function normalizeLyric(body) {
  return normalizeLyricText(extractLyricText(unwrapKarpovData(body)));
}

function extractLyricText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  for (const key of ["lrc", "lyric", "lyrics", "text", "content"]) {
    const text = extractLyricText(value[key]);
    if (text) return text;
  }
  return "";
}

function normalizeLyricText(text) {
  if (typeof text !== "string" || !text.trim()) return "";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length && lines.every((line) => /^\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(line))) return text;
  return convertKarpovJsonLyric(text);
}

function convertKarpovJsonLyric(text) {
  const lines = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (/^\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(trimmed)) return trimmed;
    try {
      const item = JSON.parse(trimmed);
      if (!Number.isFinite(item?.t) || !Array.isArray(item?.c)) return "";
      const content = item.c.map((part) => part?.tx || part?.text || "").join("").trim();
      return content ? `${formatLrcTime(item.t)}${content}` : "";
    } catch (error) {
      return "";
    }
  }).filter(Boolean);
  return lines.join("\n");
}

function formatLrcTime(ms) {
  const total = Math.max(0, Number(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  const hundredths = Math.floor((total - Math.floor(total)) * 100);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}]`;
}

function getPlaylistPayload(body) {
  const payload = unwrapKarpovData(body) || {};
  return payload.playlist || payload;
}

function getPlaylistSongs(playlist) {
  if (Array.isArray(playlist?.songs)) return playlist.songs;
  if (Array.isArray(playlist?.tracks)) return playlist.tracks;
  if (Array.isArray(playlist?.list)) return playlist.list;
  return [];
}

async function getCachedAudioResponse(request, env, ctx, provider, id, quality) {
  if (!env.MUSIC_BUCKET) return redirectToSongUrl(env, provider, id, quality);

  const key = getAudioKey(provider, id, quality);
  const range = parseRangeHeader(request.headers.get("Range"));
  const cached = await env.MUSIC_BUCKET.get(key, range ? { range } : undefined);
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

async function redirectToSongUrl(env, provider, id, quality) {
  const urlInfo = await getSongUrl(env, provider, id, quality);
  if (!urlInfo.available || !urlInfo.url) return corsResponse("", 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  return corsResponse("", 302, { Location: urlInfo.url, "Cache-Control": "no-store" });
}

function getAudioKey(provider, id, quality) {
  return `audio/${provider}/${encodeURIComponent(id)}/${quality}`;
}

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

async function storeAudioObject(env, key, response, contentType, size) {
  await evictOldAudioObjects(env, size);
  await env.MUSIC_BUCKET.put(key, response.body, {
    httpMetadata: { contentType },
    customMetadata: { cachedAt: new Date().toISOString() }
  });
}

async function evictOldAudioObjects(env, incomingSize) {
  let cursor;
  const objects = [];
  let total = 0;
  do {
    const page = await env.MUSIC_BUCKET.list({ prefix: "audio/", cursor });
    objects.push(...page.objects);
    total += page.objects.reduce((sum, item) => sum + (item.size || 0), 0);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  if (total + incomingSize <= r2AudioLimitBytes) return;
  objects.sort((a, b) => new Date(a.uploaded || 0) - new Date(b.uploaded || 0));
  const deleteCount = Math.max(1, Math.ceil(objects.length / 2));
  const deleteKeys = objects.slice(0, deleteCount).map((item) => item.key);
  if (deleteKeys.length) await env.MUSIC_BUCKET.delete(deleteKeys);
}

async function getSongUrl(env, provider, id, quality) {
  const key = cacheKey(["url", provider, id, quality]);
  const cached = getCached(key);
  if (cached) return cached;

  const edgeCache = caches.default;
  const edgeRequest = new Request(`https://site-music-cache.local/url/${provider}/${encodeURIComponent(id)}/${quality}`);
  const edgeCached = await edgeCache.match(edgeRequest);
  if (edgeCached) {
    const result = await edgeCached.json();
    setCached(key, result, getSongUrlTtlSeconds(result) * 1000);
    return result;
  }

  const body = await fetchKarpov(env, `/v1/${provider}/songs/${encodeURIComponent(id)}/url`, { quality });
  const result = normalizeSongUrl(body);
  const ttlSeconds = getSongUrlTtlSeconds(result);
  setCached(key, result, ttlSeconds * 1000);
  if (result.available && result.url) {
    await edgeCache.put(edgeRequest, corsResponse(JSON.stringify(result), 200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`
    }).clone());
  }
  return result;
}

async function getSongLyric(env, provider, id) {
  const key = cacheKey(["lyric", provider, id]);
  const cached = getCached(key);
  if (cached !== null) return cached;
  const body = await fetchKarpov(env, `/v1/${provider}/songs/${encodeURIComponent(id)}/lyric`);
  const lyric = normalizeLyric(body);
  setCached(key, lyric, monthMs);
  return lyric;
}

async function buildKarpovPlaylist(env, { provider, playlistId, limit }) {
  const key = cacheKey(["playlist", provider, playlistId, limit]);
  const cached = getCached(key);
  if (cached) return cached;

  const playlistBody = await fetchKarpov(env, `/v1/${provider}/playlists/${encodeURIComponent(playlistId)}`);
  const playlist = getPlaylistPayload(playlistBody);
  const playlistCover = playlist.cover_url || playlist.coverUrl || playlist.cover || playlist.pic_url || "assets/avatar.jpg";
  const songs = getPlaylistSongs(playlist);
  const audio = [];
  let skipped = 0;

  for (const rawSong of songs) {
    if (limit > 0 && audio.length >= limit) break;
    const song = normalizeSong(rawSong, playlistCover);
    if (!song.id) {
      skipped += 1;
      continue;
    }
    audio.push({ id: song.id, name: song.name, artist: song.artist, cover: song.cover });
  }

  const result = {
    source: "karpov-worker",
    provider,
    playlistId,
    title: playlist.title || playlist.name || "Music Playlist",
    count: audio.length,
    skipped,
    audio
  };
  setCached(key, result, 60 * 60 * 1000);
  return result;
}
