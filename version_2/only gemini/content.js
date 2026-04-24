// content.js - YouTube Gemini Auto-Prompt for Firefox (Improved Send)

const CONFIG = {
  enableGemini: true,
  geminiInitialDelay: 1800,
  geminiPanelDelay: 1000,
  geminiResponseTimeout: 18000
};

const geminiModule = (() => {
  const _seenVideos = new Set();
  let _running = false;

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

  async function getCustomPrompt() {
    return `Give only:
VERDICT: [WATCH / SKIP]
TYPE: [VALUE / NOISE / MANIPULATION]
REASON: (max 10 words)
If unsure → SKIP.`;
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
      console.log("[Gemini Auto] Gemini panel opened");
      return true;
    }
    console.log("[Gemini Auto] Gemini/Ask button not found");
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
    let stableCount = 0;

    for (let i = 0; i < maxIter; i++) {
      await sleep(250);
      const container = document.querySelector("yt-gemini-chat") ||
                        document.querySelector("ytd-gemini-chat") ||
                        document.querySelector('[role="textbox"]')?.closest("yt-gemini-chat, ytd-gemini-chat");

      if (container) {
        const len = (container.innerText || container.textContent || "").trim().length;
        if (len > 80 && len === previousLength) {
          if (++stableCount >= 7) {
            playVideo();
            console.log("[Gemini Auto] Response stabilized");
            return;
          }
        } else {
          stableCount = 0;
        }
        previousLength = len;
      }
    }
    playVideo(); // timeout fallback
  }

  async function sendPrompt(promptText) {
    // Wait for input area (textarea or contenteditable)
    const inputArea = await waitForElement(() => {
      return (
        document.querySelector("textarea") ||
        document.querySelector('[role="textbox"]') ||
        document.querySelector('[contenteditable="true"]')
      );
    }, 80, 120);

    if (!inputArea) {
      console.log("[Gemini Auto] Input area not found");
      return;
    }

    inputArea.focus();
    await sleep(300);

    // Clear and type prompt realistically
    if (inputArea.tagName === "TEXTAREA") {
      inputArea.value = "";
      for (let char of promptText) {
        inputArea.value += char;
        inputArea.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(7);
      }
    } else {
      inputArea.innerText = promptText;
      inputArea.dispatchEvent(new Event("input", { bubbles: true }));
      inputArea.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await sleep(900);

    // === STRONGER SEND BUTTON DETECTION ===
    let sendBtn = null;

    // Method 1: aria-label containing "send"
    sendBtn = [...document.querySelectorAll("button")].find(b => {
      const label = (b.getAttribute("aria-label") || "").toLowerCase();
      return !b.disabled && (label.includes("send") || label.includes("submit"));
    });

    // Method 2: Button with send icon (SVG)
    if (!sendBtn) {
      sendBtn = [...document.querySelectorAll("button")].find(b => 
        !b.disabled && b.querySelector("svg") && 
        (b.innerHTML.toLowerCase().includes("send") || 
         b.getAttribute("aria-label")?.toLowerCase().includes("send"))
      );
    }

    // Method 3: Click the Enter key simulation (most reliable in 2026 Gemini)
    if (!sendBtn) {
      console.log("[Gemini Auto] Send button not found → trying Enter key");
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputArea.dispatchEvent(enterEvent);
      await sleep(300);
      inputArea.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      
      console.log("[Gemini Auto] Prompt sent via Enter key");
      await sleep(800);
      pauseVideo();
      setTimeout(waitForResponseComplete, 1500);
      return;
    }

    // If button found, click it
    if (sendBtn) {
      sendBtn.click();
      console.log("[Gemini Auto] Prompt sent via Send button");
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

      const prompt = await getCustomPrompt();
      await sendPrompt(prompt);

    } catch (e) {
      console.error("[Gemini Auto] Error:", e);
    } finally {
      _running = false;
    }
  }

  return { run };
})();

// SPA Navigation
document.addEventListener("yt-navigate-finish", () => {
  setTimeout(() => geminiModule.run(), 150);
});

const style = document.createElement("style");
style.textContent = `
yt-section-list-renderer[data-target-id="youchat_section_list"] {
  background: linear-gradient(135deg, black, red) !important;
}

markdown-div.ytwMarkdownDivHost {
  color: #ffffff !important;
}
`;
document.head.appendChild(style);

// Initial load
setTimeout(() => geminiModule.run(), 2500);