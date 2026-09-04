# WhatsApp OTP → Name + PIN login, and duplicate-account prevention

**Date:** 2026-09-04
**Status:** Approved, ready for implementation planning

## Problem

Two related gaps in the WhatsApp-OTP sign-in flow (`login.html` and the shared sign-in popup, `assets/signin-popup.js`):

1. **No name/PIN collection.** A first-time WhatsApp-OTP signup lands the visitor straight into a logged-in session with no name and no way to skip a fresh OTP round-trip next visit. Every return visit repeats the full OTP flow.

2. **Duplicate accounts, silently.** Supabase Auth treats each sign-in provider (Google/email vs. phone) as a fully separate identity. If someone's phone number is already saved as contact info on an existing account (most commonly: their Google-based account, via the Profile page), logging in via WhatsApp OTP with that same number does not reuse that account — it creates a brand-new, separate `auth.users` row and session.

   A safeguard already exists (migration `pair_phone_email_uniqueness`, unique indexes `profiles_phone_unique_idx` / `profiles_email_unique_idx`) — but it only protects the `profiles` table from holding two rows with the same phone/email. It does nothing to stop the *login* itself from creating a second identity, and the one write path that does hit it (`ensureProfileFromPhone` in `assets/profile-seed.js`) doesn't check its own upsert's error return — so the conflict is silently swallowed. Net effect, confirmed against live data: a new, blank, nameless `auth.users` row gets created and signed into, with no linked profile, while the person's real account (with their name/orders/wishlist) sits untouched under a different identity.

## Goals

- First-time WhatsApp-OTP signup collects a name and a mandatory 4-digit PIN, so the visitor can skip OTP on return visits.
- Returning visitors who've set a PIN log in with phone + PIN (no WhatsApp round-trip); "Use WhatsApp OTP instead" is always available as a fallback/recovery path.
- A phone number already tied to a *different* account (i.e. saved as contact info on a Google/email-based account, never used to log in via WhatsApp OTP itself) is detected **before** any OTP is sent, and the visitor is guided to their existing account instead of getting a second, disconnected one.
- Existing WhatsApp-OTP accounts that predate this feature (currently 3 real users) are folded into the same flow the next time they log in — prompted for name + PIN once, not treated specially.
- Same popup component and same underlying helper functions used by both `login.html` and `assets/signin-popup.js` — no duplicated logic between the two entry points (matches the existing `assets/profile-seed.js` sharing pattern).

## Non-goals

- No automatic merging of two *already-existing*, fully separate accounts (e.g. someone who already has both a Google-based account and a separate phone-OTP account from before this fix). That is a materially bigger feature (deciding which account is primary, reassigning orders/wallet/wishlist/addresses, proving ownership of both) and is explicitly out of scope here. The one concrete case that exists today (the site owner's own admin account plus a phantom phone account) will be cleaned up by hand, once, via direct SQL — not through new product code.
- No change to Google OAuth login, or to `profile.html`'s existing manual phone/email-save conflict handling (already correct — surfaces the unique-index violation as a friendly warning).

## Schema change

```sql
alter table profiles
  add column has_pin boolean not null default false;
```

Rationale for a new explicit column rather than inferring from Supabase's internal password field: verified live against the database that `auth.users.encrypted_password IS NOT NULL` is **true for every phone-auth user already**, including ones that have never set a PIN — Supabase's phone-OTP signup path seeds some internal placeholder there. That field is not a usable signal for "has this person completed PIN setup," so an explicit, application-owned flag is required.

## New edge function: `check-phone-login-method`

Public (no auth required — it has to run before any session exists), POST only, request body `{ phone: "9876543210" }` (bare 10 digits; reject anything else with 400).

Server-side (service-role client, since this must join across `auth.users` and every `profiles` row, not just the caller's own):

```sql
select p.user_id, p.has_pin, au.phone as auth_phone
from profiles p
join auth.users au on au.id = p.user_id
where p.phone = :phone10
```

Response is exactly one of:

| DB result | Response | Client behavior |
|---|---|---|
| No row | `{ status: "otp" }` | Send WhatsApp OTP as today |
| Row found, `auth_phone` matches this number (this account *can* log in by phone), `has_pin = false` | `{ status: "otp" }` | Send WhatsApp OTP as today — this is the account's own not-yet-onboarded phone identity (covers both brand-new signups and the 3 pre-existing phone-only accounts) |
| Row found, `auth_phone` matches this number, `has_pin = true` | `{ status: "pin" }` | Show the PIN field, skip OTP entirely |
| Row found, `auth_phone` is null or does not match (phone is saved as contact info on a non-phone-auth account) | `{ status: "linked_elsewhere" }` | Do **not** send an OTP. Show: "This number is already linked to an AhamStree account. Please log in the way you originally signed up (e.g. Google)." No email/provider specifics are revealed — only the fact that it's taken. |

Never reveals a name, email, or user id — only one of the three status strings. This keeps the endpoint safe to call pre-auth without leaking account data, beyond the unavoidable "is this number registered at all" signal (a `status: "otp"` for a genuinely new number is indistinguishable from a not-yet-onboarded existing phone account, and `linked_elsewhere` reveals nothing about *which* account).

**Rate limiting:** same shape as `send-whatsapp-otp-hook`'s existing abuse policy (per-phone rolling window + a global hourly cap), reusing that function's pattern rather than inventing a new one — this endpoint is a plausible target for phone-number enumeration otherwise. A new small log table (or reuse `otp_send_log` with a `kind` column distinguishing "otp_send" vs "login_method_check") backs the counters. Exact thresholds: default to the same `OTP_MAX_PER_PHONE_10MIN`/`OTP_MAX_GLOBAL_PER_HOUR`-style envs, separate env var names so the two can be tuned independently.

## Login/signup flow (both `login.html` and the sign-in popup)

All steps happen inside the existing popup UI pattern (or `login.html`'s equivalent full-page panel) — no new page.

1. **Phone entry** (existing step, unchanged input/validation). On submit, call `check-phone-login-method` first, *before* anything else:
   - `"otp"` → proceed to WhatsApp OTP send, exactly as today.
   - `"pin"` → show a PIN field (4-digit, numeric input) instead of triggering an OTP send.
   - `"linked_elsewhere"` → show the guidance message in place, no OTP sent, no session created.

2. **PIN path:** submit calls `supabase.auth.signInWithPassword({ phone: "+91" + phone10, password: pin })`.
   - Success → logged in, done (same post-login redirect logic `login.html`/the popup already have).
   - Failure (wrong PIN) → inline error, PIN field stays, plus a persistent "Forgot PIN? Use WhatsApp OTP instead" link that switches to the OTP path for this same number.

3. **OTP path:** unchanged send/verify UI. On successful `verifyOtp`:
   - Look up (or rely on the `check-phone-login-method` result already fetched in step 1) whether `has_pin` is true for this account.
   - `has_pin = true` — this shouldn't normally happen (PIN accounts skip straight to the PIN field), but if it does (e.g. they chose OTP explicitly via "forgot PIN"), treat verification as authorization to **reset** the PIN: go to step 4 in "set a new PIN" mode.
   - `has_pin = false` — mandatory step 4 in "first-time setup" mode.

4. **Name + PIN step** (new, mandatory, cannot be dismissed without completing):
   - Two fields: Name (text, required, non-empty) and PIN (4-digit numeric, required, plus a confirm-PIN field to catch typos).
   - On submit: `profiles` upsert with `full_name` and `has_pin: true`, then `supabase.auth.updateUser({ password: pin })` on the current (already-authenticated, just-OTP-verified) session — attaches the PIN as that same phone identity's password, no new identity created.
   - Both writes must succeed before the popup closes/redirects; surface a plain error and let them retry on failure (matches this codebase's existing "don't leave the user in a half-done state silently" pattern used elsewhere, e.g. the product-editor's save-retry messaging).

## Shared code

New logic lives in `assets/profile-seed.js` (already the shared home for phone/Google profile-seeding helpers used by both entry points) or a new sibling module if it grows large enough to warrant its own file — decided at implementation time based on actual size, not upfront. Both `login.html` and `assets/signin-popup.js` call the same functions; no copy-pasted flow logic between them.

## Display formatting

Wherever this new UI echoes the phone number back (confirmation text, error messages), it displays the bare 10-digit form — consistent with every other place in the codebase that already does this (`profiles.phone`, `orders.customer_phone`, the `wa.me/...` action links). No change needed elsewhere; this was already the norm, the one place it wasn't was the root-cause bug above, which this design fixes at the source rather than by reformatting a symptom.

## One-time manual cleanup (not part of the shipped feature)

Once this is live, merge the site owner's phantom phone-account (`auth.users.id = 466755ca-7646-4b43-aec1-9c69618c98f8`, phone `918860004787`, no profile row) into their real admin account (`c5bff837-9a63-4c95-802f-0fe22b67751b`, email `monilsingla07@gmail.com`, profile already has `full_name` and `phone` set). Concretely: confirm the phantom account has no orders/wallet/wishlist rows of its own (expected — it was never used beyond the accidental login), then delete the phantom `auth.users` row via the admin API. Done by hand via `execute_sql`/Supabase admin API at the end of implementation, not scripted as a repeatable migration (this is a one-off, not a general merge tool — see Non-goals).

## Testing

- Extend the existing Playwright regression suite (`tests/`) with: phone-entry → OTP path for a brand-new number (mocked/skipped where it would require a real WhatsApp send — same constraint the suite already documents for OTP/Google), and a check that `check-phone-login-method` returns the correct status for each of the three DB states (covered as an API smoke test against a project the same way `10-public-api-smoke.spec.js` already tests other public functions, using disposable test rows rather than real user data).
- Manual verification against the live site for the actual OTP round-trip and PIN set/login cycle (WhatsApp delivery can't be automated in CI).
