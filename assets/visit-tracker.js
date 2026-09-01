// assets/visit-tracker.js
//
// Site-wide pageview tracking for the admin Visitor Analytics page — a
// record AhamStree actually owns and can see inside its own admin panel,
// unlike Google Analytics. Wired into hydrateHeaderAuth() in ui.js, which
// every page already calls, so this covers the whole site without
// touching each page individually (same pattern as the welcome popup,
// sign-in popup, and nav dropdowns). checkout.html doesn't call
// hydrateHeaderAuth (it has its own minimal login-gated flow), so it calls
// trackPageview() directly instead.
//
// Fails completely silently on any error — a tracking hiccup must never
// be visible to a real visitor or break the page.

import { supabase } from "./supabase.js";

const TRACK_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/track-visit";
const VISIT_ID_KEY = "ahamstree-visit-id";

// Stable per-browser id, persisted in localStorage — this is what "unique
// visitors" counts against in the admin dashboard. Not a cookie, so it
// resets if the visitor clears site data or uses a different browser —
// that's an accepted trade-off for not tracking via cookies.
function getOrCreateVisitId() {
  try {
    let id = localStorage.getItem(VISIT_ID_KEY);
    if (!id) {
      id = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem(VISIT_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return null; // localStorage unavailable (private mode etc.) — skip tracking this load
  }
}

let _trackedThisPageLoad = false;

export async function trackPageview() {
  // hydrateHeaderAuth() re-runs on every auth state change — only count
  // the actual page load once, not every re-hydration.
  if (_trackedThisPageLoad) return;
  _trackedThisPageLoad = true;

  try {
    const visit_id = getOrCreateVisitId();
    if (!visit_id) return;

    let token = "";
    try {
      const { data } = await supabase.auth.getSession();
      token = (data && data.session && data.session.access_token) || "";
    } catch (_) {
      // not logged in / session check failed — still a valid anonymous visit
    }

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;

    const payload = JSON.stringify({
      visit_id,
      page_path: location.pathname + location.search,
      referrer: document.referrer || null,
    });

    // Plain fetch with keepalive (not sendBeacon) so the optional auth
    // header can be attached — keepalive still lets it complete even if
    // the visitor navigates away immediately.
    fetch(TRACK_URL, { method: "POST", headers, body: payload, keepalive: true }).catch(() => {});
  } catch (_) {
    // never let tracking break the page
  }
}
