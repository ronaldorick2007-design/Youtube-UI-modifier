/**
 * YouTube Unified — js/popup.js  (v7)
 *
 * State shape (storage key: "ytUnifiedState")
 * ─────────────────────────────────────────────
 * {
 *   activeTheme:                "cyber"|"glass"|"minimal"|"ironman"|"none"|...,
 *   enableTextColors:           bool,
 *   enableBlockShorts:          bool,
 *   enableGlassHeader:          bool,
 *   enableHideRecommendations:  bool,
 *   enableDisableComments:      bool,
 *   enableDescriptionStyle:     bool,
 * }
 *
 * NOTE: cardStyle is DEPRECATED from the UI in v7. The theme engine manages
 * card styling via activeTheme. cardStyle is kept in storage for backward
 * compatibility with stateManager in content.js (it reads it on init).
 */

"use strict";

const DEFAULTS = {
  activeTheme:                "cyber",
  cardStyle:                  "cyber",   // kept for backward compat
  enableTextColors:           true,
  enableBlockShorts:          false,
  enableGlassHeader:          true,
  enableHideRecommendations:  false,
  enableDisableComments:      false,
  enableDescriptionStyle:     false,
};

const STORAGE_KEY      = "ytUnifiedState";
const THEMES_INDEX_URL = browser.runtime.getURL("themes/themes.json");

/* ── DOM refs ───────────────────────────────────────────────────────────── */
let themeList;   // <div id="theme-list"> — dynamically populated
let toggleBlockShorts;
let toggleDelayRecs, toggleDisableComments;
let statusDot, statusLabel;

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function loadState() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return Object.assign({}, DEFAULTS, result[STORAGE_KEY] || {});
}

async function saveState(state) {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

async function notifyTabs(state) {
  const tabs = await browser.tabs.query({ url: "*://*.youtube.com/*" });
  for (const tab of tabs) {
    browser.tabs.sendMessage(tab.id, {
      type: "YT_UNIFIED_STATE_UPDATE",
      state,
    }).catch(() => {});
  }
}

function flashSaved() {
  statusDot.classList.add("saved");
  statusLabel.textContent = "Saved";
  setTimeout(() => {
    statusDot.classList.remove("saved");
    statusLabel.textContent = "Active";
  }, 1200);
}

/* ── Theme catalogue loading ────────────────────────────────────────────── */

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/**
 * Load all theme metadata from themes/themes.json + individual theme.json
 * files. Returns array of theme objects. Silently skips broken themes.
 */
async function loadThemeCatalogue() {
  const index = await fetchJSON(THEMES_INDEX_URL);
  if (!Array.isArray(index)) return [];

  const catalogue = [];
  for (const id of index) {
    if (typeof id !== "string") continue;
    const meta = await fetchJSON(browser.runtime.getURL(`themes/${id}/theme.json`));
    if (!meta?.id) continue;
    catalogue.push({ id: meta.id, name: meta.name || meta.id, description: meta.description || "" });
  }
  return catalogue;
}

/* ── Theme selector UI ──────────────────────────────────────────────────── */

/**
 * Build theme radio buttons dynamically from catalogue.
 * Each theme gets a card with its name and optional description.
 */
function buildThemeSelector(catalogue, activeTheme) {
  // Clear existing children via DOM API — avoids innerHTML security flag
  while (themeList.firstChild) {
    themeList.removeChild(themeList.firstChild);
  }

  if (catalogue.length === 0) {
    const empty = document.createElement("p");
    empty.className = "theme-empty";
    empty.textContent = "No themes found in /themes/";
    themeList.appendChild(empty);
    return;
  }

  // Add a "None" option first
  const noneThemes = [{ id: "none", name: "Off", description: "No card styling" }, ...catalogue];

  for (const theme of noneThemes) {
    const wrap = document.createElement("div");
    wrap.className = "theme-card" + (theme.id === activeTheme ? " active" : "");
    wrap.dataset.themeId = theme.id;

    // Radio dot
    const dot = document.createElement("div");
    dot.className = "theme-card-dot";

    // Info container
    const info = document.createElement("div");
    info.className = "theme-card-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "theme-card-name";
    nameSpan.textContent = theme.name;
    info.appendChild(nameSpan);

    if (theme.description) {
      const descSpan = document.createElement("span");
      descSpan.className = "theme-card-desc";
      descSpan.textContent = theme.description;
      info.appendChild(descSpan);
    }

    wrap.appendChild(dot);
    wrap.appendChild(info);
    wrap.addEventListener("click", () => onThemeSelect(theme.id));
    themeList.appendChild(wrap);
  }
}

async function onThemeSelect(id) {
  // Update active styling in the UI
  themeList.querySelectorAll(".theme-card").forEach((el) => {
    el.classList.toggle("active", el.dataset.themeId === id);
  });

  const state = await loadState();
  state.activeTheme = id;
  // Keep cardStyle in sync for backward compat with stateManager
  state.cardStyle   = id === "none" ? "none" : id;
  await saveState(state);
  await notifyTabs(state);
  flashSaved();
}

/* ── Feature toggles ────────────────────────────────────────────────────── */

function renderToggles(state) {
  toggleBlockShorts.checked     = state.enableBlockShorts;
  toggleDelayRecs.checked       = state.enableHideRecommendations;
  toggleDisableComments.checked = state.enableDisableComments;
}

async function onToggleChange(key, value) {
  const state = await loadState();
  state[key] = value;
  await saveState(state);
  await notifyTabs(state);
  flashSaved();
}

/* ── Boot ───────────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  themeList             = document.getElementById("theme-list");
  toggleBlockShorts     = document.getElementById("toggle-block-shorts");
  toggleDelayRecs       = document.getElementById("toggle-delay-recs");
  toggleDisableComments = document.getElementById("toggle-disable-comments");
  statusDot             = document.getElementById("status-dot");
  statusLabel           = document.getElementById("status-label");

  const [state, catalogue] = await Promise.all([loadState(), loadThemeCatalogue()]);

  buildThemeSelector(catalogue, state.activeTheme || "none");
  renderToggles(state);

  toggleBlockShorts.addEventListener("change",
    (e) => onToggleChange("enableBlockShorts",          e.target.checked));
  toggleDelayRecs.addEventListener("change",
    (e) => onToggleChange("enableHideRecommendations",  e.target.checked));
  toggleDisableComments.addEventListener("change",
    (e) => onToggleChange("enableDisableComments",      e.target.checked));
});
