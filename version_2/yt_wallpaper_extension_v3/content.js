let currentBg = null;

function applyWallpaper(url) {
  if (currentBg) {
    currentBg.remove();
  }

  const bg = document.createElement("div");
  bg.id = "yt-wallpaper-bg";

  Object.assign(bg.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: "-1",
    transform: "translate(-50%, -50%)"
  });

  document.body.appendChild(bg);

  const img = new Image();
  img.onload = () => {
    const isPortrait = img.height > img.width;

    if (isPortrait) {
      bg.style.width = "100vh";
      bg.style.height = "100vw";
      bg.style.transform = "translate(-50%, -50%) rotate(-90deg)";
    } else {
      bg.style.width = "100vw";
      bg.style.height = "100vh";
      bg.style.transform = "translate(-50%, -50%)";
    }
  };

  img.src = url;

  currentBg = bg;
  makeYouTubeTransparent();
}

function makeYouTubeTransparent() {
  if (document.getElementById("yt-wallpaper-style")) return;

  const style = document.createElement("style");
  style.id = "yt-wallpaper-style";

  style.textContent = `
    ytd-app, #container, #content, ytd-page-manager,
    ytd-watch-flexy, ytd-browse, #primary, #secondary, body {
      background: transparent !important;
    }
  `;

  document.head.appendChild(style);
}

function loadWallpaper() {
  chrome.storage.local.get(["wallpapers", "currentIndex"], (data) => {
    const wallpapers = data.wallpapers || [];
    const index = data.currentIndex || 0;

    if (wallpapers.length === 0) return;

    applyWallpaper(wallpapers[index].url);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "update") {
    loadWallpaper();
  }
});

loadWallpaper();
