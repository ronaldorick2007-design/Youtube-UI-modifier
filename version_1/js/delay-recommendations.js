/**
 * YouTube Unified — js/delay-recommendations.js  (v7 patch)
 *
 * Hides the recommendations sidebar for 10 seconds after each /watch load,
 * then reveals them via a smooth fade-in.
 *
 * FIXES vs v6
 * ────────────
 * • Selector narrowed to ONLY ytd-watch-next-secondary-results-renderer.
 *   The old selectors (#secondary, #related) wrapped the ENTIRE right column
 *   which contains the Gemini engagement panel — hiding it unintentionally.
 *   ytd-watch-next-secondary-results-renderer is the specific element that
 *   holds ONLY the "Up next" / related video list. Gemini lives in a sibling
 *   engagement panel that is NOT a descendant of this element.
 *
 * • Toggle semantics corrected:
 *     enableDelayRecommendations = true  → show recommendations IMMEDIATELY
 *                                          (cancel any pending hide timer)
 *     enableDelayRecommendations = false → hide recommendations PERMANENTLY
 *                                          (no 10s reveal)
 *   The 10-second auto-reveal is the DEFAULT behaviour when the feature is
 *   simply active and neither override is in effect (i.e. first navigation
 *   before the toggle is explicitly set — or when state is missing).
 *
 * SELECTOR RATIONALE
 * ───────────────────
 * YouTube /watch page right-column structure (simplified):
 *
 *   #secondary
 *   ├── ytd-watch-next-secondary-results-renderer   ← recommendations ONLY
 *   └── ytd-engagement-panel-section-list-renderer  ← Gemini panel (sibling)
 *
 * Targeting ytd-watch-next-secondary-results-renderer directly is both
 * precise and safe — it cannot accidentally match the Gemini panel.
 */

"use strict";

(() => {
  const STYLE_ID    = "yt-unified-delay-recs";
  const STORAGE_KEY = "ytUnifiedState";
  const DELAY_MS    = 10_000;

  // Selector targets recommendations list only — not the Gemini engagement panel.
  const TARGET_SELECTOR = "ytd-watch-next-secondary-results-renderer";

  /** CSS that hides ONLY the recommendations list. Gemini panel is unaffected. */
  const HIDE_CSS = `
    ${TARGET_SELECTOR} {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: none !important;
    }
  `;

  /** Reveal CSS — swapped in just before the style tag is removed. */
  const REVEAL_CSS = `
    ${TARGET_SELECTOR} {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity 0.5s ease !important;
    }
  `;

  let _pendingTimer = null;
  let _styleTag     = null;

  /* ── Style tag helpers ──────────────────────────────────────────────── */

  function injectStyle(css) {
    if (!_styleTag) {
      _styleTag = document.createElement("style");
      _styleTag.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(_styleTag);
    }
    _styleTag.textContent = css;
  }

  function removeStyle() {
    if (_styleTag) {
      _styleTag.remove();
      _styleTag = null;
    }
  }

  /* ── Core logic ─────────────────────────────────────────────────────── */

  function cancelPending() {
    if (_pendingTimer !== null) {
      clearTimeout(_pendingTimer);
      _pendingTimer = null;
    }
  }

  /** Default behaviour: hide for 10 s then fade in. */
  function startDelay() {
    cancelPending();
    injectStyle(HIDE_CSS);
    _pendingTimer = setTimeout(() => {
      _pendingTimer = null;
      injectStyle(REVEAL_CSS);
      setTimeout(removeStyle, 600);
    }, DELAY_MS);
  }

  /** Toggle ON: cancel any pending hide, show recommendations immediately. */
  function showNow() {
    cancelPending();
    removeStyle(); // remove any existing hide/reveal rule
  }

  /** Toggle OFF: hide recommendations permanently with no auto-reveal. */
  function hideForever() {
    cancelPending();
    injectStyle(HIDE_CSS); // no setTimeout — stays hidden until toggled back
  }

  /** Tear down everything — used when navigating away from /watch. */
  function reset() {
    cancelPending();
    removeStyle();
  }

  /* ── Storage read ───────────────────────────────────────────────────── */

  async function getState() {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || {};
    } catch {
      return {};
    }
  }

  /* ── Per-navigation entry point ─────────────────────────────────────── */

  async function onNavigate() {
    if (location.pathname !== "/watch") {
      reset();
      return;
    }

    const state = await getState();

    // enableDelayRecommendations missing/undefined → use default 10s delay
    if (state.enableDelayRecommendations === undefined) {
      startDelay();
      return;
    }

    if (state.enableDelayRecommendations === true) {
      // Toggle ON → show immediately (no delay, no hide)
      showNow();
    } else {
      // Toggle OFF → hide permanently
      hideForever();
    }
  }

  /* ── Message listener — instant response to popup toggle ────────────── */

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "YT_UNIFIED_STATE_UPDATE") return;
    if (location.pathname !== "/watch") return;

    const { enableDelayRecommendations } = message.state || {};
    if (enableDelayRecommendations === undefined) return;

    if (enableDelayRecommendations === true) {
      showNow();
    } else {
      hideForever();
    }
  });

  /* ── SPA navigation hook ────────────────────────────────────────────── */

  document.addEventListener("yt-navigate-finish", onNavigate);

  /* ── Initial page load ──────────────────────────────────────────────── */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onNavigate, { once: true });
  } else {
    onNavigate();
  }

})();
