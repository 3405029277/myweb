window.SITE_MUSIC_CONFIG = {
  source: "karpov",
  provider: "netease",
  type: "playlist",
  playlistId: "2668671168",
  endpoint: "/api/music/playlist",
  limit: 0,
  quality: "MP3_320",
  lyrics: true,

  fallback: {
    source: "meting",
    server: "netease",
    type: "playlist",
    id: "2668671168",
    api: "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r"
  }
};
