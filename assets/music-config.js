window.SITE_MUSIC_CONFIG = {
  source: "karpov",
  provider: "netease",
  type: "playlist",
  playlistId: "2668671168",
  endpoint: "https://site-music-proxy.3405029277.workers.dev/api/music/playlist",
  audioEndpoint: "https://site-music-proxy.3405029277.workers.dev/api/music/audio",
  lyricEndpoint: "https://site-music-proxy.3405029277.workers.dev/api/music/lyric",
  limit: 0,
  quality: "MP3_320",
  lyrics: true,

  fallback: {
    source: "local",
    audio: [{
      name: "Background Music",
      artist: "Local",
      url: "assets/music/background.wav",
      cover: "assets/avatar.jpg",
      lrc: ""
    }]
  }
};
