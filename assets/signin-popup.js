// assets/signin-popup.js
//
// A site-wide "please sign in" popup, shown only to visitors who are NOT
// logged in. Marketing copy (headline/subtext/image) is fully controlled
// from the admin panel (Admin → Popup Manager → Sign-in popup) — no code
// changes or redeploys needed to change the wording or turn it off. The
// sign-in form itself (WhatsApp OTP + Google) is built in, mirroring
// login.html, so a visitor can actually sign in from the popup instead of
// being sent to a separate page.
//
// Behavior:
//   - Only fetched/shown when the visitor has no Supabase session.
//   - Skipped entirely on login.html, admin*.html and checkout/success/
//     cancel pages — showing "please sign in" mid-checkout or on the
//     login page itself is just noise.
//   - If the site-wide welcome/promo popup (assets/welcome-popup.js) is
//     already showing, this waits for it to close first so the two never
//     stack on top of each other.
//   - Shows once per `reappear_hours` window (admin-configurable, default
//     24h — i.e. once per day). That "shown" mark is recorded the moment
//     it's displayed, not only when it's dismissed, so a visitor who
//     closes it — or just never interacts with it — still won't see it
//     again on later refreshes that same day. On those later refreshes,
//     the general Popup Manager promo popup (welcome-popup.js) is free to
//     show its own content as usual, independent of this one.
//   - Easily dismissed: ✕ button, backdrop click, Escape, or "Maybe
//     later".
//   - Sign in with a WhatsApp one-time code entered right in the popup,
//     or "Continue with Google" (returns to the same page, no redirect to
//     a separate login page). Closes itself automatically on success, or
//     if the visitor signs in elsewhere (another tab) while it's open.

import { escapeHtml, escapeAttr, safeUrl } from "./safe.js";
import { supabase } from "./supabase.js";
import { upsertProfileIfPending, ensureProfileFromPhone } from "./profile-seed.js";

const FUNCTIONS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-signin-popup-config";
const SHOWN_KEY = "ahamstree_signin_popup_shown";

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

// "Once when the visitor opens the site in a day" — a rolling window from
// the last time it was actually shown (default 24h), admin-configurable.
function shownRecently(reappearHours) {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    if (!raw) return false;
    const rec = JSON.parse(raw);
    if (!rec?.shownAt) return false;
    const windowMs = Math.max(1, Number(reappearHours) || 24) * 60 * 60 * 1000;
    return Date.now() - rec.shownAt < windowMs;
  } catch (_) {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify({ shownAt: Date.now() }));
  } catch (_) {
    // If localStorage is unavailable (private mode, quota, etc.) the popup
    // will just show again next time — acceptable fallback.
  }
}

// ── Phone helpers — mirror login.html's WhatsApp OTP flow exactly ──────
const phoneOk = (v) => {
  const digits = String(v || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return /^[6-9]\d{9}$/.test(digits.slice(2));
  return /^[6-9]\d{9}$/.test(digits);
};

const normalizePhone10 = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d;
};

const toE164 = (phone10) => "+91" + phone10;

// Mirrors Supabase Auth's default 60-second "last request" throttle on
// /auth/v1/otp — kept in sync purely so the resend countdown matches what
// the server will actually allow. Same constant as login.html.
const RESEND_COOLDOWN_SECONDS = 60;

const iconWhatsapp = () => `
  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#25D366" d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.07-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Z"/>
    <path fill="#fff" d="M9.1 7.28c-.2-.45-.4-.46-.6-.47h-.5c-.18 0-.46.07-.7.34-.24.27-.92.9-.92 2.2s.94 2.55 1.07 2.73c.13.18 1.83 2.93 4.5 4 2.23.88 2.68.7 3.17.66.49-.05 1.57-.64 1.79-1.26.22-.62.22-1.15.15-1.26-.07-.11-.24-.18-.5-.31-.27-.13-1.57-.78-1.82-.86-.24-.09-.42-.13-.6.13-.18.27-.68.86-.84 1.04-.15.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.8-.71-1.33-1.59-1.49-1.86-.15-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.05-.34-.02-.47-.07-.13-.6-1.49-.85-2.05Z"/>
  </svg>`;

const iconGoogle = () => `
  <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"/>
    <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.26a12 12 0 0 0 0 10.75l4.01-3.11Z"/>
    <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76Z"/>
  </svg>`;

function renderPopup(config) {
  if (document.getElementById("signinPopupOverlay")) return; // already mounted

  const img = safeUrl(config.image_url || "", { type: "src" });

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
        max-width: 400px;
        width: 100%;
        max-height: 92vh;
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
        max-height: 26vh;
        object-fit: cover;
      }
      #signinPopupBody { padding: 22px 24px 24px; text-align: left; }
      #signinPopupHeadline {
        font-family: 'Cormorant Garamond', serif;
        font-size: 24px; font-weight: 700; margin: 0 0 6px;
        color: #1a1a1a; text-align: center;
      }
      #signinPopupSubtext { font-size: 13px; opacity: .78; margin: 0 0 16px; line-height: 1.5; color: #1a1a1a; text-align: center; }
      #signinPopupDivider { display: flex; align-items: center; gap: 10px; margin: 14px 0; color: #9ca3af; font-size: 12px; }
      #signinPopupDivider span.line { flex: 1; height: 1px; background: #e5e7eb; }
      #signinPopupGoogleBtn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; }
      #signinPopupSendBtn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; }
      #signinPopupStatus { font-size: 12px; margin-top: 10px; min-height: 1em; text-align: center; }
      #signinPopupOtpStep { display: none; margin-top: 14px; }
      #signinPopupLater {
        display: block;
        margin: 16px auto 0;
        background: none;
        border: none;
        font-size: 12px;
        opacity: .55;
        cursor: pointer;
        text-decoration: underline;
      }
      @media (max-width: 480px) {
        #signinPopupCard { max-width: 94vw; border-radius: 16px; }
        #signinPopupImg { border-radius: 16px 16px 0 0; }
        #signinPopupHeadline { font-size: 21px; }
      }
    </style>
    <div id="signinPopupCard" role="dialog" aria-modal="true" aria-label="Sign in">
      <button id="signinPopupClose" type="button" aria-label="Close">&times;</button>
      ${img ? `<img id="signinPopupImg" src="${img}" alt="${escapeAttr(config.headline || "Sign in")}" />` : ""}
      <div id="signinPopupBody">
        ${config.headline ? `<div id="signinPopupHeadline">${escapeHtml(config.headline)}</div>` : ""}
        ${config.subtext ? `<div id="signinPopupSubtext">${escapeHtml(config.subtext)}</div>` : ""}

        <div class="field">
          <label for="signinPopupPhone">WhatsApp number</label>
          <input id="signinPopupPhone" class="input" type="tel" autocomplete="tel"
            placeholder="10-digit mobile number" inputmode="numeric" required />
          <div id="signinPopupErrPhone" class="error-text" style="display:none;"></div>
        </div>

        <button id="signinPopupSendBtn" type="button" class="btn" style="margin-top:10px;">
          ${iconWhatsapp()} Send code on WhatsApp
        </button>

        <div id="signinPopupOtpStep">
          <div class="field">
            <label for="signinPopupCode">Enter the 6-digit code</label>
            <input id="signinPopupCode" class="input" type="text" inputmode="numeric" autocomplete="one-time-code"
              maxlength="6" placeholder="••••••" style="letter-spacing:4px;font-weight:700;max-width:160px;" />
            <div id="signinPopupErrCode" class="error-text" style="display:none;"></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center;">
            <button id="signinPopupVerifyBtn" class="btn" style="flex:1;">Verify &amp; continue</button>
          </div>
          <div style="display:flex;gap:14px;margin-top:8px;font-size:12px;">
            <button id="signinPopupResendBtn" type="button" class="btn secondary" style="padding:6px 12px;font-size:12px;" disabled>Resend code</button>
            <button id="signinPopupChangeBtn" type="button" style="background:none;border:none;opacity:.6;text-decoration:underline;cursor:pointer;font-size:12px;">Change number</button>
          </div>
        </div>

        <div id="signinPopupDivider"><span class="line"></span>or<span class="line"></span></div>
        <button id="signinPopupGoogleBtn" type="button" class="btn secondary">${iconGoogle()} Continue with Google</button>

        <div id="signinPopupStatus"></div>

        <button id="signinPopupLater" type="button">Maybe later</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  markShown();
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    window.removeEventListener("keydown", onKeydown);
    if (cooldownTimer) clearInterval(cooldownTimer);
    authSub?.subscription?.unsubscribe();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.querySelector("#signinPopupClose").addEventListener("click", close);
  overlay.querySelector("#signinPopupLater").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  window.addEventListener("keydown", onKeydown);

  // ── Wire up the inline WhatsApp OTP flow (mirrors login.html) ────────
  const phoneInput  = overlay.querySelector("#signinPopupPhone");
  const sendBtn     = overlay.querySelector("#signinPopupSendBtn");
  const otpStep     = overlay.querySelector("#signinPopupOtpStep");
  const codeInput   = overlay.querySelector("#signinPopupCode");
  const verifyBtn   = overlay.querySelector("#signinPopupVerifyBtn");
  const resendBtn   = overlay.querySelector("#signinPopupResendBtn");
  const changeBtn   = overlay.querySelector("#signinPopupChangeBtn");
  const googleBtn   = overlay.querySelector("#signinPopupGoogleBtn");
  const status      = overlay.querySelector("#signinPopupStatus");
  const errPhoneEl  = overlay.querySelector("#signinPopupErrPhone");
  const errCodeEl   = overlay.querySelector("#signinPopupErrCode");

  let currentPhone10 = null;
  let cooldownTimer = null;

  const setPhoneError = (msg) => {
    phoneInput.classList.toggle("is-invalid", !!msg);
    errPhoneEl.style.display = msg ? "block" : "none";
    errPhoneEl.textContent = msg || "";
  };
  const setCodeError = (msg) => {
    codeInput.classList.toggle("is-invalid", !!msg);
    errCodeEl.style.display = msg ? "block" : "none";
    errCodeEl.textContent = msg || "";
  };

  function startCooldown(btn) {
    let remaining = RESEND_COOLDOWN_SECONDS;
    btn.disabled = true;
    btn.textContent = `Resend (${remaining}s)`;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        btn.disabled = false;
        btn.textContent = "Resend code";
      } else {
        btn.textContent = `Resend (${remaining}s)`;
      }
    }, 1000);
  }

  async function sendOtp() {
    setPhoneError("");
    const phone10 = normalizePhone10(phoneInput.value);

    if (!phoneOk(phone10)) {
      setPhoneError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    sendBtn.disabled = true;
    status.textContent = "Sending code on WhatsApp…";

    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone10) });

    sendBtn.disabled = false;

    if (error) {
      status.textContent = "Error: " + error.message;
      return;
    }

    currentPhone10 = phone10;
    status.textContent = `Code sent to +91 ${phone10} on WhatsApp.`;
    otpStep.style.display = "block";
    phoneInput.disabled = true;
    sendBtn.style.display = "none";
    codeInput.value = "";
    codeInput.focus();
    startCooldown(resendBtn);
  }

  sendBtn.addEventListener("click", sendOtp);
  phoneInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendOtp(); });

  resendBtn.addEventListener("click", async () => {
    if (resendBtn.disabled || !currentPhone10) return;
    setCodeError("");
    status.textContent = "Resending code…";
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(currentPhone10) });
    if (error) {
      status.textContent = "Error: " + error.message;
      return;
    }
    status.textContent = `New code sent to +91 ${currentPhone10} on WhatsApp.`;
    startCooldown(resendBtn);
  });

  changeBtn.addEventListener("click", () => {
    if (cooldownTimer) clearInterval(cooldownTimer);
    currentPhone10 = null;
    status.textContent = "";
    otpStep.style.display = "none";
    phoneInput.disabled = false;
    sendBtn.style.display = "flex";
    phoneInput.focus();
  });

  verifyBtn.addEventListener("click", async () => {
    setCodeError("");
    const code = codeInput.value.trim();

    if (!/^\d{6}$/.test(code)) {
      setCodeError("Enter the 6-digit code we sent you.");
      return;
    }
    if (!currentPhone10) {
      status.textContent = "Please request a code first.";
      return;
    }

    verifyBtn.disabled = true;
    status.textContent = "Verifying…";

    const { error } = await supabase.auth.verifyOtp({
      phone: toE164(currentPhone10),
      token: code,
      type: "sms",
    });

    verifyBtn.disabled = false;

    if (error) {
      status.textContent = "Error: " + error.message;
      return;
    }

    status.textContent = "Logged in ✅";

    // Same first-login profile seeding login.html does — shared helper so
    // the two never drift out of sync.
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const session = sessData?.session;
      if (session?.user) {
        await upsertProfileIfPending(session.user.id);
        await ensureProfileFromPhone(session);
      }
    } catch (_) {
      // Never let profile seeding block the login itself.
    }

    setTimeout(close, 700);
  });

  codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyBtn.click(); });

  googleBtn.addEventListener("click", async () => {
    status.textContent = "Redirecting to Google…";
    // Return to the page the visitor was already on — no need to detour
    // through login.html just to come back.
    const redirectTo = window.location.origin + window.location.pathname + window.location.search;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) status.textContent = "Error: " + error.message;
  });

  // If the visitor signs in elsewhere (another tab) while this is open,
  // don't leave a stale "please sign in" dialog up.
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
    if (shownRecently(config.reappear_hours)) return; // already shown once today

    // Give the page a moment to settle, and never stack under/over the
    // general promo popup if one is currently showing.
    setTimeout(() => {
      waitForWelcomePopupToClear(() => renderPopup(config));
    }, 600);
  } catch (_) {
    // Never let a popup failure break the page.
  }
}
