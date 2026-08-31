// assets/signin-popup.js
//
// A site-wide "please sign in" popup, shown only to visitors who are NOT
// logged in. Content (headline/subtext/button/image) is fully controlled
// from the admin panel (Admin → Popup Manager → Sign-in popup) — no code
// changes or redeploys needed to change the wording or turn it off.
//
// Behavior:
//   - Only fetched/shown when the visitor has no Supabase session.
//   - Skipped entirely on login.html, admin*.html and checkout/success/
//     cancel pages — showing "please sign in" mid-checkout or on the
//     login page itself is just noise.
//   - If the site-wide welcome/promo popup (assets/welcome-popup.js) is
//     already showing, this waits for it to close first so the two never
//     stack on top of each other.
//   - Easily dismissed: ✕ button, backdrop click, Escape, or the CTA
//     itself. Dismissal is remembered in localStorage for `reappear_hours`
//     (admin-configurable, default 24h) so it nudges return visitors
//     without nagging on every page load.
//   - If the visitor signs in while the popup is open (e.g. in another
//     tab), it closes itself automatically.

import { escapeHtml, escapeAttr, safeUrl } from "./safe.js";
import { supabase } from "./supabase.js";

const FUNCTIONS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-signin-popup-config";
const DISMISS_KEY = "ahamstree_signin_popup_dismissed";

const EXCLUDED_PATH_PATTERNS = [
  /\/login\.html$/i,
  /\/admin/i,
  /\/checkout\.html$/i,
  /\/success\.html$/i,
  /\/cancel\.html$/i,
];

function isExcludedPage() {
  const path = window.location.pathname;
  return EXCLUDED_PATH_PATTERNS.some((rx) => rx.test(path));
}

function alreadyDismissed(reappearHours) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw);
    if (!rec?.dismissedAt) return false;
    const windowMs = Math.max(1, Number(reappearHours) || 24) * 60 * 60 * 1000;
    return Date.now() - rec.dismissedAt < windowMs;
  } catch (_) {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ dismissedAt: Date.now() }));
  } catch (_) {
    // If localStorage is unavailable (private mode, quota, etc.) the popup
    // will just show again next time — acceptable fallback, never block closing.
  }
}

function renderPopup(config) {
  if (document.getElementById("signinPopupOverlay")) return; // already mounted

  const img    = safeUrl(config.image_url || "", { type: "src" });
  const link   = safeUrl(config.button_link || "/login.html", { type: "href" });
  const btnText = config.button_text || "Sign In / Register";

  const overlay = document.createElement("div");
  overlay.id = "signinPopupOverlay";
  overlay.innerHTML = `
    <style>
      #signinPopupOverlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(20, 14, 10, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        animation: spFadeIn .18s ease-out;
      }
      @keyframes spFadeIn { from { opacity: 0; } to { opacity: 1; } }
      #signinPopupCard {
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
      #signinPopupClose {
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
      #signinPopupClose:hover { background: rgba(0,0,0,.75); }
      #signinPopupImg {
        width: 100%; display: block;
        border-radius: 20px 20px 0 0;
        max-height: 40vh;
        object-fit: cover;
      }
      #signinPopupBody { padding: 24px 24px 26px; }
      #signinPopupHeadline {
        font-family: 'Cormorant Garamond', serif;
        font-size: 26px; font-weight: 700; margin: 0 0 8px;
        color: #1a1a1a;
      }
      #signinPopupSubtext { font-size: 14px; opacity: .78; margin: 0 0 20px; line-height: 1.5; color: #1a1a1a; }
      #signinPopupBtn {
        display: inline-block;
        background: var(--brand, #7c1c1c);
        color: #fff;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        padding: 12px 28px;
        border-radius: 999px;
      }
      #signinPopupLater {
        display: block;
        margin: 14px auto 0;
        background: none;
        border: none;
        font-size: 13px;
        opacity: .55;
        cursor: pointer;
        text-decoration: underline;
      }
      @media (max-width: 480px) {
        #signinPopupCard { max-width: 94vw; border-radius: 16px; }
        #signinPopupImg { border-radius: 16px 16px 0 0; }
        #signinPopupHeadline { font-size: 22px; }
      }
    </style>
    <div id="signinPopupCard" role="dialog" aria-modal="true" aria-label="Sign in">
      <button id="signinPopupClose" type="button" aria-label="Close">&times;</button>
      ${img ? `<img id="signinPopupImg" src="${img}" alt="${escapeAttr(config.headline || "Sign in")}" />` : ""}
      <div id="signinPopupBody">
        ${config.headline ? `<div id="signinPopupHeadline">${escapeHtml(config.headline)}</div>` : ""}
        ${config.subtext ? `<div id="signinPopupSubtext">${escapeHtml(config.subtext)}</div>` : ""}
        <a id="signinPopupBtn" href="${link}">${escapeHtml(btnText)}</a>
        <button id="signinPopupLater" type="button">Maybe later</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  function close() {
    markDismissed();
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    window.removeEventListener("keydown", onKeydown);
    authSub?.subscription?.unsubscribe();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.querySelector("#signinPopupClose").addEventListener("click", close);
  overlay.querySelector("#signinPopupLater").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  window.addEventListener("keydown", onKeydown);
  overlay.querySelector("#signinPopupBtn").addEventListener("click", () => markDismissed());

  // If the visitor signs in elsewhere (another tab, or Google redirect came
  // back) while this is open, don't leave a stale "please sign in" dialog up.
  const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) close();
  });
}

function waitForWelcomePopupToClear(cb, attemptsLeft = 60) {
  const blocking = document.getElementById("welcomePopupOverlay");
  if (!blocking || attemptsLeft <= 0) { cb(); return; }
  setTimeout(() => waitForWelcomePopupToClear(cb, attemptsLeft - 1), 300);
}

let _mounted = false;

export async function mountSignInPopup() {
  if (_mounted) return; // guard against double-init
  _mounted = true;

  try {
    if (isExcludedPage()) return;

    const { data: sess } = await supabase.auth.getSession();
    if (sess?.session?.user) return; // already logged in — nothing to do

    const res = await fetch(FUNCTIONS_URL, { method: "GET" });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    const config = data?.config;
    if (!config) return; // disabled, or admin hasn't set it up yet
    if (alreadyDismissed(config.reappear_hours)) return;

    // Give the page a moment to settle, and never stack under/over the
    // general promo popup if one is currently showing.
    setTimeout(() => {
      waitForWelcomePopupToClear(() => renderPopup(config));
    }, 600);
  } catch (_) {
    // Never let a popup failure break the page.
  }
}
