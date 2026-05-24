(function () {
  "use strict";

  var tracks = window.SITE_MUSIC_TRACKS || [
    {
      name: "背景音乐",
      artist: "本地音乐",
      url: "assets/music/background.mp3",
      cover: "assets/avatar.jpg"
    }
  ];

  if (!window.APlayer || !Array.isArray(tracks) || !tracks.length) return;

  var container = document.createElement("div");
  container.id = "siteMusicPlayer";
  container.className = "site-music-player";
  document.body.appendChild(container);

  var player = new APlayer({
    container: container,
    fixed: false,
    mini: false,
    autoplay: false,
    loop: "all",
    order: "list",
    preload: "none",
    volume: Number(localStorage.getItem("siteMusicVolume") || 0.45),
    mutex: true,
    audio: tracks
  });

  player.on("play", function () {
    localStorage.setItem("siteMusicWanted", "1");
  });

  player.on("pause", function () {
    localStorage.setItem("siteMusicWanted", "0");
  });

  player.on("volumechange", function () {
    localStorage.setItem("siteMusicVolume", String(player.audio.volume));
  });

  if (localStorage.getItem("siteMusicWanted") === "1") {
    player.play().catch(function () {});
  }
})();
