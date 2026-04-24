/**
 * YouTube Unified — config.js
 *
 * Central configuration file. Change values here to swap visuals,
 * enable/disable features, or tune behaviour — no other file needs editing.
 *
 * ─── BACKGROUND ──────────────────────────────────────────────────────────────
 * background : full https:// URL, or null to disable.
 *              Background images are provided by themes; set this only to
 *              override with a remote URL.
 *
 * backgroundBrightness : CSS filter brightness value (0–1). 1 = original.
 * backgroundSaturate   : CSS filter saturate value.    1 = original.
 *
 * ─── BOOTSCREEN ──────────────────────────────────────────────────────────────
 * bootscreen        : reserved for future use. Bootscreen videos are
 *                     provided by themes via theme-loader.js.
 *                     Set to null to skip the bootscreen.
 * bootscreenTimeout  : hard fallback in ms in case the video never fires "ended".
 *
 * ─── CARD STYLE ──────────────────────────────────────────────────────────────
 * cardStyle : "glass" | "cyber" | "minimal" | "none"
 *   "glass"   — frosted-glass look (default)
 *   "cyber"   — neon-border cyberpunk look
 *   "minimal" — very subtle, almost invisible card styling
 *   "none"    — no card styling at all (disables glassUI module)
 *
 * ─── FEATURES ────────────────────────────────────────────────────────────────
 * enableGemini      : auto-opens the Gemini panel on /watch pages
 * enableElementKiller : removes grid-shelf-view-model shelf elements
 * enableGlassHeader : applies blur/transparency to the masthead
 *
 * ─── GEMINI ──────────────────────────────────────────────────────────────────
 * geminiInitialDelay    : ms to wait after page load before opening panel
 * geminiPanelDelay      : ms to wait after panel opens before sending prompt
 * geminiResponseTimeout : max ms to wait for Gemini response before resuming
 */

export const CONFIG = {
  // ── Visual assets ────────────────────────────────────────────────────────
  background: null,          // set to https:// URL to override theme background
  backgroundBrightness: 0.7,
  backgroundSaturate: 1.1,

  bootscreen: null,          // reserved; bootscreen videos are theme-provided
  bootscreenTimeout: 8_000,

  // ── Card style ───────────────────────────────────────────────────────────
  cardStyle: "cyber",           // "glass" | "cyber" | "minimal" | "none"

  // ── Feature flags ────────────────────────────────────────────────────────
  enableGemini: true,
  enableElementKiller: true,
  enableGlassHeader: true,

  // ── Gemini timing (ms) ───────────────────────────────────────────────────
  geminiInitialDelay: 2200,
  geminiPanelDelay: 1900,
  geminiResponseTimeout: 40_000,
};
