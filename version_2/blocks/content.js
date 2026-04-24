document.querySelectorAll('ytd-feed-nudge-renderer').forEach(el => {
    el.remove();
});

// ===== GLASS =====
function applyGlass() {
  if (document.getElementById("glass-style")) return;
  const style = document.createElement("style");
  style.id = "glass-style";
  style.innerHTML = `
    ytd-masthead #container {
      background: rgba(255,255,255,0.03) !important;
      backdrop-filter: blur(18px) !important;
      -webkit-backdrop-filter: blur(18px) !important;
      border-bottom: 1px solid rgba(255,255,255,0.08) !important;
    }
    #background, #masthead-container {
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);
}

function removeGlass() {
  document.getElementById("glass-style")?.remove();
}

// ===== CSS BLOCKS =====
function applyBlocks(settings) {
  let style = document.getElementById("block-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "block-style";
    document.head.appendChild(style);
  }

  let css = "";

  if (settings.shorts) {
    css += `
      ytd-reel-shelf-renderer,
      .ytGridShelfViewModelHost,
      a[href*="/shorts/"] {
        display: none !important;
      }
    `;
  }

  if (settings.recommend) {
    css += `
      #related,
      ytd-watch-next-secondary-results-renderer,
      ytd-compact-video-renderer {
        display: none !important;
      }
    `;
  }

  if (settings.comments) {
    css += `
      #comments,
      ytd-comments {
        display: none !important;
      }
    `;
  }

  style.innerHTML = css;
}

// ===== 10s DELAY FOR RECOMMENDATIONS (NEW) =====
function delayedRecommendations(settings) {
  // Always hide recommendations immediately
  let style = document.getElementById("recommend-delay-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "recommend-delay-style";
    style.innerHTML = `
      #related,
      ytd-watch-next-secondary-results-renderer,
      ytd-compact-video-renderer {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // After 10 seconds → apply actual logic
  setTimeout(() => {
    style.remove();
    applyBlocks(settings);
  }, 3000);
}

// ===== SETTINGS =====
function applySettings() {
  chrome.storage.local.get(["glass","shorts","recommend","comments"], (settings) => {
    settings = Object.assign({glass:false, shorts:false, recommend:false, comments:false}, settings);

    if (settings.glass) applyGlass();
    else removeGlass();

    // ⬇️ ONLY CHANGE HERE
    delayedRecommendations(settings);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "toggle") return;

  chrome.storage.local.get(["glass","shorts","recommend","comments"], (settings) => {
    settings = Object.assign({glass:false, shorts:false, recommend:false, comments:false}, settings);
    settings[msg.feature] = msg.value;

    if (msg.feature === "glass") {
      msg.value ? applyGlass() : removeGlass();
    }

    // ⬇️ ONLY CHANGE HERE
    delayedRecommendations(settings);
  });
});

// initial load
setTimeout(applySettings, 800);