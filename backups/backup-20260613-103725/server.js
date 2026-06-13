import express from "express";
import dns from "node:dns";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

dns.setDefaultResultOrder("ipv4first");

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, ".env"));

const postsDir = path.join(__dirname, "posts");
const port = process.env.PORT ? Number(process.env.PORT) : 12811;
const karpovBaseUrl = process.env.KARPOV_GATEWAY_BASE_URL || "https://gateway.karpov.cn/api/docs-proxy";
const karpovApiKey = process.env.KARPOV_GATEWAY_API_KEY || "";
const karpovCookie = process.env.KARPOV_GATEWAY_COOKIE || "";
const defaultMusicProvider = process.env.KARPOV_MUSIC_PROVIDER || "netease";
const defaultMusicPlaylistId = process.env.KARPOV_MUSIC_PLAYLIST_ID || "2668671168";
const defaultMusicQuality = process.env.KARPOV_MUSIC_QUALITY || "MP3_320";
const monthSeconds = 30 * 24 * 60 * 60;
const monthMs = monthSeconds * 1000;
const songUrlSeconds = 6 * 60 * 60;
const songUrlBrowserSeconds = 10 * 60;
const musicCache = new Map();

marked.setOptions({
  gfm: true,
  breaks: false
});

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;
  const source = fsSync.readFileSync(filePath, "utf8");
  source.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index < 1) return;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  });
}

function countContentWords(content) {
  const text = String(content || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ");
  const cjk = text.match(/[\u4e00-\u9fff]/g) || [];
  const words = text.match(/[A-Za-z0-9_+-]+/g) || [];
  return cjk.length + words.length;
}

function normalizePostMeta(slug, data = {}, content = "") {
  const tags = Array.isArray(data.tags)
    ? data.tags.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug;
  const description = typeof data.description === "string" && data.description.trim()
    ? data.description.trim()
    : "";
  const category = typeof data.category === "string" && data.category.trim()
    ? data.category.trim()
    : "Article";
  const gameUrl = typeof data.gameUrl === "string" ? data.gameUrl.trim() : "";
  const cover = typeof data.cover === "string" && data.cover.trim()
    ? data.cover.trim()
    : "";
  const updated = data.updated || data.update || "";
  const wordCount = countContentWords(content);
  const readingTime = Math.max(1, Math.ceil(wordCount / 400));

  return {
    slug,
    title,
    date: data.date || "",
    updated,
    description,
    summary: data.summary || description,
    category,
    tags,
    gameUrl,
    cover,
    pinned: Boolean(data.pinned),
    wordCount,
    readingTime,
    yearMonth: data.date ? String(data.date).slice(0, 7) : ""
  };
}

async function readPostFile(filename) {
  const slug = filename.replace(/\.md$/i, "");
  const fullPath = path.join(postsDir, filename);
  const source = await fs.readFile(fullPath, "utf8");
  const parsed = matter(source);
  const meta = normalizePostMeta(slug, parsed.data, parsed.content);
  const html = marked.parse(parsed.content);
  return {
    ...meta,
    html
  };
}

async function listPosts() {
  const entries = await fs.readdir(postsDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name);

  const posts = await Promise.all(markdownFiles.map(readPostFile));
  return posts
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.date).localeCompare(String(a.date)))
    .map(({ html, ...meta }) => meta);
}

function getCached(key) {
  const item = musicCache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    musicCache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttlMs) {
  musicCache.set(key, { value, expiresAt: Date.now() + ttlMs });
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

async function fetchKarpov(pathname, params = {}) {
  if (!karpovApiKey && !karpovCookie) {
    const error = new Error("Music service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const base = karpovBaseUrl.endsWith("/") ? karpovBaseUrl : karpovBaseUrl + "/";
  const url = new URL(String(pathname).replace(/^\/+/, ""), base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  const headers = {
    Accept: "application/json"
  };
  if (karpovApiKey) headers.Authorization = `Bearer ${karpovApiKey}`;
  if (karpovCookie) headers.Cookie = karpovCookie;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    response = await fetch(url, { headers, signal: controller.signal });
  } catch (error) {
    const cause = error.cause || {};
    error.statusCode = 502;
    error.details = error.name === "AbortError"
      ? "Karpov request timed out"
      : [cause.code, cause.hostname, cause.address].filter(Boolean).join(" ") || error.message;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

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
  if (Array.isArray(artists)) {
    return artists.map((item) => item?.name || item?.title || item).filter(Boolean).join(" / ") || "Unknown";
  }
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
    expiresInSeconds: Number(audio.expires_in_seconds || audio.expiresInSeconds || payload.expiresInSeconds || payload.expires_in_seconds || 0)
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

async function getSongUrl(provider, id, quality) {
  const key = cacheKey(["url", provider, id, quality]);
  const cached = getCached(key);
  if (cached) return cached;
  const body = await fetchKarpov(`/v1/${provider}/songs/${encodeURIComponent(id)}/url`, { quality });
  const result = normalizeSongUrl(body);
  setCached(key, result, getSongUrlTtlSeconds(result) * 1000);
  return result;
}

async function getSongLyric(provider, id) {
  const key = cacheKey(["lyric", provider, id]);
  const cached = getCached(key);
  if (cached !== null) return cached;
  const body = await fetchKarpov(`/v1/${provider}/songs/${encodeURIComponent(id)}/lyric`);
  const lyric = normalizeLyric(body);
  setCached(key, lyric, monthMs);
  return lyric;
}

async function buildKarpovPlaylist({ provider, playlistId, limit }) {
  const key = cacheKey(["playlist", provider, playlistId, limit]);
  const cached = getCached(key);
  if (cached) return cached;

  const playlistBody = await fetchKarpov(`/v1/${provider}/playlists/${encodeURIComponent(playlistId)}`);
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
    audio.push({
      id: song.id,
      name: song.name,
      artist: song.artist,
      cover: song.cover
    });
  }

  const result = {
    source: "karpov",
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

app.use(express.static(__dirname));

app.get("/api/music/playlist", async (req, res) => {
  const provider = getSafeToken(req.query.provider, defaultMusicProvider);
  const playlistId = getSafeToken(req.query.playlistId, defaultMusicPlaylistId);
  const limit = getLimit(req.query.limit);

  if (!provider || !playlistId) {
    res.status(400).json({ error: "Missing music provider or playlist id." });
    return;
  }

  try {
    const playlist = await buildKarpovPlaylist({ provider, playlistId, limit });
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600").json(playlist);
  } catch (error) {
    const status = error.statusCode || 502;
    console.warn("music proxy error:", error.message, error.details || "");
    res.status(status).json({
      error: status === 503 ? "Music service is not configured." : "Music provider request failed.",
      details: error.details || undefined
    });
  }
});

app.get("/api/music/url", async (req, res) => {
  const provider = getSafeToken(req.query.provider, defaultMusicProvider);
  const id = getSafeToken(req.query.id, "");
  const quality = getSafeToken(req.query.quality, defaultMusicQuality) || defaultMusicQuality;

  if (!provider || !id) {
    res.status(400).type("text/plain; charset=utf-8").send("");
    return;
  }

  try {
    const urlInfo = await getSongUrl(provider, id, quality);
    if (!urlInfo.available || !urlInfo.url) {
      res.status(404).type("text/plain; charset=utf-8").send("");
      return;
    }
    const browserTtlSeconds = Math.min(songUrlBrowserSeconds, getSongUrlTtlSeconds(urlInfo));
    res.set("Cache-Control", `private, max-age=${browserTtlSeconds}`).redirect(302, urlInfo.url);
  } catch (error) {
    const status = error.statusCode || 502;
    console.warn("music url error:", error.message, error.details || "");
    res.status(status).type("text/plain; charset=utf-8").send("");
  }
});

app.get("/api/music/audio", async (req, res) => {
  const provider = getSafeToken(req.query.provider, defaultMusicProvider);
  const id = getSafeToken(req.query.id, "");
  const quality = getSafeToken(req.query.quality, defaultMusicQuality) || defaultMusicQuality;

  if (!provider || !id) {
    res.status(400).type("text/plain; charset=utf-8").send("");
    return;
  }

  try {
    const urlInfo = await getSongUrl(provider, id, quality);
    if (!urlInfo.available || !urlInfo.url) {
      res.status(404).type("text/plain; charset=utf-8").send("");
      return;
    }
    res.set("Cache-Control", "no-store").redirect(302, urlInfo.url);
  } catch (error) {
    const status = error.statusCode || 502;
    console.warn("music audio error:", error.message, error.details || "");
    res.status(status).type("text/plain; charset=utf-8").send("");
  }
});

app.get("/api/music/lyric", async (req, res) => {
  const provider = getSafeToken(req.query.provider, defaultMusicProvider);
  const id = getSafeToken(req.query.id, "");

  if (!provider || !id) {
    res.status(400).type("text/plain; charset=utf-8").send("");
    return;
  }

  try {
    const lyric = await getSongLyric(provider, id);
    res.set("Cache-Control", `public, max-age=${monthSeconds}, s-maxage=${monthSeconds}`).type("text/plain; charset=utf-8").send(lyric);
  } catch (error) {
    const status = error.statusCode || 502;
    console.warn("music lyric error:", error.message, error.details || "");
    res.status(status).type("text/plain; charset=utf-8").send("");
  }
});

app.get("/api/posts", async (_, res) => {
  try {
    const posts = await listPosts();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to load posts." });
  }
});

app.get("/api/posts/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const post = await readPostFile(slug + ".md");
    res.json(post);
  } catch (error) {
    res.status(404).json({ error: "Post not found." });
  }
});

app.get("/health", (_, res) => res.send("ok"));

app.listen(port, "0.0.0.0", () => {
  console.log("Server listening on port", port);
});
