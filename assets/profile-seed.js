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
