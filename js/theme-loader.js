/**
 * YouTube Unified — js/theme-loader.js  (v7)
 *
 * THEME ENGINE
 * ─────────────────────────────────────────────────────────────────────────
 * Discovers, loads, and applies plug-and-play themes from /themes/.
 * Themes are self-contained folders — dropping a folder in is all that is
 * needed to add a new theme. Removing a folder cannot break the extension.
 *
 * HOW THEME DISCOVERY WORKS
 * ─────────────────────────
 * Firefox extensions cannot list directories at runtime. We work around
 * this by reading a single manifest file: /themes/themes.json, which is
 * a JSON array of theme IDs (folder names) that exist in /themes/.
 * e.g.  ["cyber", "glass", "minimal", "ironman"]
 *
 * When you add a new theme folder, add its id to themes.json — that's the
 * only change needed outside the theme folder itself.
 *
 * WHY themes.json INSTEAD OF RUNTIME DIRECTORY SCAN
 * ───────────────────────────────────────────────────
 * WebExtension APIs do not expose a directory-listing method for
 * web_accessible_resources. The themes.json approach keeps discovery
 * declarative, fast (one fetch), and crash-safe: a bad entry is silently
 * skipped, never throws.
 *
 * WHAT THE LOADER DOES
 * ─────────────────────
 * 1. Fetches /themes/themes.json to get the list of theme ids.
 * 2. For each id, fetches /themes/{id}/theme.json for metadata.
 *    Bad/missing theme.json → theme is silently skipped.
 * 3. Exposes the full theme catalogue via themeLoader.getCatalogue().
 * 4. On applyTheme(id):
 *    a. Stamps  body[data-yt-theme="{id}"]  — activates scoped CSS.
 *    b. Injects /themes/{id}/video-card.css into a <style> tag.
 *    c. If theme.hasBackground: replaces the background image.
 *    d. Stamps data-yt-card-style on existing cards so scoped CSS fires.
 * 5. On clearTheme(): removes all injected tags and attributes.
 *
 * INTEGRATION WITH EXISTING SYSTEMS
 * ───────────────────────────────────
 * • The existing  glassUI  module still stamps  data-yt-card-style  on
 *   every card — theme CSS is scoped to  body[data-yt-theme="X"]  so it
 *   only fires for the active theme. No conflicts.
 * • The existing  backgroundModule  still owns  <style id="yt-unified-bg">.
 *   The theme engine writes to a SEPARATE tag  <style id="yt-theme-bg">
 *   which has higher source order (appended later) so it wins the cascade.
 * • stateManager in content.js handles cardStyle → theme engine overrides
 *   CONFIG.cardStyle to the theme id so glassUI stamps the right value.
 *
 * MESSAGE PROTOCOL
 * ─────────────────
 * Receives:  { type: "YT_UNIFIED_STATE_UPDATE", state: { activeTheme: id } }
 * On receipt: calls applyTheme(id) or clearTheme() if id is "none".
 */

"use strict";

(() => {
  const STORAGE_KEY      = "ytUnifiedState";
  const THEMES_INDEX_URL = browser.runtime.getURL("themes/themes.json");

  /* ── Style tag IDs — never collide with existing tags ──────────────────── */
  const TAG_CARD_CSS   = "yt-theme-card-css";
  const TAG_BG_CSS     = "yt-theme-bg";
  const BODY_ATTR      = "data-yt-theme";

  /* ── Internal state ────────────────────────────────────────────────────── */
  let _catalogue  = [];   // [{id, name, description, hasBackground, cardStyleValue}]
  let _activeId   = null;

  /* ── Constants ──────────────────────────────────────────────────────────── */
  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-rich-grid-media",
    ".ytLockupViewModelHost",
  ].join(",");

  /* ── Utilities ─────────────────────────────────────────────────────────── */

  /** Fetch JSON from an extension URL. Returns null on any error. */
  async function fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /** Fetch text from an extension URL. Returns null on any error. */
  async function fetchText(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  /**
   * Inject or update a <style> tag by id.
   * Pass css=null to remove the tag entirely.
   */
  function setStyleTag(id, css) {
    let tag = document.getElementById(id);
    if (css === null) {
      tag?.remove();
      return;
    }
    if (!tag) {
      tag = document.createElement("style");
      tag.id = id;
      (document.head || document.documentElement).appendChild(tag);
    }
    tag.textContent = css;
  }

  /* ── Discovery ─────────────────────────────────────────────────────────── */

  /**
   * Load the themes index and all theme manifests.
   * Silently skips any theme whose theme.json is missing or malformed.
   * Returns the catalogue array.
   */
  async function discover() {
    const index = await fetchJSON(THEMES_INDEX_URL);
    if (!Array.isArray(index)) return [];

    const catalogue = [];
    for (const id of index) {
      if (typeof id !== "string" || !id.trim()) continue;
      const url  = browser.runtime.getURL(`themes/${id}/theme.json`);
      const meta = await fetchJSON(url);
      if (!meta || typeof meta.id !== "string") continue;
      catalogue.push({
        id:             meta.id,
        name:           meta.name          || meta.id,
        description:    meta.description   || "",
        hasBackground:  !!meta.hasBackground,
        cardStyleValue: meta.cardStyleValue || meta.id,
      });
    }

    _catalogue = catalogue;
    return catalogue;
  }

  /* ── Application ───────────────────────────────────────────────────────── */

  /** Remove all theme-injected tags, inline styles, and body attribute. */
  function clearTheme() {
    document.body?.removeAttribute(BODY_ATTR);
    setStyleTag(TAG_CARD_CSS, null);
    setStyleTag(TAG_BG_CSS,   null);
    _activeId = null;
  }

  /**
   * Apply a theme by id.
   * Steps:
   *  1. Clear any previously active theme.
   *  2. Stamp body[data-yt-theme="{id}"].
   *  3. Inject video-card.css.
   *  4. Optionally set background image.
   *  5. Re-stamp data-yt-card-style on existing cards so scoped CSS fires.
   */
  async function applyTheme(id) {
    if (!id || id === "none") { clearTheme(); return; }

    const meta = _catalogue.find(t => t.id === id);
    if (!meta) { clearTheme(); return; }

    // 1. Clear previous theme
    clearTheme();
    _activeId = id;

    // 2. Stamp body attribute — activates all scoped CSS in the theme file
    document.body?.setAttribute(BODY_ATTR, id);

    // 3. Inject video-card.css
    const cardCSS = await fetchText(browser.runtime.getURL(`themes/${id}/video-card.css`));
    if (cardCSS) setStyleTag(TAG_CARD_CSS, cardCSS);

    // 4. Inject background if declared
    if (meta.hasBackground) {
      for (const ext of ["jpg", "jpeg", "png", "webp", "avif", "gif"]) {
        const bgUrl = browser.runtime.getURL(`themes/${id}/background.${ext}`);
        try {
          const probe = await fetch(bgUrl, { method: "HEAD", cache: "no-store" });
          if (probe.ok) {
            setStyleTag(TAG_BG_CSS, `
              body::before {
                background-image: url("${bgUrl}") !important;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                background-attachment: fixed;
              }
            `);
            break;
          }
        } catch { /* extension not found — try next */ }
      }
    }

    // 5. Re-stamp data-yt-card-style on already-processed cards
    const cardStyleVal = meta.cardStyleValue || id;
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      card.setAttribute("data-yt-card-style", cardStyleVal);
      card.setAttribute("data-yt-unified-glass", "true");
    });
  }

  /* ── SPA re-application ─────────────────────────────────────────────────── */

  /**
   * Re-apply the active theme after SPA navigation.
   * body[data-yt-theme] survives navigation, but we re-stamp cards because
   * YouTube replaces card DOM on every page transition.
   */
  async function reapplyOnNav() {
    if (!_activeId) return;
    const meta = _catalogue.find(t => t.id === _activeId);
    if (!meta) return;

    const cardStyleVal = meta.cardStyleValue || _activeId;
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      card.setAttribute("data-yt-card-style", cardStyleVal);
      card.setAttribute("data-yt-unified-glass", "true");
    });
  }

  /* ── Message listener ───────────────────────────────────────────────────── */

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "YT_UNIFIED_STATE_UPDATE") return;
    const newTheme = message.state?.activeTheme;
    if (newTheme !== undefined) {
      applyTheme(newTheme);
    }
  });

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(reapplyOnNav, 80);
  });

  /* ── Boot ───────────────────────────────────────────────────────────────── */

  async function boot() {
    await discover();
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const state  = result[STORAGE_KEY] || {};
      if (state.activeTheme && state.activeTheme !== "none") {
        await applyTheme(state.activeTheme);
      }
    } catch { /* storage unavailable — no theme applied */ }
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */

  window.__ytThemeLoader = {
    boot,
    discover,
    applyTheme,
    clearTheme,
    getCatalogue: () => _catalogue,
    getActiveId:  () => _activeId,
  };

  // Boot immediately — but wait for body if document_start fires too early
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

})();
