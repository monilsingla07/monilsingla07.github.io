# P0 / P1 fixes — 2026-09-01

No push access to the repo this session, so these are files to drop in by hand. Every file here replaces the file of the same name/path in your repo root — nothing renamed, nothing moved.

## What to do

Copy these 7 files into your repo at matching paths, overwriting what's there, then commit and push:

- `checkout.html` → repo root
- `about.html` → repo root
- `index.html` → repo root
- `cart.html` → repo root
- `ahamstree-logo.png` → repo root
- `assets/styles.css` → `assets/styles.css`
- `assets/images/ahamstree-logo.png` → `assets/images/ahamstree-logo.png`
- `assets/images/nisha.jpg` → `assets/images/nisha.jpg`

**Also delete** `assets/images/ahamstree-logo1.png` from your repo — it's an unused duplicate of the header logo (nothing in the code ever referenced it), so I removed it rather than optimize dead weight.

## What each fix does

**checkout.html — P0.** The payment error handler was reading `error.context.json` as a property. It's actually a method on the response object (`.json()`), so it always evaluated to `undefined` and every real failure reason — a coupon already used, wallet balance changed, item gone out of stock, Razorpay declining the card — silently fell through to a generic "Payment setup failed." Now it awaits `.json()` properly and shows the actual reason, matching the pattern already used correctly in `track.html`/`admin-orders.html`/`admin-users.html`.

**about.html — P1.** A missing `</div>` meant the `.container` element was never closed, which was pushing the footer and everything after it into the wrong place in the DOM. One tag added, verified balanced (10 opens / 10 closes).

**index.html + cart.html + assets/styles.css — P1.** The three-column trust strip ("Handwoven by master artisans" / "Complimentary shipping" / "Quality checked", and the cart-page equivalent) uses `flex:1; min-width:220px` (or 180px on cart) with left/right border dividers between items. Below ~660-760px width the columns wrap, and the middle item keeps its left+right borders even after it drops to its own row — so you get a stray boxed-off segment. I added a `.trust-col` class to all six divs (three per page) and a mobile-only CSS rule that clears the side borders and stacks them full-width with a plain top divider instead. Verified by rendering both pages headlessly at a 390px mobile width and reading back the computed styles — confirmed 100% width, no left/right border, clean top-divider-only stacking.

One correction to my original audit: I'd written that this bug hit three pages including `account.html`. Re-checking while I built the fix, `account.html`'s only `min-width:180px` div is a single unrelated element with no divider — not the same bug. It only actually affects `index.html` and `cart.html`, so that's all I touched.

**Images — P1 (performance).** Two things going on here, not just one:

1. A prior round had already built compressed versions of the logo and founder photo and delivered them, but they were never applied to the live repo — it was still serving the original 140KB logo and 498KB photo. Since those old compressed files no longer exist anywhere I could reach this session, I regenerated them from the current originals rather than just re-delivering stale files.
2. While doing that I found something the original audit missed entirely: the root `ahamstree-logo.png` — the file your `Organization` structured data (JSON-LD, read by Google and by anything unfurling a link preview of your site) points to as your logo — isn't your logo. It's a blurry noise/gradient texture, and it's actually a JPEG mislabeled with a `.png` extension. I don't know how it got there, but whatever Google's Knowledge Panel or any tool reading your structured data pulls for "AhamStree's logo" right now is that gradient blob, not the gold saree-woman mark. I replaced it with your real logo, centered on a white 600×600 canvas (a safe, conventional size for a structured-data logo field), saved as a real PNG this time.

Sizes, before → after:

| File | Before | After |
|---|---|---|
| `assets/images/ahamstree-logo.png` (header logo, shown at 230×220) | 140 KB | 15 KB |
| `assets/images/nisha.jpg` (About page photo) | 498 KB | 126 KB |
| `ahamstree-logo.png` (root — schema.org logo, now correct content) | 257 KB | 24 KB |
| `assets/images/ahamstree-logo1.png` (unused duplicate) | 140 KB | deleted |

All four resized/re-encoded, none stretched or cropped oddly — I checked each one visually before shipping it, including the compressed ones side-by-side with the originals.

## What's NOT in this package — needs you, not code

Two P0 items and two P1 items from the audit aren't fixable by editing a file:

- **P0 — Leaked-password-protection toggle.** This lives in the Supabase Dashboard (Authentication → Policies), not in your codebase. It's a two-minute toggle, but I have no way to flip it for you from here.
- **P0 — Legal pages review.** Your Terms/Privacy/Returns pages need an actual read-through by you (or a lawyer) for accuracy and completeness — not something I should be rewriting unilaterally.
- **P1 — "New" badge showing on 0 products / all "New" badges gone.** This traces back to `created_at` timestamps from a bulk import, not a code bug. Fixing it means either deciding which products should carry the badge and adjusting their dates, or changing the badge logic itself — that's a business call, not something I should silently patch by rewriting your product data.
- **P1 — Most of the catalog shows sold out.** Inventory data, not code. Needs your call on what's actually back in stock.

I'm holding off on Priority 2 per your last message — ping me when you want that round.
