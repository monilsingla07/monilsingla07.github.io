// assets/welcome-popup.js
//
// A lightweight, site-wide "welcome" popup whose content is fully
// controlled from the admin panel (Admin → Popup) — no code changes or
// redeploys needed to change the offer, swap the image, or turn it off.
//
// Behavior:
//   - Reads whatever popup the admin has marked active from a public,
//     read-only edge function (get-active-popup).
//   - Shows it once per browser. Closing it (✕, backdrop click, Escape,
//     or the CTA button) remembers that popup's id + last-updated time in
//     localStorage, so it won't show again on this device UNLESS the admin
//     publishes new/changed content later — then it shows once again.
//   - Same markup for mobile and desktop; sizing is handled with CSS only.

import { escapeHtml, escapeAttr, safeUrl } from "./safe.js";

const FUNCTIONS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-active-popup";
const DISMISS_KEY = "ahamstree_popup_dismissed";

function alreadyDismissed(popup) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw);
    return rec?.id === popup.id && rec?.updated_at === popup.updated_at;
  } catch (_) {
    return false;
  }
}

function markDismissed(popup) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ id: popup.id, updated_at: popup.updated_at }));
  } catch (_) {
    // If localStorage is unavailable (private mode, quota, etc.) the popup
    // will just show again next time — acceptable fallback, never block closing.
  }
}

function renderPopup(popup) {
  if (document.getElementById("welcomePopupOverlay")) return; // already mounted

  const img    = safeUrl(popup.image_url || "", { type: "src" });
  const link   = safeUrl(popup.button_link || "", { type: "href" });
  const hasBtn = !!(popup.button_text && link);

  const overlay = document.createElement("div");
  overlay.id = "welcomePopupOverlay";
  overlay.innerHTML = `
    <style>
      #welcomePopupOverlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(20, 14, 10, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        animation: wpFadeIn .18s ease-out;
      }
      @keyframes wpFadeIn { from { opacity: 0; } to { opacity: 1; } }
      #welcomePopupCard {
        position: relative;
        background: #fff;
        border-radius: 20px;
        max-width: 420px;
        width: 100%;
        max-height: 88vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,.3);
        text-align: center;
      }
      #welcomePopupClose {
        position: absolute; top: 10px; right: 10px;
        width: 34px; height: 34px;
        border-radius: 999px;
        border: none;
        background: rgba(0,0,0,.55);
        color: #fff;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        z-index: 1;
      }
      #welcomePopupClose:hover { background: rgba(0,0,0,.75); }
      #welcomePopupImg {
        width: 100%; display: block;
        border-radius: 20px 20px 0 0;
        max-height: 46vh;
        object-fit: cover;
      }
      #welcomePopupBody { padding: 22px 24px 26px; }
      #welcomePopupHeadline {
        font-family: 'Cormorant Garamond', serif;
        font-size: 26px; font-weight: 700; margin: 0 0 8px;
        color: #1a1a1a;
      }
      #welcomePopupSubtext { font-size: 14px; opacity: .78; margin: 0 0 18px; line-height: 1.5; color: #1a1a1a; }
      #welcomePopupBtn {
        display: inline-block;
        background: var(--brand, #7c1c1c);
        color: #fff;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        padding: 12px 26px;
        border-radius: 999px;
      }
      @media (max-width: 480px) {
        #welcomePopupCard { max-width: 94vw; border-radius: 16px; }
        #welcomePopupImg { border-radius: 16px 16px 0 0; }
        #welcomePopupHeadline { font-size: 22px; }
      }
    </style>
    <div id="welcomePopupCard" role="dialog" aria-modal="true" aria-label="Welcome offer">
      <button id="welcomePopupClose" type="button" aria-label="Close">&times;</button>
      ${img ? `<img id="welcomePopupImg" src="${img}" alt="${escapeAttr(popup.headline || "Welcome offer")}" />` : ""}
      <div id="welcomePopupBody">
        ${popup.headline ? `<div id="welcomePopupHeadline">${escapeHtml(popup.headline)}</div>` : ""}
        ${popup.subtext ? `<div id="welcomePopupSubtext">${escapeHtml(popup.subtext)}</div>` : ""}
        ${hasBtn ? `<a id="welcomePopupBtn" href="${link}">${escapeHtml(popup.button_text)}</a>` : ""}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  function close() {
    markDismissed(popup);
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    window.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.querySelector("#welcomePopupClose").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  window.addEventListener("keydown", onKeydown);

  const btn = overlay.querySelector("#welcomePopupBtn");
  if (btn) btn.addEventListener("click", () => markDismissed(popup));
}

let _mounted = false;

export async function mountWelcomePopup() {
  if (_mounted) return; // guard against double-init (e.g. re-called on auth state change)
  _mounted = true;

  try {
    const res = await fetch(FUNCTIONS_URL, { method: "GET" });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    const popup = data?.popup;
    if (!popup) return;
    if (alreadyDismissed(popup)) return;
    renderPopup(popup);
  } catch (_) {
    // Never let a popup failure break the page.
  }
}
