/**
 * YouTube Unified — content.js
 *
 * Architecture
 * ───────────────────────────────────────────────────────────────────────────
 *  • All visual decisions come from CONFIG (config.js) — no magic literals.
 *  • Modules are pure IIFE objects; they share nothing except CONFIG.
 *  • ONE MutationObserver shared across all modules (no per-module observers).
 *  • ONE yt-navigate-finish listener drives all SPA re-runs.
 *  • CSS does all hover animation; JS only stamps data-attributes onto cards.
 *
 * Module index
 * ────────────────────────────────────────────────────────────────────────────
 *  backgroundModule  — injects body::before background + glass header flag
 *  bootscreenModule  — one-shot intro video overlay
 *  elementKiller     — removes grid-shelf-view-model nodes
 *  glassUI           — stamps data-yt-card-style onto video cards
 *  geminiModule      — opens Gemini panel, sends prompt, manages video pause
 *  shortsBlocker     — removes/hides Shorts nodes imperatively
 *  stateManager      — applies popup state changes in real-time
 */

"use strict";

/* ==========================================================================
   DYNAMIC IMPORT — CONFIG
   content_scripts do not support ES module syntax natively in all browsers,
   so we use a self-executing async wrapper to import config.js at runtime.
   ========================================================================== */

(async () => {
  /** @type {import('./config.js').CONFIG} */
  let CONFIG;

  try {
    const mod = await import(browser.runtime.getURL("config.js"));
    CONFIG = mod.CONFIG;
  } catch (e) {
    console.error("[YT-Unified] ❌ Failed to load config.js — using defaults.", e);
    CONFIG = {
      background: null,
      backgroundBrightness: 0.7,
      backgroundSaturate: 1.1,
      bootscreen: null,
      bootscreenTimeout: 8_000,
      cardStyle: "glass",
      enableGemini: true,
      enableElementKiller: true,
      enableGlassHeader: true,
      geminiInitialDelay: 2200,
      geminiPanelDelay: 1900,
      geminiResponseTimeout: 40_000,
    };
  }

  /* =========================================================================
     UTILITY
     ======================================================================= */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Polls selectorFn() until it returns a visible element or times out.
   * @param {() => Element|null} selectorFn
   * @param {number} maxTries
   * @param {number} intervalMs
   * @returns {Promise<Element|null>}
   */
  async function waitForElement(selectorFn, maxTries = 80, intervalMs = 180) {
    for (let i = 0; i < maxTries; i++) {
      const el = selectorFn();
      if (el && (el.offsetParent !== null || getComputedStyle(el).display !== "none")) {
        return el;
      }
      await sleep(intervalMs);
    }
    return null;
  }

  /* =========================================================================
     MODULE: BACKGROUND
     Injects the body::before background image via an inline <style> tag so
     the image URL and filter values from CONFIG are applied at runtime without
     touching the bundled CSS files.
     Also stamps data-yt-glass-header on <body> to activate the glass masthead
     CSS rules in video-card.css.
     ======================================================================= */

  const backgroundModule = (() => {
    const STYLE_ID = "yt-unified-bg";

    /**
     * Builds the CSS text for body::before based on CONFIG values.
     * Supports both local asset paths and full https:// URLs.
     */
    function buildBackgroundCSS() {
      if (!CONFIG.background) return "";

      // Only full https:// URLs are supported; local asset paths are no longer
      // used (assets/ folder removed — backgrounds are theme-provided).
      if (!CONFIG.background.startsWith("http")) return "";

      const url = CONFIG.background;

      return `
        body::before {
          background-image: url("${url}");
          filter: brightness(${CONFIG.backgroundBrightness}) saturate(${CONFIG.backgroundSaturate});
        }
      `;
    }

    /** Injects or updates the dynamic background <style> tag. */
    function apply() {
      let tag = document.getElementById(STYLE_ID);
      if (!tag) {
        tag = document.createElement("style");
        tag.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(tag);
      }
      tag.textContent = buildBackgroundCSS();

      // Glass header — stamp attribute on body, CSS rules activate it.
      if (CONFIG.enableGlassHeader) {
        document.body?.setAttribute("data-yt-glass-header", "");
      }
    }

    return { apply };
  })();

  /* =========================================================================
     MODULE: ELEMENT KILLER
     Removes grid-shelf-view-model nodes. CSS failsafe is in base.css.
     ======================================================================= */
  const elementKiller = (() => {
    const TARGET_TAG      = "grid-shelf-view-model";
    const TARGET_SELECTOR = "#dismissible.style-scope.ytd-feed-nudge-renderer";

    function removeTargets(root) {
      root.querySelectorAll(TARGET_TAG).forEach((el) => el.remove());
      root.querySelectorAll(TARGET_SELECTOR).forEach((el) => el.remove());
    }

    function handleMutations(mutations) {
      if (!CONFIG.enableElementKiller) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName?.toLowerCase() === TARGET_TAG) {
            node.remove();
          } else if (node.matches?.(TARGET_SELECTOR)) {
            node.remove();
          } else if (typeof node.querySelectorAll === "function") {
            removeTargets(node);
          }
        }
      }
    }

    function run() {
      if (!CONFIG.enableElementKiller) return;
      removeTargets(document);
    }

    return { run, handleMutations };
  })();
  /* =========================================================================
     MODULE: GLASS UI
     Stamps data-yt-card-style on video cards so CSS packs in video-card.css
     can target them. No inline style manipulation — CSS does all visuals.
     Supports all card styles defined in CONFIG.cardStyle.
     ======================================================================= */

  const glassUI = (() => {
    const CARD_SELECTOR = "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer, ytd-rich-grid-media,.ytLockupViewModelHost";
    const APPLIED_ATTR = "data-yt-unified-glass";

    /** Names of valid card style packs (must match CSS class names). */
    const VALID_STYLES = new Set(["glass", "cyber", "minimal", "none"]);

    function applyToCard(card) {
      if (card.hasAttribute(APPLIED_ATTR)) return;
      if (CONFIG.cardStyle === "none") return;

      const style = VALID_STYLES.has(CONFIG.cardStyle) ? CONFIG.cardStyle : "glass";
      card.setAttribute(APPLIED_ATTR, "true");
      card.dataset.ytCardStyle = style;
    }

    function applyToRoot(root) {
      root.querySelectorAll(CARD_SELECTOR).forEach(applyToCard);
    }

    function handleMutations(mutations) {
      if (CONFIG.cardStyle === "none") return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.(CARD_SELECTOR)) applyToCard(node);
          if (typeof node.querySelectorAll === "function") applyToRoot(node);
        }
      }
    }

    function run() {
      if (CONFIG.cardStyle === "none") return;
      applyToRoot(document);
    }

    return { run, handleMutations };
  })();

  /* =========================================================================
     MODULE: GEMINI AUTO-PROMPT
     Opens the Gemini side panel, sends a prompt from prompt.txt, pauses the
     video while waiting, then resumes once the response stabilises.
     ======================================================================= */

  const geminiModule = (() => {
    const _seenVideos = new Set();
    let _running = false;

    async function getCustomPrompt() {
      const text = "Give only:\nVERDICT: [WATCH / SKIP]\nTYPE: [VALUE / NOISE / MANIPULATION]\nREASON: (max 10 words)\nIf unsure → SKIP.";
      return text;
    }

    async function openGeminiPanel() {
      const btn = await waitForElement(() => {
        return (
          document.querySelector('button[aria-label*="Ask"]') ||
          document.querySelector('button[aria-label*="Gemini"]') ||
          [...document.querySelectorAll("button")].find((b) => {
            const t = (b.innerText || b.getAttribute("aria-label") || "").toLowerCase();
            return t.includes("ask") || t.includes("gemini");
          })
        );
      });

      if (btn) {
        btn.scrollIntoView({ behavior: "instant", block: "center" });
        await sleep(400);
        btn.click();
        return true;
      }
      return false;
    }

    function pauseVideo() {
      const v = document.querySelector("video");
      if (v && !v.paused) v.pause();
    }

    function playVideo() {
      const v = document.querySelector("video");
      if (v && v.paused) v.play().catch(() => {});
    }

    async function waitForResponseComplete() {
      const maxIter = Math.ceil(CONFIG.geminiResponseTimeout / 200);
      let previousLength = 0;
      let stableCount = 0;

      for (let i = 0; i < maxIter; i++) {
        await sleep(200);
        const container =
          document.querySelector("yt-gemini-chat") ||
          document.querySelector(".gemini-response") ||
          document.querySelector('[role="textbox"]')?.closest("ytd-gemini-chat");

        if (container) {
          const len = (container.innerText || container.textContent || "").length;
          if (len > 50 && len === previousLength) {
            if (++stableCount >= 8) {
              playVideo();
              return;
            }
          } else {
            stableCount = 0;
          }
          previousLength = len;
        }
      }

      playVideo();
    }

    async function sendPrompt(promptText) {
      const textarea = await waitForElement(() => {
        return (
          document.querySelector("textarea") ||
          [...document.querySelectorAll('[contenteditable="true"], [role="textbox"]')].find(
            (el) => el.closest("ytd-gemini-chat, yt-gemini-chat, .gemini-chat")
          )
        );
      });

      if (!textarea) {
        return;
      }

      textarea.focus();
      if (textarea.tagName === "TEXTAREA") {
        textarea.value = promptText;
      } else {
        textarea.innerText = promptText;
      }

      ["input", "change", "keydown", "keyup", "compositionend"].forEach((ev) => {
        textarea.dispatchEvent(new Event(ev, { bubbles: true }));
      });

      await sleep(950);

      const sendBtn = await waitForElement(
        () => [...document.querySelectorAll("button")].find((b) => {
          const label = (b.getAttribute("aria-label") || b.innerText || "").toLowerCase();
          return (label.includes("send") || label.includes("arrow")) && !b.disabled;
        }),
        60, 120
      );

      if (sendBtn) {
        await sleep(350);
        sendBtn.click();
        await sleep(800);
        pauseVideo();
        setTimeout(waitForResponseComplete, 1500);
      }
    }

    async function run() {
      if (!CONFIG.enableGemini) return;
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

        const prompt =
          (await getCustomPrompt()) ||
          (() => {
            const titleEl =
              document.querySelector("h1.ytd-watch-metadata") ||
              document.querySelector("h1.title");
            const t = titleEl ? titleEl.innerText.trim() : "YouTube Video";
            return t.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
          })();

        await sendPrompt(prompt);
      } catch (e) {
        console.error("[YT-Unified/Gemini] Error:", e);
      } finally {
        _running = false;
      }
    }

    return { run };
  })();

  /* =========================================================================
     CORE: SHARED MUTATION OBSERVER
     One observer for the entire extension lifetime.
     Processes elementKiller first (removes junk) then glassUI (styles cards).
     ======================================================================= */

  const sharedObserver = new MutationObserver((mutations) => {
    elementKiller.handleMutations(mutations);
    glassUI.handleMutations(mutations);
  });

  /* =========================================================================
     CORE: SPA NAVIGATION
     ======================================================================= */

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => {
      elementKiller.run();
      glassUI.run();
      geminiModule.run(); // no-op unless on /watch
    }, 50);
  });

  /* =========================================================================
     CORE: INITIAL BOOT
     ======================================================================= */

  function boot() {
    // Apply background + glass header flag
    backgroundModule.apply();

    // Start observer before sweeps so no mutations are missed mid-run
    sharedObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    elementKiller.run();
    glassUI.run();

    if (location.pathname === "/watch") {
      setTimeout(() => geminiModule.run(), 2800);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  /* =========================================================================
     MODULE: SHORTS BLOCKER
     Stamps body[data-yt-block-shorts] to activate block-shorts.css rules,
     and imperatively removes Shorts nodes that slip through before CSS paint.
     ======================================================================= */

  const shortsBlocker = (() => {
    const BODY_ATTR   = "data-yt-block-shorts";
    const STORAGE_KEY = "ytUnifiedState";

    /** Selector list covering every known Shorts container tag. */
    const SHORTS_SELECTORS = [
      "ytd-reel-shelf-renderer",
      "ytd-reel-item-renderer",
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-rich-shelf-renderer[component-style="RICH_SHELF_STYLE_SHORTS"]',
    ].join(",");

    /** Returns true if a node is or contains Shorts content. */
    function isShortsNode(node) {
      if (node.matches?.(SHORTS_SELECTORS)) return true;
      if (node.querySelector?.(SHORTS_SELECTORS)) return true;
      // Lockup cards whose primary link is a /shorts/ URL
      if (node.querySelector?.('a[href*="/shorts/"]')) return true;
      return false;
    }

    function removeFromRoot(root) {
      root.querySelectorAll(SHORTS_SELECTORS).forEach((el) => el.remove());
      // Also clean rich-item wrappers containing a shorts link
      root.querySelectorAll(
        'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer'
      ).forEach((el) => {
        if (el.querySelector('a[href*="/shorts/"]')) el.remove();
      });
    }

    function enable() {
      document.body?.setAttribute(BODY_ATTR, "");
      removeFromRoot(document);
    }

    function disable() {
      document.body?.removeAttribute(BODY_ATTR);
    }

    function handleMutations(mutations, active) {
      if (!active) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (isShortsNode(node)) {
            node.remove();
          } else if (typeof node.querySelectorAll === "function") {
            removeFromRoot(node);
          }
        }
      }
    }

    async function run() {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const state  = result[STORAGE_KEY] || {};
      if (state.enableBlockShorts) {
        enable();
      } else {
        disable();
      }
    }

    return { run, enable, disable, handleMutations };
  })();

  /* =========================================================================
     MODULE: STATE MANAGER
     Listens for messages from popup.js and applies state changes in real-time.

     Managed state fields:
       cardStyle          → re-stamps data-yt-card-style on all cards
       enableTextColors   → toggles body[data-yt-text-colors]
       enableBlockShorts  → delegates to shortsBlocker
       enableGlassHeader  → toggles body[data-yt-glass-header]
     ======================================================================= */

  const stateManager = (() => {
    const TEXT_ATTR   = "data-yt-text-colors";
    const HEADER_ATTR = "data-yt-glass-header";
    const STORAGE_KEY = "ytUnifiedState";
    const VALID_STYLES = new Set(["glass", "cyber", "minimal", "none"]);

    /**
     * Re-stamp card style attribute on every already-processed card.
     * We clear data-yt-unified-glass so glassUI will re-visit the card.
     */
    function reapplyCardStyle(newStyle) {
      CONFIG.cardStyle = newStyle;
      document.querySelectorAll("[data-yt-unified-glass]").forEach((card) => {
        card.removeAttribute("data-yt-unified-glass");
        card.removeAttribute("data-yt-card-style");
      });
      if (newStyle !== "none") {
        glassUI.run();
      }
    }

    function applyTextColors(enabled) {
      if (enabled) {
        document.body?.setAttribute(TEXT_ATTR, "");
      } else {
        document.body?.removeAttribute(TEXT_ATTR);
      }
    }

    function applyGlassHeader(enabled) {
      if (enabled) {
        document.body?.setAttribute(HEADER_ATTR, "");
      } else {
        document.body?.removeAttribute(HEADER_ATTR);
      }
    }

    /** Apply a full state object immediately. */
    function applyState(state) {
      if (state.cardStyle !== undefined && VALID_STYLES.has(state.cardStyle)) {
        reapplyCardStyle(state.cardStyle);
      }
      if (state.enableTextColors !== undefined) {
        applyTextColors(state.enableTextColors);
      }
      if (state.enableBlockShorts !== undefined) {
        if (state.enableBlockShorts) {
          shortsBlocker.enable();
        } else {
          shortsBlocker.disable();
        }
      }
      if (state.enableGlassHeader !== undefined) {
        applyGlassHeader(state.enableGlassHeader);
      }
    }

    /** Read initial state from storage and apply on boot. */
    async function init() {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const state  = result[STORAGE_KEY];
      if (!state) return; // No stored state; CONFIG.js defaults remain in effect.
      applyState(state);
    }

    /** Wire the runtime message listener for popup live-updates. */
    function listen() {
      browser.runtime.onMessage.addListener((message) => {
        if (message?.type === "YT_UNIFIED_STATE_UPDATE" && message.state) {
          applyState(message.state);
        }
      });
    }

    return { init, listen };
  })();

  /* =========================================================================
     CORE: SHORTS OBSERVER
     Dedicated observer for Shorts removal — kept separate from sharedObserver
     so shorts logic never interferes with elementKiller or glassUI.
     ======================================================================= */

  const shortsObserver = new MutationObserver((mutations) => {
    const active = document.body?.hasAttribute("data-yt-block-shorts");
    shortsBlocker.handleMutations(mutations, active);
  });

  /* =========================================================================
     CORE: SPA NAVIGATION — shorts + v6 attr persistence
     ======================================================================= */

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => {
      shortsBlocker.run();
      // Re-apply text-colors + header attrs that may be cleared by YouTube's SPA
      const hasTextColors  = document.body?.hasAttribute("data-yt-text-colors");
      const hasGlassHeader = document.body?.hasAttribute("data-yt-glass-header");
      // Attrs survive SPA in most cases, but re-read storage to be safe
      browser.storage.local.get("ytUnifiedState").then((result) => {
        const s = result["ytUnifiedState"] || {};
        if (s.enableTextColors  !== undefined && !hasTextColors)  {
          if (s.enableTextColors)  document.body?.setAttribute("data-yt-text-colors", "");
        }
        if (s.enableGlassHeader !== undefined && !hasGlassHeader) {
          if (s.enableGlassHeader) document.body?.setAttribute("data-yt-glass-header", "");
        }
      }).catch(() => {});
    }, 60);
  });

  /* =========================================================================
     CORE: BOOT — shorts blocker + state manager init
     ======================================================================= */

  // Wait for body to exist (document_start fires very early)
  function bootV5() {
    stateManager.listen();    // wire popup message listener first
    stateManager.init();      // read storage, apply persisted state
    shortsBlocker.run();      // apply shorts blocking if enabled

    // Start the dedicated shorts observer
    shortsObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootV5, { once: true });
  } else {
    bootV5();
  }

  /* =========================================================================
     CORE: EXTENDED STATE — comments, description style, recommendations
     Handles state fields for toggles not covered by stateManager above.
     Both message listeners fire independently on the same message — no conflicts.
     ======================================================================= */
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "YT_UNIFIED_STATE_UPDATE") return;
    const state = message.state;
    if (!state) return;

    // Comments toggle
    if (state.enableDisableComments !== undefined) {
      if (state.enableDisableComments) {
        document.body?.setAttribute("data-yt-disable-comments", "");
      } else {
        document.body?.removeAttribute("data-yt-disable-comments");
      }
    }

    // Description style toggle
    if (state.enableDescriptionStyle !== undefined) {
      if (state.enableDescriptionStyle) {
        document.body?.setAttribute("data-yt-description-style", "");
      } else {
        document.body?.removeAttribute("data-yt-description-style");
      }
    }

    // Hide recommendations toggle (CSS-only: data-yt-hide-recommendations)
    if (state.enableHideRecommendations !== undefined) {
      if (state.enableHideRecommendations) {
        document.body?.setAttribute("data-yt-hide-recommendations", "");
      } else {
        document.body?.removeAttribute("data-yt-hide-recommendations");
      }
    }
  });

  /* =========================================================================
     CORE: BOOT — extended state fields (persisted attrs on page load + SPA nav)
     ======================================================================= */

  async function bootV6() {
    const STORAGE_KEY = "ytUnifiedState";
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const state  = result[STORAGE_KEY] || {};

      if (state.enableDisableComments) {
        document.body?.setAttribute("data-yt-disable-comments", "");
      }
      if (state.enableDescriptionStyle) {
        document.body?.setAttribute("data-yt-description-style", "");
      }
      if (state.enableHideRecommendations) {
        document.body?.setAttribute("data-yt-hide-recommendations", "");
      }
    } catch {
      // storage read failed — body attrs remain unset; no action needed
    }
  }

  // Also re-apply v6 attrs on SPA navigation (YouTube wipes body attrs on
  // some navigations, especially /watch → / → /watch transitions).
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(bootV6, 80);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootV6, { once: true });
  } else {
    bootV6();
  }

})();
