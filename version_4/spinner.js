
(async () => {
  window.__pokemonLoaderCleanup?.();

  const STYLE_ID = "pokemon-evolution-loader-style";
  const WRAP_ID = "pokemon-evolution-loader";
  const HIDE_CLASS = "pokemon-loader-installed";

  const player = document.querySelector(".html5-video-player");
  if (!player) return;

  const charizardURL =
    "https://img.pokemondb.net/sprites/black-white/anim/normal/charizard.gif";

  const preloaded = new Image();
  preloaded.src = charizardURL;

  try {
    await preloaded.decode();
  } catch {
    return;
  }

  if (!player.isConnected) return;

  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(WRAP_ID)?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .html5-video-player.${HIDE_CLASS} .ytp-spinner-container {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      animation: none !important;
      pointer-events: none !important;
    }

    #${WRAP_ID} {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 120px;
      height: 120px;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      pointer-events: none;
    }

    #${WRAP_ID} img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 3px 5px rgba(0, 0, 0, .6));
    }
  `;

  document.head.appendChild(style);
  player.classList.add(HIDE_CLASS);

  const wrapper = document.createElement("div");
  wrapper.id = WRAP_ID;

  const display = document.createElement("img");
  display.src = preloaded.src;
  display.alt = "Charizard";
  display.draggable = false;

  wrapper.appendChild(display);
  player.appendChild(wrapper);

  let active = false;

  function startLoader() {
    if (active) return;
    active = true;
    wrapper.style.display = "flex";
  }

  function stopLoader() {
    if (!active) return;
    active = false;
    wrapper.style.display = "none";
  }

  function checkBuffering() {
    const video = player.querySelector("video");
    if (!video) return;

    const buffering =
      !video.paused &&
      !video.ended &&
      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;

    if (buffering) startLoader();
    else stopLoader();
  }

  const video = player.querySelector("video");

  const events = [
    "waiting",
    "playing",
    "canplay",
    "seeking",
    "seeked",
    "pause",
    "ended",
  ];

  events.forEach((event) => {
    video?.addEventListener(event, checkBuffering);
  });

  const observer = new MutationObserver(() => {
    if (player.isConnected && !player.classList.contains(HIDE_CLASS)) {
      player.classList.add(HIDE_CLASS);
    }

    checkBuffering();
  });

  observer.observe(player, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });

  window.__pokemonLoaderCleanup = () => {
    stopLoader();
    observer.disconnect();

    events.forEach((event) => {
      video?.removeEventListener(event, checkBuffering);
    });

    wrapper.remove();
    player.classList.remove(HIDE_CLASS);
    style.remove();

    delete window.__pokemonLoaderCleanup;
  };

  checkBuffering();
})();
