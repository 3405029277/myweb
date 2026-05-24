(function () {
  "use strict";

  var tracks = window.SITE_MUSIC_TRACKS || [
    {
      name: "BGM",
      artist: "Local",
      url: "assets/music/background.wav",
      cover: "assets/avatar.jpg"
    }
  ];

  if (!window.APlayer || !Array.isArray(tracks) || !tracks.length) return;

  Promise.all(tracks.map(checkTrack)).then(function (results) {
    var playableTracks = results.filter(Boolean);
    if (!playableTracks.length) return;
    initPlayer(playableTracks);
  });

  function checkTrack(track) {
    if (!track || !track.url) return Promise.resolve(null);
    return fetch(track.url, { method: "HEAD", cache: "no-store" })
      .then(function (response) {
        return response.ok ? track : null;
      })
      .catch(function () {
        return null;
      });
  }

  function initPlayer(audio) {
    var container = document.createElement("div");
    container.id = "siteMusicPlayer";
    container.className = "site-music-player";
    container.tabIndex = 0;
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
      audio: audio
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
  }
})();
