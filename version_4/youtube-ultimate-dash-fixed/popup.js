/**
 * YouTube Ultimate Suite — popup.js
 * Controls: acb, blk, vc (video-card), wp (wallpaper), gc (gemini)
 */

"use strict";

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

function sendToActiveTabs(msg) {
  chrome.tabs.query({ url: ["*://*.youtube.com/*", "https://www.youtube.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  });
}

// ─────────────────────────────────────────────────────
// MODULE: ANTI CLICKBAIT
// ─────────────────────────────────────────────────────

(function initAcb() {
  const searchToggle = document.getElementById("acb-search");
  const recommendToggle = document.getElementById("acb-recommend");

  // Load saved state
  chrome.storage.local.get(
    ["acb_search", "acb_recommend"],
    (data) => {
      searchToggle.checked = data.acb_search ?? true;
      recommendToggle.checked = data.acb_recommend ?? true;
    }
  );

  function update() {
    const state = {
      acb_search: searchToggle.checked,
      acb_recommend: recommendToggle.checked,
    };

    // Save
    chrome.storage.local.set(state);

    // Send to all YouTube tabs
    chrome.tabs.query(
      { url: ["*://*.youtube.com/*", "https://www.youtube.com/*"] },
      (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: "EXT_ACB",
            search: state.acb_search,
            recommend: state.acb_recommend,
          }).catch(() => {});
        });
      }
    );
  }

  searchToggle.addEventListener("change", update);
  recommendToggle.addEventListener("change", update);
})();
// ─────────────────────────────────────────────────────
// MODULE: BLOCKS
// ─────────────────────────────────────────────────────

(function initBlocks() {
  const keys = {
    "blk-glass":     "blk_glass",
    "blk-shorts":    "blk_shorts",
    "blk-recommend": "blk_recommend",
    "blk-comments":  "blk_comments",
  };

  chrome.storage.local.get(Object.values(keys), (d) => {
    for (const [elId, storageKey] of Object.entries(keys)) {
      document.getElementById(elId).checked = d[storageKey] || false;
    }
  });

  for (const [elId, storageKey] of Object.entries(keys)) {
    document.getElementById(elId).addEventListener("change", (e) => {
      const value = e.target.checked;
      chrome.storage.local.set({ [storageKey]: value });
      sendToActiveTabs({ type: "EXT_BLK", feature: storageKey, value });
    });
  }
})();

// ─────────────────────────────────────────────────────
// MODULE: VIDEO CARD CUSTOMIZER
// ─────────────────────────────────────────────────────

(function initVideoCard() {
  const GLASS_SWATCH_MAP = {
    "rgba(0,0,0,0)":          "transparent",
    "rgba(255,255,255,0.15)": "rgba(255,255,255,0.7)",
    "rgba(0,0,0,0.35)":       "rgba(0,0,0,0.6)",
    "rgba(255,60,60,0.25)":   "rgba(255,60,60,0.8)",
    "rgba(255,140,0,0.25)":   "rgba(255,140,0,0.8)",
    "rgba(255,220,0,0.2)":    "rgba(255,220,0,0.8)",
    "rgba(0,220,100,0.2)":    "rgba(0,220,100,0.8)",
    "rgba(0,200,255,0.2)":    "rgba(0,200,255,0.8)",
    "rgba(50,100,255,0.25)":  "rgba(50,100,255,0.8)",
    "rgba(160,50,255,0.25)":  "rgba(160,50,255,0.8)",
    "rgba(255,50,180,0.2)":   "rgba(255,50,180,0.8)",
    "rgba(0,0,0,0.55)":       "rgba(0,0,0,0.85)",
  };

  const FONT_SWATCH_MAP = {
    "inherit": "#555", "#ffffff": "#ffffff", "#e0e0e0": "#e0e0e0",
    "#a0a0a0": "#a0a0a0", "#000000": "#000000", "#ff4444": "#ff4444",
    "#ff8800": "#ff8800", "#ffdd00": "#ffdd00", "#44ff88": "#44ff88",
    "#00ccff": "#00ccff", "#4488ff": "#4488ff", "#aa44ff": "#aa44ff",
    "#ff44cc": "#ff44cc",
  };

  let currentTheme = "custom";

  function val(id) { return document.getElementById(id).value; }

  function updateSwatches() {
    const bv = val("border-color");
    document.getElementById("border-swatch").style.background =
      bv === "transparent" ? "transparent" : bv;
    document.getElementById("glass-swatch").style.background =
      GLASS_SWATCH_MAP[val("glass-color")] || "transparent";
    const fv = val("font-color");
    const fs = document.getElementById("font-swatch");
    fs.style.background = FONT_SWATCH_MAP[fv] || "#555";
    fs.style.border = fv === "#ffffff" ? "1px solid #444" : "1px solid #333";
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll(".theme-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
    document.getElementById("custom-panel").classList.toggle("disabled", theme !== "custom");
  }

  function push(extra = {}) {
    const borderColor = val("border-color");
    const glassColor  = val("glass-color");
    const fontColor   = val("font-color");
    const translucent = document.getElementById("vc-translucent").checked;

    updateSwatches();

    const payload = {
      vc_theme:       currentTheme,
      vc_translucent: translucent,
      vc_borderColor: borderColor,
      vc_glassColor:  glassColor,
      vc_fontColor:   fontColor,
      ...extra,
    };

    chrome.storage.local.set(payload);

    sendToActiveTabs({ type: "YT_THEME_UPDATE", ...payload });
  }

  // Theme buttons
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTheme = btn.dataset.theme;
      updateThemeButtons(currentTheme);
      push();
    });
  });

  document.getElementById("vc-translucent").addEventListener("change", () => push());
  document.getElementById("border-color").addEventListener("change", push);
  document.getElementById("glass-color").addEventListener("change",  push);
  document.getElementById("font-color").addEventListener("change",   push);

  // Restore on open
  chrome.storage.local.get(
    ["vc_theme", "vc_translucent", "vc_borderColor", "vc_glassColor", "vc_fontColor"],
    (d) => {
      currentTheme = d.vc_theme || "custom";
      if (d.vc_borderColor) document.getElementById("border-color").value = d.vc_borderColor;
      if (d.vc_glassColor)  document.getElementById("glass-color").value  = d.vc_glassColor;
      if (d.vc_fontColor)   document.getElementById("font-color").value   = d.vc_fontColor;
      if (d.vc_translucent) document.getElementById("vc-translucent").checked = d.vc_translucent;
      updateThemeButtons(currentTheme);
      updateSwatches();
    }
  );
})();

// ─────────────────────────────────────────────────────
// MODULE: WALLPAPER ENGINE
// ─────────────────────────────────────────────────────

(function initWallpaper() {
  const dropdown    = document.getElementById("wp-dropdown");
  const statusEl    = document.getElementById("wp-status");
  const currentEl   = document.getElementById("wp-current");

  function showStatus(msg) {
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = ""; }, 2000);
  }

  function sendUpdateToTabs() {
    sendToActiveTabs({ action: "update" });
  }

  function render() {
    chrome.storage.local.get(["wallpapers", "currentIndex"], (data) => {
      const wallpapers   = data.wallpapers || [];
      const currentIndex = data.currentIndex || 0;

      dropdown.innerHTML = "";

      wallpapers.forEach((w, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = w.name;
        if (i === currentIndex) opt.selected = true;
        dropdown.appendChild(opt);
      });

      currentEl.textContent = wallpapers.length
        ? "Active: " + (wallpapers[currentIndex]?.name || "None")
        : "No wallpapers added";
    });
  }

  dropdown.addEventListener("change", () => {
    const index = parseInt(dropdown.value);
    chrome.storage.local.set({ currentIndex: index }, () => {
      render();
      sendUpdateToTabs();
    });
  });

  document.getElementById("wp-add").addEventListener("click", () => {
    const name = document.getElementById("wp-name").value.trim();
    const url  = document.getElementById("wp-url").value.trim();
    if (!name || !url) return showStatus("Enter name & URL");

    chrome.storage.local.get(["wallpapers"], (data) => {
      const wallpapers = data.wallpapers || [];

      if (wallpapers.some(w => w.name.toLowerCase() === name.toLowerCase())) {
        return showStatus("Name already exists");
      }

      wallpapers.push({ name, url });

      chrome.storage.local.set({ wallpapers, currentIndex: wallpapers.length - 1 }, () => {
        document.getElementById("wp-name").value = "";
        document.getElementById("wp-url").value  = "";
        showStatus("Added!");
        render();
        sendUpdateToTabs();
      });
    });
  });

  document.getElementById("wp-apply").addEventListener("click", () => {
    const index = parseInt(dropdown.value);
    if (isNaN(index)) return showStatus("Select a wallpaper");
    chrome.storage.local.set({ currentIndex: index }, () => {
      render();
      sendUpdateToTabs();
      showStatus("Applied!");
    });
  });

  document.getElementById("wp-delete").addEventListener("click", () => {
    const index = parseInt(dropdown.value);

    chrome.storage.local.get(["wallpapers", "currentIndex"], (data) => {
      const wallpapers = data.wallpapers || [];
      if (!wallpapers.length) return showStatus("Nothing to delete");

      wallpapers.splice(index, 1);
      const newIndex = wallpapers.length > 0
        ? Math.min(data.currentIndex || 0, wallpapers.length - 1)
        : 0;

      chrome.storage.local.set({ wallpapers, currentIndex: newIndex }, () => {
        showStatus("Deleted");
        render();
        sendUpdateToTabs();
      });
    });
  });

  document.getElementById("wp-clear").addEventListener("click", () => {
    chrome.storage.local.set({ wallpapers: [], currentIndex: 0 }, () => {
      showStatus("Cleared");
      render();
      sendToActiveTabs({ action: "remove" });
    });
  });

  render();
})();

// ─────────────────────────────────────────────────────
// MODULE: GEMINI AUTO-PROMPT
// ─────────────────────────────────────────────────────

(function initGemini() {
  const toggle = document.getElementById("gc-enabled");
  const textarea = document.getElementById("gc-prompt");

chrome.storage.local.get(["gc_enabled", "gc_prompt"], (d) => {
    // Default true (original behavior was always-on)
    toggle.checked = d.gc_enabled !== false;
    if (textarea) {
  textarea.value = d.gc_prompt || "";
}
  });

  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ gc_enabled: toggle.checked });
  });

  if (textarea) {
  textarea.addEventListener("input", () => {
    chrome.storage.local.set({ gc_prompt: textarea.value });
  });
}
})();



// ─────────────────────────────────────────────────────
// MODULE: SEARCH DASHBOARD GRID
// ─────────────────────────────────────────────────────

(function initDash() {
  const enabledToggle = document.getElementById("dash-enabled");
  const speedSlider   = document.getElementById("dash-speed");
  const speedLabel    = document.getElementById("dash-speed-label");

  // Load saved state
  chrome.storage.local.get(["dash_enabled", "dash_fetchSpeed"], (d) => {
    enabledToggle.checked = d.dash_enabled !== false; // default ON
    const speed = d.dash_fetchSpeed || 2000;
    speedSlider.value = speed;
    speedLabel.textContent = speed + "ms";
  });

  // Speed slider live label
  speedSlider.addEventListener("input", () => {
    speedLabel.textContent = speedSlider.value + "ms";
  });

  // Enable toggle
  enabledToggle.addEventListener("change", () => {
    const value = enabledToggle.checked;
    chrome.storage.local.set({ dash_enabled: value });
    sendToActiveTabs({ type: "EXT_DASH", enabled: value });
  });

  // Speed slider change
  speedSlider.addEventListener("change", () => {
    const value = Number(speedSlider.value);
    chrome.storage.local.set({ dash_fetchSpeed: value });
    sendToActiveTabs({ type: "EXT_DASH", fetchSpeed: value });
  });
})();

// ─────────────────────────────────────────────────────
// MODULE: EDUCATIONAL FILTER
// ─────────────────────────────────────────────────────

(function initFilter() {
  const DEFAULT_CHANNELS = [
    'freecodecamp.org', 'cs50', 'mit opencourseware', 'the cherno',
    'computerphile', 'fireship', 'stanford', 'traversy media',
    'harvard cs50', 'sentdex', 'corey schafer', 'the coding train',
    'tech with tim', 'web dev simplified', 'kevin powell',
    'academind', 'programming with mosh'
  ];

  const DEFAULT_BLOCKED = [
    'shocking', 'fear', 'destroyed', 'dead', 'crazy', 'insane',
    'secret', 'reacts', 'exposed', 'warning', 'ai killed',
    'ai replaced', 'truth about', 'end of', 'panic'
  ];

  const modeEl      = document.getElementById('filter-mode');
  const chanInput   = document.getElementById('chan-input');
  const chanAddBtn  = document.getElementById('chan-add');
  const chanList    = document.getElementById('chan-list');
  const chanDelBtn  = document.getElementById('chan-delete');
  const wordInput   = document.getElementById('word-input');
  const wordAddBtn  = document.getElementById('word-add');
  const wordList    = document.getElementById('word-list');
  const wordDelBtn  = document.getElementById('word-delete');

  let chans = [];
  let words = [];

  function renderChanList() {
    chanList.innerHTML = '';
    chans.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = c;
      chanList.appendChild(opt);
    });
  }

  function renderWordList() {
    wordList.innerHTML = '';
    words.forEach((w, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = w;
      wordList.appendChild(opt);
    });
  }

  function save() {
    const filterMode = modeEl.value;
    chrome.storage.local.set({ filterMode, whitelistChans: chans, blockedWords: words });
    sendToActiveTabs({ type: 'EXT_FILTER', filterMode, whitelistChans: chans, blockedWords: words });
  }

  // Load saved state
  chrome.storage.local.get(['filterMode', 'whitelistChans', 'blockedWords'], d => {
    modeEl.value = d.filterMode || 'both';
    chans = d.whitelistChans || DEFAULT_CHANNELS.slice();
    words = d.blockedWords   || DEFAULT_BLOCKED.slice();
    renderChanList();
    renderWordList();
  });

  modeEl.addEventListener('change', save);

  chanAddBtn.addEventListener('click', () => {
    const val = chanInput.value.trim().toLowerCase();
    if (!val || chans.includes(val)) return;
    chans.push(val);
    chanInput.value = '';
    renderChanList();
    save();
  });

  chanDelBtn.addEventListener('click', () => {
    const idx = parseInt(chanList.value);
    if (isNaN(idx)) return;
    chans.splice(idx, 1);
    renderChanList();
    save();
  });

  wordAddBtn.addEventListener('click', () => {
    const val = wordInput.value.trim().toLowerCase();
    if (!val || words.includes(val)) return;
    words.push(val);
    wordInput.value = '';
    renderWordList();
    save();
  });

  wordDelBtn.addEventListener('click', () => {
    const idx = parseInt(wordList.value);
    if (isNaN(idx)) return;
    words.splice(idx, 1);
    renderWordList();
    save();
  });
})();
