/**
 * YouTube Ultimate Suite — content.js
 * Merged from: anti_clickbait, blocks, video-card, wallpaper, only_gemini
 *
 * Architecture:
 *  - window.__ext namespace for all modules
 *  - ONE shared MutationObserver (masterObserver)
 *  - Prefixed storage keys (blk_*, vc_*, wp_*, gc_*)
 *  - Event listeners guarded with flags
 */

"use strict";

// ─────────────────────────────────────────────────────
// GLOBAL NAMESPACE
// ─────────────────────────────────────────────────────
window.__ext = window.__ext || {};

// ─────────────────────────────────────────────────────
// SHARED MASTER OBSERVER
// ─────────────────────────────────────────────────────
(function () {
  if (window.__ext._masterObserverBound) return;
  window.__ext._masterObserverBound = true;

  window.__ext._observerCallbacks = window.__ext._observerCallbacks || [];

  window.__ext.registerObserverCallback = function (fn) {
    window.__ext._observerCallbacks.push(fn);
  };

  const masterObserver = new MutationObserver((mutations) => {
    for (const fn of window.__ext._observerCallbacks) {
      try { fn(mutations); } catch (e) { /* isolate errors per module */ }
    }
  });

  // Start observing once body is available
  function startObserver() {
    const target = document.body || document.documentElement;
    masterObserver.observe(target, { childList: true, subtree: true });
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }
})();

// ─────────────────────────────────────────────────────
// MODULE A — ANTI CLICKBAIT (Thumbnail Shroud)
// ─────────────────────────────────────────────────────
window.__ext.antiClickbait = (() => {
  const SEARCH_ID = "ext-acb-search";
  const RECOMMEND_ID = "ext-acb-recommend";

  function applySearch(enable) {
    let style = document.getElementById(SEARCH_ID);

    if (!enable) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = SEARCH_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      /* SEARCH (unchanged logic, just scoped) */
      ytd-video-renderer ytd-thumbnail,
      ytd-item-section-renderer ytd-thumbnail {
        position: relative !important;
        overflow: hidden !important;
      }

      ytd-video-renderer ytd-thumbnail::after,
      ytd-item-section-renderer ytd-thumbnail::after {
        content: "";
        position: absolute;
        inset: 0;
        background: black;
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.15s ease;
      }

      ytd-video-renderer ytd-thumbnail:hover::after,
      ytd-item-section-renderer ytd-thumbnail:hover::after {
        opacity: 0;
      }
    `;
  }

  function applyRecommend(enable) {
    let style = document.getElementById(RECOMMEND_ID);

    if (!enable) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = RECOMMEND_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      /* RECOMMEND — using ytLockupViewModelHost */

      .ytLockupViewModelHost ytd-thumbnail,
      .ytLockupViewModelHost .ytThumbnailViewModelImage {
        position: relative !important;
        overflow: hidden !important;
      }

      .ytLockupViewModelHost ytd-thumbnail::after,
      .ytLockupViewModelHost .ytThumbnailViewModelImage::after {
        content: "";
        position: absolute;
        inset: 0;
        background: black;
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.15s ease;
      }

      .ytLockupViewModelHost ytd-thumbnail:hover::after,
      .ytLockupViewModelHost .ytThumbnailViewModelImage:hover::after {
        opacity: 0;
      }
    `;
  }

  function init() {
    chrome.storage.local.get(
      ["acb_search", "acb_recommend"],
      (d) => {
        applySearch(d.acb_search ?? true);
        applyRecommend(d.acb_recommend ?? true);
      }
    );
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "EXT_ACB") return;

    if ("search" in msg) applySearch(msg.search);
    if ("recommend" in msg) applyRecommend(msg.recommend);
  });

  return { init };
})();
// ─────────────────────────────────────────────────────
// MODULE B — BLOCKS (Glass Header + DOM Toggles)
// ─────────────────────────────────────────────────────
window.__ext.blocks = (() => {
  const GLASS_ID    = "ext-blk-glass-style";
  const BLOCKS_ID   = "ext-blk-block-style";
  const DELAY_ID    = "ext-blk-recommend-delay-style";

  // Remove distraction feed nudges once on load
  function removeFeedNudges() {
    document.querySelectorAll(
      "ytd-feed-nudge-renderer, yt-horizontal-list-renderer"
    ).forEach(el => el.remove());
  }

  // ISSUE 4 FIX: also remove via observer to catch dynamic injection
  function onNudgeMutations(mutations) {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = node.tagName && node.tagName.toLowerCase();
        if (tag === "ytd-feed-nudge-renderer" || tag === "yt-horizontal-list-renderer") {
          node.remove();
          continue;
        }
        if (node.querySelectorAll) {
          node.querySelectorAll(
            "ytd-feed-nudge-renderer, yt-horizontal-list-renderer"
          ).forEach(el => el.remove());
        }
      }
    }
  }

  function applyGlass() {
    if (document.getElementById(GLASS_ID)) return;
    const style = document.createElement("style");
    style.id = GLASS_ID;
    style.textContent= `
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
    document.getElementById(GLASS_ID)?.remove();
  }

  function applyBlocks(settings) {
    let style = document.getElementById(BLOCKS_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = BLOCKS_ID;
      document.head.appendChild(style);
    }

    let css = "";

    if (settings.blk_shorts) {
  css += `
    /* Shorts shelf (homepage) */
    ytd-reel-shelf-renderer {
      display: none !important;
    }

    /* Grid-based shorts (modern UI) */
    .ytGridShelfViewModelHost {
      display: none !important;
    }

    /* Channel + search shorts cards */
    ytd-rich-item-renderer:has(a[href*="/shorts/"]),
    ytd-video-renderer:has(a[href*="/shorts/"]),
    .ytLockupViewModelHost:has(a[href*="/shorts/"]) {
      display: none !important;
    }
  `;
}

    if (settings.blk_recommend) {
      css += `
        #related,
        ytd-watch-next-secondary-results-renderer,
        ytd-compact-video-renderer {
          display: none !important;
        }
      `;
    }

    if (settings.blk_comments) {
      css += `
        #comments,
        ytd-comments {
          display: none !important;
        }
      `;
    }

    style.textContent= css;
  }

  function delayedRecommendations(settings) {
    let style = document.getElementById(DELAY_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = DELAY_ID;
      style.textContent= `
        #related,
        ytd-watch-next-secondary-results-renderer,
        ytd-compact-video-renderer {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      style.remove();
      applyBlocks(settings);
    }, 1000);
  }

  function applySettings(settings) {
    settings = Object.assign(
      { blk_glass: false, blk_shorts: false, blk_recommend: false, blk_comments: false },
      settings
    );

    if (settings.blk_glass) applyGlass();
    else removeGlass();

    delayedRecommendations(settings);
  }

  function init() {
    removeFeedNudges();
    // ISSUE 4 FIX: watch for dynamically added nudge/list elements
    window.__ext.registerObserverCallback(onNudgeMutations);
    chrome.storage.local.get(
      ["blk_glass", "blk_shorts", "blk_recommend", "blk_comments"],
      (d) => applySettings(d)
    );
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "EXT_BLK") return;
    chrome.storage.local.get(
      ["blk_glass", "blk_shorts", "blk_recommend", "blk_comments"],
      (settings) => {
        settings = Object.assign(
          { blk_glass: false, blk_shorts: false, blk_recommend: false, blk_comments: false },
          settings
        );
        settings[msg.feature] = msg.value;

        if (msg.feature === "blk_glass") {
          msg.value ? applyGlass() : removeGlass();
        }

        delayedRecommendations(settings);
      }
    );
  });

  return { init };
})();

// ─────────────────────────────────────────────────────
// MODULE C — VIDEO CARD CUSTOMIZER
// ─────────────────────────────────────────────────────
window.__ext.videoCard = (() => {
  const CARD_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    ".ytLockupViewModelHost",
  ].join(", ");

  let state = {
    vc_theme:       "custom",
    vc_translucent: false,
    vc_borderColor: "transparent",
    vc_glassColor:  "rgba(0,0,0,0)",
    vc_fontColor:   "inherit",
  };

  function applyAll() {
    const r = document.documentElement;
    r.style.setProperty("--yt-border-color", state.vc_borderColor);
    r.style.setProperty("--yt-glass-color",  state.vc_glassColor);
    r.style.setProperty("--yt-font-color",   state.vc_fontColor);

    if (state.vc_theme && state.vc_theme !== "custom") {
      document.body.setAttribute("data-yt-theme", state.vc_theme);
    } else {
      document.body.removeAttribute("data-yt-theme");
    }

    if (state.vc_translucent) {
      document.body.setAttribute("data-yt-translucent", "");
    } else {
      document.body.removeAttribute("data-yt-translucent");
    }
  }

  function stampCard(el) {
    el.setAttribute("data-yt-card-style", "active");
  }

  function stampAll() {
    document.querySelectorAll(CARD_SELECTORS).forEach(stampCard);
  }

  // Called by master observer
  function onMutations(mutations) {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches && node.matches(CARD_SELECTORS)) { stampCard(node); continue; }
        if (node.querySelectorAll) node.querySelectorAll(CARD_SELECTORS).forEach(stampCard);
      }
    }
  }

  function restore() {
    chrome.storage.local.get(
      ["vc_theme", "vc_translucent", "vc_borderColor", "vc_glassColor", "vc_fontColor"],
      (d) => {
        if (d.vc_theme       !== undefined) state.vc_theme       = d.vc_theme;
        if (d.vc_translucent !== undefined) state.vc_translucent = d.vc_translucent;
        if (d.vc_borderColor)               state.vc_borderColor = d.vc_borderColor;
        if (d.vc_glassColor)                state.vc_glassColor  = d.vc_glassColor;
        if (d.vc_fontColor)                 state.vc_fontColor   = d.vc_fontColor;
        applyAll();
        stampAll();
      }
    );
  }

  function init() {
    window.__ext.registerObserverCallback(onMutations);

    if (!window.__ext._vcNavigateBound) {
      window.__ext._vcNavigateBound = true;
      document.addEventListener("yt-navigate-finish", () => { applyAll(); stampAll(); });
    }

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type !== "YT_THEME_UPDATE") return;
      if (msg.vc_theme       !== undefined) state.vc_theme       = msg.vc_theme;
      if (msg.vc_translucent !== undefined) state.vc_translucent = msg.vc_translucent;
      if (msg.vc_borderColor !== undefined) state.vc_borderColor = msg.vc_borderColor;
      if (msg.vc_glassColor  !== undefined) state.vc_glassColor  = msg.vc_glassColor;
      if (msg.vc_fontColor   !== undefined) state.vc_fontColor   = msg.vc_fontColor;
      applyAll();
      stampAll();
    });

    restore();
  }

  return { init };
})();

// ─────────────────────────────────────────────────────
// MODULE D — WALLPAPER ENGINE
// ─────────────────────────────────────────────────────
window.__ext.wallpaper = (() => {
  let currentBg  = null;
  let currentUrl = null;

  const TRANS_STYLE_ID = "ext-wp-trans-style";
  const BG_ID          = "yt-wallpaper-engine-bg";

  function enforceTransparency() {
    if (document.getElementById(TRANS_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = TRANS_STYLE_ID;
    style.textContent = `
      html, body, ytd-app, #container, #content, ytd-page-manager,
      ytd-watch-flexy, ytd-browse, #primary, #secondary {
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyWallpaper(url) {
    currentUrl = url;

    const existing = document.getElementById(BG_ID);
    if (existing) existing.remove();
    if (currentBg) currentBg.remove();

    const bg = document.createElement("div");
    bg.id = BG_ID;

    Object.assign(bg.style, {
      position:           "fixed",
      top:                "50%",
      left:               "50%",
      zIndex:             "-999999",
      pointerEvents:      "none",
      backgroundImage:    `url(${url})`,
      backgroundSize:     "cover",
      backgroundPosition: "center",
      backgroundRepeat:   "no-repeat",
      transform:          "translate(-50%,-50%)",
    });

    document.documentElement.appendChild(bg);

    const img = new Image();
    img.onload = () => {
      const isPortrait = img.height > img.width;
      if (isPortrait) {
        bg.style.width     = "100vh";
        bg.style.height    = "100vw";
        bg.style.transform = "translate(-50%,-50%) rotate(-90deg)";
      } else {
        bg.style.width     = "100vw";
        bg.style.height    = "100vh";
        bg.style.transform = "translate(-50%,-50%)";
      }
    };
    img.src = url;

    currentBg = bg;
    enforceTransparency();
  }

  function removeWallpaper() {
    currentUrl = null;
    currentBg = null;
    const existing = document.getElementById(BG_ID);
    if (existing) existing.remove();
    document.getElementById(TRANS_STYLE_ID)?.remove();
  }

  // Called by master observer — re-apply if wallpaper div was removed
  function onMutations() {
    if (currentUrl && !document.getElementById(BG_ID)) {
      applyWallpaper(currentUrl);
    }
  }

  function loadWallpaper() {
    chrome.storage.local.get(["wallpapers", "currentIndex"], (data) => {
      const w = data.wallpapers || [];
      if (!w.length) return;
      applyWallpaper(w[data.currentIndex || 0].url);
    });
  }

  function init() {
    window.__ext.registerObserverCallback(onMutations);

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "update") loadWallpaper();
      if (msg.action === "remove") removeWallpaper();
    });

    loadWallpaper();
  }

  return { init, loadWallpaper, removeWallpaper };
})();

// ─────────────────────────────────────────────────────
// MODULE E — GEMINI AUTO-PROMPT
// ─────────────────────────────────────────────────────
window.__ext.gemini = (() => {
  const CONFIG = {
    geminiInitialDelay:   1800,
    geminiPanelDelay:     1000,
    geminiResponseTimeout: 18000,
  };

  const _seenVideos = new Set();
  let _running      = false;

  // Inject Gemini panel style (original)
  function injectStyle() {
    if (document.getElementById("ext-gc-style")) return;
    const style = document.createElement("style");
    style.id = "ext-gc-style";
    style.textContent = `
      yt-section-list-renderer[data-target-id="youchat_section_list"] {
        background: linear-gradient(135deg, black, red) !important;
      }
      markdown-div.ytwMarkdownDivHost {
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForElement(selectorFn, maxAttempts = 100, interval = 100) {
    for (let i = 0; i < maxAttempts; i++) {
      const element = selectorFn();
      if (element) return element;
      await sleep(interval);
    }
    return null;
  }

function getCustomPrompt() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["gc_prompt"], (d) => {
      resolve(
        d.gc_prompt ||
        `Give only:\nVERDICT: [WATCH / SKIP]\nTYPE: [VALUE / NOISE / MANIPULATION]\nREASON: (max 10 words)\nIf unsure → SKIP.`
      );
    });
  });
}

  async function openGeminiPanel() {
    const btn = await waitForElement(() => {
      return (
        document.querySelector('button[aria-label*="Ask"]') ||
        document.querySelector('button[aria-label*="Gemini"]') ||
        [...document.querySelectorAll("button")].find(b => {
          const text = (b.innerText || b.getAttribute("aria-label") || "").toLowerCase();
          return text.includes("ask gemini") || text.includes("gemini") || text.includes("ask ai");
        })
      );
    }, 90, 150);

    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(500);
      btn.click();
      return true;
    }
    return false;
  }

  function pauseVideo() {
    const video = document.querySelector("video");
    if (video && !video.paused) video.pause();
  }

  function playVideo() {
    const video = document.querySelector("video");
    if (video && video.paused) video.play().catch(() => {});
  }

  async function waitForResponseComplete() {
    const maxIter = Math.ceil(CONFIG.geminiResponseTimeout / 250);
    let previousLength = 0;
    let stableCount    = 0;

    for (let i = 0; i < maxIter; i++) {
      await sleep(250);
      const container =
        document.querySelector("yt-gemini-chat") ||
        document.querySelector("ytd-gemini-chat") ||
        document.querySelector('[role="textbox"]')?.closest("yt-gemini-chat, ytd-gemini-chat");

      if (container) {
        const len = (container.innerText || container.textContent || "").trim().length;
        if (len > 80 && len === previousLength) {
          if (++stableCount >= 7) { playVideo(); return; }
        } else {
          stableCount = 0;
        }
        previousLength = len;
      }
    }
    playVideo();
  }

  async function sendPrompt(promptText) {
    const inputArea = await waitForElement(() => {
      return (
        document.querySelector("textarea") ||
        document.querySelector('[role="textbox"]') ||
        document.querySelector('[contenteditable="true"]')
      );
    }, 80, 120);

    if (!inputArea) return;

    inputArea.focus();
    await sleep(300);

    if (inputArea.tagName === "TEXTAREA") {
      inputArea.value = "";
      for (let char of promptText) {
        inputArea.value += char;
        inputArea.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(7);
      }
    } else {
      inputArea.innerText = promptText;
      inputArea.dispatchEvent(new Event("input",  { bubbles: true }));
      inputArea.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await sleep(900);

    let sendBtn = [...document.querySelectorAll("button")].find(b => {
      const label = (b.getAttribute("aria-label") || "").toLowerCase();
      return !b.disabled && (label.includes("send") || label.includes("submit"));
    });

    if (!sendBtn) {
      sendBtn = [...document.querySelectorAll("button")].find(b =>
        !b.disabled && b.querySelector("svg") &&
        (b.innerHTML.toLowerCase().includes("send") ||
         b.getAttribute("aria-label")?.toLowerCase().includes("send"))
      );
    }

    if (!sendBtn) {
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true,
      });
      inputArea.dispatchEvent(enterEvent);
      await sleep(300);
      inputArea.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      await sleep(800);
      pauseVideo();
      setTimeout(waitForResponseComplete, 1500);
      return;
    }

    sendBtn.click();
    await sleep(800);
    pauseVideo();
    setTimeout(waitForResponseComplete, 1500);
  }

  async function run() {
    const enabled = await new Promise(res => {
      chrome.storage.local.get(["gc_enabled"], d => res(d.gc_enabled !== false));
    });
    if (!enabled) return;

    if (location.pathname !== "/watch") return;

    const videoId = new URLSearchParams(location.search).get("v");
    if (!videoId || _seenVideos.has(videoId) || _running) return;

    _seenVideos.add(videoId);
    _running = true;

    try {
      await sleep(CONFIG.geminiInitialDelay);
      const opened = await openGeminiPanel();
      if (!opened) return;

      await sleep(CONFIG.geminiPanelDelay);
      const prompt = await getCustomPrompt();
await sendPrompt(prompt);
    } catch (e) {
      console.error("[Gemini Auto] Error:", e);
    } finally {
      _running = false;
    }
  }

  function init() {
    injectStyle();

    if (!window.__ext._gcNavigateBound) {
      window.__ext._gcNavigateBound = true;
      document.addEventListener("yt-navigate-finish", () => {
        setTimeout(() => run(), 150);
      });
    }

    setTimeout(() => run(), 2500);
  }

  return { init };
})();


// ─────────────────────────────────────────────────────
// MODULE F — SEARCH DASHBOARD GRID
// Source: ytdash_firefox_extension_fixed/content.js
// Changes from original:
//   - browser.* → chrome.*
//   - Full enable/disable toggle support via EXT_DASH message
//   - suppressStyle and canvas are properly removed on disable
//   - interval and URL-poll are cleared on disable
//   - YouTube page-manager opacity/pointer-events fully restored on disable
// ─────────────────────────────────────────────────────

(async () => {
  if (window.__YTDASH_EXT__) return;
  window.__YTDASH_EXT__ = true;

  const DEFAULTS = {
    enabled: true,
    layout: 'horizontal',
    fetchSpeed: 2000
  };

  const settings = await new Promise(resolve => {
    // FIX: read dash_enabled (popup saves to dash_enabled) in addition to
    // the legacy 'enabled' key so the popup toggle actually takes effect.
    chrome.storage.local.get(
      { ...DEFAULTS, dash_enabled: null, dash_fetchSpeed: null },
      items => {
        // dash_enabled overrides enabled when explicitly set
        if (items.dash_enabled !== null) items.enabled = items.dash_enabled;
        if (items.dash_fetchSpeed !== null) items.fetchSpeed = items.dash_fetchSpeed;
        resolve(items);
      }
    );
  });

  const MAX_VIDEOS   = 300;
  const MAX_DOM_CARDS = 300;

  let SESSION      = 'sess_' + Date.now();
  let seen         = new Set();
  let channelMap   = new Map();
  let renderedCards = [];
  let dashEnabled  = !!settings.enabled;

  // ── FILTER STATE ──
  let filterMode     = 'both';
  let whitelistChans = [];
  let blockedWords   = [];

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

  function loadFilterSettings() {
    chrome.storage.local.get(
      ['filterMode', 'whitelistChans', 'blockedWords'],
      d => {
        filterMode     = d.filterMode     || 'both';
        whitelistChans = d.whitelistChans  || DEFAULT_CHANNELS.slice();
        blockedWords   = d.blockedWords    || DEFAULT_BLOCKED.slice();
      }
    );
  }
  loadFilterSettings();

  function shouldShow(channel, title) {
    if (filterMode === 'off') return true;
    const ch  = (channel || '').toLowerCase();
    const ttl = (title   || '').toLowerCase();
    const inWhitelist  = whitelistChans.some(w => ch.includes(w) || w.includes(ch));
    const titleBlocked = blockedWords.some(w => ttl.includes(w));
    if (filterMode === 'whitelist') return inWhitelist;
    if (filterMode === 'keywords')  return !titleBlocked;
    return inWhitelist && !titleBlocked;
  }

  // ── DOM ELEMENTS created once, shown/hidden by toggle ──

  // FIX: keep a reference to suppressStyle so we can remove it on disable
  const suppressStyle = document.createElement('style');
  suppressStyle.id = 'yt-dash-suppress-style';
  suppressStyle.textContent = `
    ytd-page-manager,
    #page-manager {
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  const canvas = document.createElement('div');
  canvas.id = 'yt-dash-canvas';
  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '56px',
    left:          '150px',
    right:         '0',
    bottom:        '0',
    zIndex:        '999',
    overflowY:     'auto',
    padding:       '20px',
    boxSizing:     'border-box',
    background:    'transparent',
    display:       'flex',
    flexDirection: 'column',
    gap:           '24px'
  });

  const header = document.createElement('div');
  header.textContent = 'YT Dash Dashboard';
  Object.assign(header.style, {
    background:  '#fff',
    width:       'fit-content',
    padding:     '10px 18px',
    borderRadius:'999px',
    fontWeight:  '700',
    fontSize:    '18px',
    boxShadow:   '0 2px 10px rgba(0,0,0,0.08)'
  });
  canvas.appendChild(header);

  const feed = document.createElement('div');
  Object.assign(feed.style, {
    display:       'flex',
    flexDirection: 'column',
    gap:           '32px'
  });
  canvas.appendChild(feed);

  const scrollStyle = document.createElement('style');
  scrollStyle.id = 'yt-dash-scroll-style';
  scrollStyle.textContent = `
    #yt-dash-canvas .yt-row-scroll::-webkit-scrollbar {
      height: 18px;
    }
    #yt-dash-canvas .yt-row-scroll::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.85);
      border-radius: 999px;
    }
    #yt-dash-canvas .yt-row-scroll::-webkit-scrollbar-thumb {
      background: rgba(80,80,80,0.85);
      border-radius: 999px;
      border: 3px solid rgba(255,255,255,0.85);
    }
  `;

  // ── ENABLE / DISABLE helpers ──

  // FIX: enableDash and disableDash fully control all injected DOM and styles.
  function isSearchPage() {
  return location.pathname === '/results' &&
         location.search.length > 0;
}

  function enableDash() {
    if (!isSearchPage()) return;
    dashEnabled = true;
    if (!document.getElementById('yt-dash-suppress-style')) {
      document.head.appendChild(suppressStyle);
    }
    if (!document.getElementById('yt-dash-scroll-style')) {
      document.head.appendChild(scrollStyle);
    }
    if (!document.getElementById('yt-dash-canvas')) {
      document.body.appendChild(canvas);
    }
  }

  function disableDash() {
    dashEnabled = false;

    // 1. Remove the overlay canvas entirely
    document.getElementById('yt-dash-canvas')?.remove();

    // 2. Remove the style that hides the real YouTube page
    document.getElementById('yt-dash-suppress-style')?.remove();

    // 3. Remove scrollbar styles
    document.getElementById('yt-dash-scroll-style')?.remove();

    // 4. Explicitly restore YouTube page-manager visibility in case the
    //    style element was already detached but the rule is still cached
    //    by some browsers — belt-and-suspenders reset via inline style
    const pm = document.querySelector('ytd-page-manager, #page-manager');
    if (pm) {
      pm.style.removeProperty('opacity');
      pm.style.removeProperty('pointer-events');
    }

    // 5. Reset dashboard state so a future re-enable starts clean
    seen.clear();
    channelMap.clear();
    renderedCards = [];
    SESSION = 'sess_' + Date.now();
  }

  // ── INTERVAL / URL POLL handles ──
  // FIX: store interval IDs so they can be cleared when disabled
  let scanInterval   = null;
  let urlPollInterval = null;

  function startIntervals() {
    if (scanInterval) return; // already running

    scanInterval = setInterval(() => {
      if (!dashEnabled) return;
      if (seen.size >= MAX_VIDEOS) {
        clearInterval(scanInterval);
        scanInterval = null;
        return;
      }
      scan();
      scrollYTPageDown();
    }, Number(settings.fetchSpeed) || 2000);

    let prevUrl = location.href;
    urlPollInterval = setInterval(() => {
      if (!dashEnabled) return;
      if (location.href !== prevUrl) {
        prevUrl = location.href;
        handleNavigation();
      }
    }, 120);
  }

  function stopIntervals() {
    if (scanInterval)    { clearInterval(scanInterval);    scanInterval    = null; }
    if (urlPollInterval) { clearInterval(urlPollInterval); urlPollInterval = null; }
  }

  // ── RENDERING helpers (unchanged logic) ──

  function restoreImg(img) {
    const lazySrc = img.getAttribute('data-thumb') || img.getAttribute('data-src');
    if (!img.src && lazySrc) img.src = lazySrc;
  }

  function createRow() {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display:       'flex',
      gap:           '30px',
      overflowX:     'auto',
      overflowY:     'hidden',
      padding:       '4px 4px 10px 4px',
      scrollbarWidth:'thick',
      scrollbarColor:'#888 #e5e5e5'
    });
    row.classList.add('yt-row-scroll');
    row.addEventListener('wheel', e => {
      if (e.shiftKey) {
        e.preventDefault();
        row.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    return row;
  }

  function moveRenderer(renderer) {
    if (!renderer) return;
    if (renderer.__dashSession === SESSION) return;

    const link = renderer.querySelector('a#video-title[href*="watch"]');
    if (!link?.href) return;
    if (seen.has(link.href)) return;

    seen.add(link.href);
    renderer.__dashSession = SESSION;

    const channel = renderer.querySelector('#channel-name a')?.innerText?.trim() || 'Unknown';
    const titleEl = renderer.querySelector('#video-title, #video-title-link');
    const title   = titleEl?.innerText?.trim() || titleEl?.getAttribute('title') || '';

    if (!shouldShow(channel, title)) {
      renderer.style.display = 'none';
      return;
    }

    if (!channelMap.has(channel)) {
      const section  = document.createElement('div');
      const label    = document.createElement('div');
      label.textContent = channel;
      Object.assign(label.style, {
        background:   '#fff',
        width:        'fit-content',
        padding:      '8px 14px',
        borderRadius: '999px',
        fontWeight:   '700',
        fontSize:     '18px',
        marginBottom: '12px',
        boxShadow:    '0 2px 10px rgba(0,0,0,0.08)'
      });
      const rowsWrap = document.createElement('div');
      Object.assign(rowsWrap.style, { display: 'flex', flexDirection: 'column', gap: '18px' });
      section.appendChild(label);
      section.appendChild(rowsWrap);
      feed.appendChild(section);
      channelMap.set(channel, { rowsWrap, rows: [] });
    }

    const data = channelMap.get(channel);
    let row = data.rows[data.rows.length - 1];
    if (!row || row.childElementCount >= 6) {
      row = createRow();
      data.rowsWrap.appendChild(row);
      data.rows.push(row);
    }

    const wrapper = document.createElement('div');
    const isHoriz = settings.layout === 'horizontal';
    Object.assign(wrapper.style, {
      width:    isHoriz ? '720px' : '100%',
      minWidth: isHoriz ? '720px' : '100%',
      flexShrink: '0'
    });

    if (!isHoriz) {
      row.style.flexDirection = 'column';
      row.style.overflowX = 'hidden';
    }

    const thumb = renderer.querySelector('ytd-thumbnail');
    if (thumb && isHoriz) {
      thumb.style.width    = '420px';
      thumb.style.minWidth = '420px';
      thumb.style.maxWidth = '420px';
      thumb.style.marginRight = '16px';
    }

    renderer.querySelectorAll('img').forEach(restoreImg);
    wrapper.appendChild(renderer);
    row.appendChild(wrapper);

    renderedCards.push(wrapper);
    if (renderedCards.length > MAX_DOM_CARDS) {
      const old = renderedCards.shift();
      if (old?.parentNode) old.remove();
    }
    if (renderedCards.length % 25 === 0) {
      requestIdleCallback?.(() => { try { window.gc?.(); } catch (_) {} });
    }
  }

  function scan() {
    if (!dashEnabled) return;
    const contents = document.querySelector('ytd-search #contents');
    if (!contents) return;
    contents.querySelectorAll('ytd-video-renderer').forEach(moveRenderer);
  }

  function scrollYTPageDown() {
    if (dashEnabled) window.scrollBy(0, 1800);
  }

  function resetDashboard() {
    seen.clear();
    channelMap.clear();
    feed.replaceChildren();
  }

  function handleNavigation() {
  if (!isSearchPage()) {
    disableDash();
    stopIntervals();
    return;
  }

  if (!dashEnabled) {
    enableDash();
    startIntervals();
  }

  resetDashboard();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => scan())
  );
}

  document.addEventListener('yt-navigate-finish', handleNavigation);

  // ── EXT_DASH message handler (FIX: was completely missing in original) ──
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === 'EXT_FILTER') {
      if (msg.filterMode     !== undefined) filterMode     = msg.filterMode;
      if (msg.whitelistChans !== undefined) whitelistChans = msg.whitelistChans;
      if (msg.blockedWords   !== undefined) blockedWords   = msg.blockedWords;
      return;
    }

    if (msg.type === 'EXT_DASH') {
      if (msg.enabled !== undefined) {
        if (msg.enabled) {
          enableDash();
          startIntervals();
          scan();
          window.location.reload();
        } else {
          disableDash();
          stopIntervals();
          window.location.reload();
        }
      }
      if (msg.fetchSpeed !== undefined) {
        settings.fetchSpeed = msg.fetchSpeed;
        // Restart intervals with new speed
        stopIntervals();
        if (dashEnabled) startIntervals();
      }
    }
  });

  // ── BOOT ──
  if (dashEnabled && isSearchPage()) {
    enableDash();
    startIntervals();
    scan();
  }
})();

// ─────────────────────────────────────────────────────
// MODULE G — POKÉMON PLAYER EFFECTS
// Charizard buffering loader + Bulbasaur scrubber companion
// ─────────────────────────────────────────────────────
window.__ext.pokemonPlayer = (() => {
  const STYLE_ID = "ext-pokemon-player-style";
  const WRAP_ID = "ext-pokemon-buffer-loader";
  const SPRITE_ID = "ext-pokemon-scrubber-sprite";
  const HIDE_CLASS = "ext-pokemon-loader-installed";
  const CHARIZARD_URL = "https://img.pokemondb.net/sprites/black-white/anim/normal/charizard.gif";
  const BULBASAUR_URL = "https://img.pokemondb.net/sprites/scarlet-violet/normal/bulbasaur.png";

  let style = null;
  let activePlayer = null;
  let activeVideo = null;
  let loaderObserver = null;
  let loaderVisible = false;
  let initialized = false;
  let charizardReady = null;

  const videoEvents = ["waiting", "playing", "canplay", "seeking", "seeked", "pause", "ended"];

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      style = document.getElementById(STYLE_ID);
      return;
    }

    style = document.createElement("style");
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

      .ytp-scrubber-button {
        background: transparent !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      #${SPRITE_ID} {
        position: absolute;
        width: 70px;
        height: 70px;
        object-fit: contain;
        left: 50%;
        top: -150%;
        transform: translate(-50%, -50%) scaleX(-1);
        pointer-events: none;
        z-index: 10;
        filter: drop-shadow(0 2px 3px #0008);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCharizardLoaded() {
    if (!charizardReady) {
      charizardReady = new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = CHARIZARD_URL;
        if (image.complete && image.naturalWidth > 0) resolve(true);
      });
    }
    return charizardReady;
  }

  function showLoader() {
    if (!activePlayer) return;
    const wrapper = activePlayer.querySelector(`#${WRAP_ID}`);
    if (!wrapper || loaderVisible) return;
    loaderVisible = true;
    wrapper.style.display = "flex";
  }

  function hideLoader() {
    if (!activePlayer) return;
    const wrapper = activePlayer.querySelector(`#${WRAP_ID}`);
    if (wrapper) wrapper.style.display = "none";
    loaderVisible = false;
  }

  function checkBuffering() {
    if (!activePlayer || !activePlayer.isConnected) return;
    const video = activePlayer.querySelector("video");
    if (!video) {
      hideLoader();
      return;
    }

    const buffering = !video.paused && !video.ended &&
      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    if (buffering) showLoader();
    else hideLoader();
  }

  function detachVideoEvents() {
    if (!activeVideo) return;
    videoEvents.forEach((event) => activeVideo.removeEventListener(event, checkBuffering));
    activeVideo = null;
  }

  function cleanupLoader() {
    detachVideoEvents();
    loaderObserver?.disconnect();
    loaderObserver = null;
    if (activePlayer) {
      activePlayer.querySelector(`#${WRAP_ID}`)?.remove();
      activePlayer.classList.remove(HIDE_CLASS);
    }
    activePlayer = null;
    loaderVisible = false;
  }

  async function installLoader() {
    const player = document.querySelector(".html5-video-player");
    if (!player) {
      cleanupLoader();
      return;
    }
    if (player === activePlayer && player.querySelector(`#${WRAP_ID}`)) {
      const video = player.querySelector("video");
      if (video !== activeVideo) {
        detachVideoEvents();
        activeVideo = video;
        videoEvents.forEach((event) => activeVideo?.addEventListener(event, checkBuffering));
      }
      checkBuffering();
      return;
    }

    cleanupLoader();
    const ready = await ensureCharizardLoaded();
    if (!ready || !player.isConnected || document.querySelector(".html5-video-player") !== player) return;

    ensureStyle();
    activePlayer = player;
    activeVideo = player.querySelector("video");
    player.classList.add(HIDE_CLASS);

    const wrapper = document.createElement("div");
    wrapper.id = WRAP_ID;
    const image = document.createElement("img");
    image.src = CHARIZARD_URL;
    image.alt = "Charizard";
    image.draggable = false;
    wrapper.appendChild(image);
    player.appendChild(wrapper);

    videoEvents.forEach((event) => activeVideo?.addEventListener(event, checkBuffering));

    loaderObserver = new MutationObserver(() => {
      if (activePlayer?.isConnected && !activePlayer.classList.contains(HIDE_CLASS)) {
        activePlayer.classList.add(HIDE_CLASS);
      }
      checkBuffering();
    });
    loaderObserver.observe(player, {
      attributes: true,
      attributeFilter: ["class"],
    });
    checkBuffering();
  }

  function installScrubber() {
    const scrubber = document.querySelector(".ytp-scrubber-button");
    if (!scrubber) return;
    ensureStyle();
    const existing = document.getElementById(SPRITE_ID);
    if (existing && existing.parentElement === scrubber) return;
    existing?.remove();

    const sprite = document.createElement("img");
    sprite.id = SPRITE_ID;
    sprite.src = BULBASAUR_URL;
    sprite.alt = "Bulbasaur";
    sprite.draggable = false;
    scrubber.appendChild(sprite);
  }

  function onMutations() {
    installScrubber();
    const player = document.querySelector(".html5-video-player");
    if (player !== activePlayer) installLoader();
    else if (player && !player.querySelector(`#${WRAP_ID}`)) installLoader();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    window.__ext.registerObserverCallback(onMutations);
    document.addEventListener("yt-navigate-finish", onNavigate);
    installScrubber();
    installLoader();
  }

  function onNavigate() {
    cleanupLoader();
    document.getElementById(SPRITE_ID)?.remove();
    installScrubber();
    installLoader();
  }

  function cleanup() {
    cleanupLoader();
    document.removeEventListener("yt-navigate-finish", onNavigate);
    document.getElementById(SPRITE_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    initialized = false;
  }

  return { init, cleanup };
})();

// ─────────────────────────────────────────────────────
// BOOTSTRAP — init all modules (ZIP1 originals)
// ─────────────────────────────────────────────────────
(function bootstrap() {
  window.__ext.blocks.init();
  window.__ext.videoCard.init();
  window.__ext.wallpaper.init();
  window.__ext.gemini.init();
  window.__ext.antiClickbait.init();
  window.__ext.pokemonPlayer.init();
  // Module F (dashboard) self-initializes above via async IIFE
})();
