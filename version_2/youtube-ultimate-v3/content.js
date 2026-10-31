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
// BOOTSTRAP — init all modules
// ─────────────────────────────────────────────────────
(function bootstrap() {
  window.__ext.blocks.init();
  window.__ext.videoCard.init();
  window.__ext.wallpaper.init();
  window.__ext.gemini.init();
  window.__ext.antiClickbait.init();
})();
