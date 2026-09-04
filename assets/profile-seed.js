// assets/profile-seed.js
//
// Shared "first login, seed the saved profile" helpers. Previously these
// lived only inside login.html's inline script, which was fine while
// login.html was the only place a session could be created. Now that the
// WhatsApp-OTP flow can also complete from assets/signin-popup.js (the
// sign-in popup), both places need the exact same seeding logic — so it
// lives here once instead of drifting between two copies.
//
// Never overwrites a field the person already filled in themselves on the
// Profile page — only fills in a blank.

import { supabase } from "./supabase.js";

export async function upsertProfileIfPending(userId) {
  const raw = localStorage.getItem("pending_profile");
  if (!raw) return;

  const pending = JSON.parse(raw);
  localStorage.removeItem("pending_profile");

  // Write profile row (requires RLS policy allowing user to upsert their own profile)
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: pending.full_name || null,
    phone: pending.phone || null,
  });
}

// First time a WhatsApp-OTP phone account signs in, seed the saved-profile
// phone number from the verified auth phone — but never overwrite a phone
// the person already saved themselves on the Profile page.
export async function ensureProfileFromPhone(session) {
  const provider = session?.user?.app_metadata?.provider;
  if (provider !== "phone") return;

  const userId = session.user.id;
  const authPhone10 = String(session?.user?.phone || "").replace(/\D/g, "").slice(-10);
  if (!authPhone10) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("phone")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.phone) return; // already filled in, leave it alone

  await supabase.from("profiles").upsert({
    user_id: userId,
    phone: authPhone10,
  });
}

// First time a Google account signs in, seed the saved-profile name/email
// from what Google gave us — but never overwrite anything the person
// already filled in on the Profile page themselves.
export async function ensureProfileFromGoogle(session) {
  const provider = session?.user?.app_metadata?.provider;
  if (provider !== "google") return;

  const userId = session.user.id;
  const meta = session.user.user_metadata || {};
  const googleName = meta.full_name || meta.name || null;
  const googleEmail = session.user.email || null;
  if (!googleName && !googleEmail) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.full_name && existing?.email) return; // already filled in, leave it alone

  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: existing?.full_name || googleName,
    email: existing?.email || googleEmail,
  });
}

// AhamStree Cash — grants the one-time 1,000-point (₹1,000) welcome bonus.
// Safe to call unconditionally on EVERY login, not just a real first-ever
// signup: the grant-signup-cash edge function calls a DB RPC that only ever
// inserts its ledger row once per user (a partial unique index enforces
// this), so every call after the first is a harmless no-op. This mirrors
// how upsertProfileIfPending/ensureProfileFrom* above are already called on
// every auth state change rather than trying to detect "is this a brand
// new signup" client-side.
export async function grantSignupCashIfEligible(session) {
  const token = session?.access_token;
  if (!token) return;

  try {
    await supabase.functions.invoke("grant-signup-cash", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (_) {
    // Never let a wallet-bonus hiccup block login — worst case the bonus
    // is granted on the next login instead (still idempotent, still safe).
  }
}

// ── Phone helpers — the one place these live. login.html and
// assets/signin-popup.js both import these instead of keeping their own
// duplicate copies (previously duplicated in both files).
export const phoneOk = (v) => {
  const digits = String(v || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return /^[6-9]\d{9}$/.test(digits.slice(2));
  return /^[6-9]\d{9}$/.test(digits);
};

export const normalizePhone10 = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d;
};

export const toE164 = (phone10) => "+91" + phone10;

const CHECK_PHONE_LOGIN_METHOD_URL =
  "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/check-phone-login-method";

// Asks check-phone-login-method which sign-in path to show for this phone
// number. Returns "error" (never throws) on any network/response problem,
// so callers can fail safe — falling back to the normal OTP flow — rather
// than getting stuck with no way forward.
export async function checkPhoneLoginMethod(phone10) {
  try {
    const res = await fetch(CHECK_PHONE_LOGIN_METHOD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone10 }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.status) return "error";
    if (data.status === "otp" || data.status === "pin" || data.status === "linked_elsewhere") {
      return data.status;
    }
    return "error";
  } catch (_) {
    return "error";
  }
}

// Signs in to an existing PIN account. The account's phone identity already
// exists in auth.users — this just supplies the password credential
// attached to it (see saveNameAndPin below).
export async function signInWithPin(phone10, pin) {
  const { error } = await supabase.auth.signInWithPassword({
    phone: toE164(phone10),
    password: pin,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Completes first-time (or reset) PIN setup for the CURRENTLY authenticated
// session — call only right after a successful OTP verify, while that
// session is still active. Saves the name, marks has_pin true, then
// attaches the PIN as this same phone identity's password — no new auth
// identity is created, it's the exact account that just verified via OTP.
export async function saveNameAndPin({ userId, name, pin }) {
  const { error: profileErr } = await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: name,
    has_pin: true,
  });
  if (profileErr) return { ok: false, message: profileErr.message };

  const { error: pwErr } = await supabase.auth.updateUser({ password: pin });
  if (pwErr) return { ok: false, message: pwErr.message };

  return { ok: true };
}
