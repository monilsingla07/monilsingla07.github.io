# AhamStree UI/UX Audit — 2026-10-24

**Type:** Read-only static review. Nothing was changed, committed or deployed. Every implementation item below needs approval first.
**Scope:** 30 customer-facing pages in `site/` (admin, `print-labels.html`, `admin-print-agent.html` excluded), `assets/styles.css`, `assets/ui.js`, and the interaction scripts that affect UX.
**Method and limits:**
- I read the HTML and CSS directly. I did not run Lighthouse, Playwright or a browser, and I did not check the live site.
- Contrast ratios are hand-computed with the WCAG relative-luminance formula from the CSS values. Where opacity stacks, I compute the blended colour.
- Touch-target sizes are computed from CSS (padding + font size x line-height + border). Treat them as +/- 2px and confirm in DevTools.
- Performance and CLS statements are hypotheses with a stated validation method. They are not measurements.
- I read in full: `index`, `product`, `cart`, `checkout` (markup plus validation and payment logic), `success`, `cancel`, `search`, `login` (markup), `track`, `shipping`, `returns`, `contact`, `about`, `stores`, `404`, `wishlist` (partial), `orders` (markup plus return modal), and the listing-page markup and CSS in `products`.
- `new-arrivals`, `sale`, `collection`, `collections`, `blog`, `blogs`, `help`, `privacy`, `terms`, `cookies`, `account` and `profile` were spot-checked via grep and shared patterns. Those sections are marked **[inferred]** where a finding comes from the shared template rather than a full read.
- The ui-ux-pro-max search ran for 2 of the 10 allowed queries (forms/checkout, touch/focus). It confirmed that WCAG 2.2 AA target size is 24 CSS px (SC 2.5.8) and that 44px is platform guidance, so this document labels the two separately.

---

## 1. Executive summary

AhamStree has a calm, credible visual identity: serif headings, restrained colour, flat sharp-cornered cards, and sensible product-card image handling (`srcset`, aspect-ratio, lazy loading). The weak points are not aesthetic. They are in the purchase path and in accessibility fundamentals, and they cost real orders. The five issues below are ranked by likely conversion impact.

1. **Checkout is gated behind a login (UX-005) and is laid out so that on a phone the "Pay with Razorpay" button comes before the order total and the coupon field (UX-002).** A first-time buyer must create an account via WhatsApp OTP and then commit to pay before seeing the final amount.
2. **The checkout trust strip promises "Easy 7-day returns" while the Returns policy, the order-return modal and the help page all say returns are accepted only for manufacturing defects within 48 hours (UX-003).** This is a credibility and dispute risk at the most sensitive moment.
3. **Search only matches product title and description (UX-007), although the placeholder says "fabrics, colors".** A shopper typing "mustard" or "cotton silk" gets nothing, and the PDP and listing cards show no colour or fabric to compare with (UX-038).
4. **Checkout fields have labels that are not programmatically linked to their inputs (UX-001), the Pay button is silently disabled until every field is valid, and errors appear in a distant box that is never announced (UX-006).** Screen-reader and autofill users, and anyone on a small screen, cannot tell what is wrong.
5. **Keyboard and assistive-technology support has gaps that affect every page: no visible focus style on inputs (UX-004), no `lang` attribute on 28 pages (UX-008), no `main` landmark or skip link (UX-009), a product zoom gallery that cannot be reached by keyboard (UX-010), and an auto-advancing hero with no pause control (UX-012).**

Secondary themes: the fixed header is about 187px tall on desktop and 84px on mobile, and it is injected by JavaScript after a third-party ESM download (CLS and slow-network risk, UX-015 and UX-026). The Hindi logo becomes roughly 12px tall on phones (UX-014). The wishlist, account and order-tracking links are not reachable in the mobile menu (UX-016). Policy-critical information (returns, delivery) is missing from the product page (UX-023). The CSS carries three coexisting maroon/orange brand colours and three font families (section 2).

This audit contains 67 backlog items: 5 Critical, 25 High, 28 Medium and 9 Low. Section 7 groups them into seven shippable batches.

---

## 2. Design system and brand consistency

### 2.1 Design-token inventory (`:root` in `assets/styles.css`)

| Group | Defined today | Assessment |
|---|---|---|
| Fonts | `--font-body` (DM Sans, Outfit, system), `--font-heading` (Cormorant Garamond, Georgia) | Outfit is only a fallback in the stack, and the Google Fonts request for Outfit is made only on `index.html`. See 2.5. |
| Surface/background | `--bg #fff`, `--bg-warm #fbf3e9`, `--surface #fff`, `--surface-warm #fff` | `--surface-warm` is identical to `--surface` and is dead weight. `--bg` and `--surface` are the same value, which is correct after the white-background change but means cards cannot be told apart by fill. |
| Text | `--text #1a1a1a`, `--text-light #6b6b6b` (5.33:1 on white), `--muted rgba(26,26,26,.6)` | OK. `--muted` has no consumers I could find, and opacity is also applied ad hoc through `.small` (.75) and inline `opacity:.6-.9`, which stacks (see 2.6). |
| Border | `--border #e8ded2`, `--border-light #f2ece2` | `--border` against white is 1.33:1. That is fine for decorative dividers but fails WCAG 1.4.11 when it is the only boundary of an input or control (UX-030). |
| Brand (orange) | `--brand #b5502f`, `--brand-hover #96401f`, `--brand-dark #74331f`, `--brand-light/-lighter`, `--shadow-brand` | The working primary for buttons, links, prices, badges and focus. White on `#b5502f` is 5.05:1 (passes). |
| Brand (maroon) | `--brand-maroon #5F1D28` | Used only by the topbar. |
| Gold | `--gold #b5502f` (an alias of the orange!), `--accent-gold #b8863b` | `--gold` is not gold. It is the same orange under a misleading name, and `.btn` uses it. `--accent-gold` is a real gold, and it fails as text on white (3.23:1) and as a white-on-gold fill (3.23:1). |
| Indigo/espresso | `--indigo #2f4858`, `--espresso #2f4858`, `--espresso-dark #111111` | `--espresso` is a blue-grey, not espresso. The footer gradient runs from this blue-grey to near-black, a third hue family unrelated to the maroon or orange. |
| Spacing | `--space-xs..2xl` = 4/8/16/24/32/48 | Nearly unused. The code uses 6, 10, 12, 14, 18, 20, 22, 26, 28, 44, 46, 60 and 72 px freely, and `.section` margins are hard-coded at 72 and 46. |
| Radius | `--radius-sm/md/lg: 0` | The system is flat. But 999px (17 uses), 20px (11), 12px (6), 14px (5), 18px (4) and 40px (3) are hard-coded, so `success`, `cancel`, `track`, `stores`, `404`, `search` and the popups look like a different brand (cards at 12-20px radius). |
| Shadow | xs/sm/md/lg/brand | Fine. |
| Layout | `--header-offset: 120px` (overwritten at runtime by JS) | The fallback is 120px but the real header is about 187px on desktop (hypothesis, see UX-015/UX-026). |

**Missing tokens** that currently appear as hard-coded values:
- **Semantic status colours.** Hard-coded: `crimson`, `#166534`, `#b45309`, `#b91c1c`, `#c0540a`, `#9a3412`, `#a13d3d`, `#3f6b4f`, `#64748b` (a Tailwind slate that appears 8x in HTML), `#92400e` and others.
- **Focus ring.**
- **Type scale.** Font sizes are scattered from 9px to 86px (4.8rem), including 9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15 and 16px.
- **Breakpoints.** At least 10 distinct values are used: 980, 900, 860, 820, 768, 700, 640, 600, 560 and 480.
- **z-index scale.** Values in use: 500, 900, 1000, 1100, 1200, 2000, 3000 and 9999.
- **Motion.** Durations of .14, .15, .16, .18, .2, .22, .25, .28, .3, .45, .5, .6 and .7s and several different easings.
- **Control height.** Heights found: 34 (weave pill), 36, 38, 40, 42, 44 and 48.

### 2.2 Logo and brand coherence after the recent changes

- **Mark.** `assets/images/ahamstree-logo.png` is a maroon Devanagari wordmark "अहम् स्त्री". The PNG is roughly 700x500 with about 60% of its height as empty padding. At the header's `height:76px` on desktop the glyphs are about 28px tall. At the mobile `height:34px` (30px at <=480px) the glyphs are about 12px tall, and the Devanagari headline, conjunct and matras (the small marks that distinguish letters) are at the edge of legibility. Hypothesis: the mobile logo reads as a smudge, and brand recognition falls on exactly the devices that drive most Indian e-commerce traffic. Validate it on a real 360px-wide Android device.
- **Accessible name.** The `<img alt="Ahamstree">` and `aria-label="Ahamstree home"` are Latin, but the visible mark is Hindi. Sighted and screen-reader users receive different brand names. Use `alt="AhamStree (अहम् स्त्री)"` or similar.
- **Latin wordmark elsewhere.** The footer says "AhamStree / Eternally Elegant" in Latin, and the mobile drawer title says "AhamStree". The brand now has two spellings and two scripts without a stated rule. Decide whether the Hindi mark is primary and the Latin name a descriptor, or the reverse.
- **Three maroons.** The logo PNG is about `#6A1A33`, `--brand-maroon` is `#5F1D28`, and `products.html`'s hero gradient uses `rgba(110,34,54,.06)`. They are close but not identical.
- **Metadata.** The JSON-LD `logo` points at `/ahamstree-logo.png` (site root). Confirm it is the new Hindi mark, not the old logo. The root also holds an `ahamstree-logo1.png` copy in `assets/images`.
- **Topbar.** `#FFF9F0` on `#5F1D28` computes to about 11.9:1, so it passes comfortably. The topbar links at `rgba(255,255,255,.82)` are about 8.6:1. The ribbon works.

### 2.3 Spacing-scale consistency

The tokens exist but nothing enforces them. Evidence: `.container` padding is 16px (12px at <=820px), `.section` margin is 72px (46px at <=560px), `.card .p` uses `--space-md`, and checkout uses `padding:16px` inline 79 times. Standard card padding is 12 (product cards), 14, 16, 18, 22, 24, 28 and 32 across pages. Recommendation: map to a 4/8-point scale (4, 8, 12, 16, 24, 32, 48, 72) and replace inline paddings with a few utility classes (UX-053).

### 2.4 Colour system — maroon brand vs. `--brand #b5502f` orange

This is a real conflict, not a cosmetic one:
- The only maroon use is the 30px topbar ribbon. Everything interactive is orange: CTAs, prices, badges, active tabs, links, wishlist heart, filter-tab fill, focus tint and the `AhamStree Cash` chip.
- The Hindi logo is maroon. So the logo (maroon) and the primary button (terracotta orange) sit within 80px of each other in the header. They are neither complementary nor identical, and the footer adds a blue-grey.
- Maroon `#5F1D28` would read as premium for prices, links and CTAs (white on it is about 12:1, much stronger than the orange's 5:1) and gives headroom for hover and disabled states.
- **Decision for the brand owner (Section 8):** is the orange being retired? If yes, the migration is mechanical (change `--brand`, `--brand-hover`, `--brand-light`, `--shadow-brand`, and about 15 hard-coded `rgba(181,80,47,...)` values), and `--gold` should be removed. If no, state in the style guide that maroon is the brand colour and orange is the action colour, and give maroon a job (headings or footer).
- Whichever is chosen, rename tokens by role (`--color-action`, `--color-brand`, `--color-accent`) so a future change is a one-line edit.

### 2.5 Typography — Cormorant Garamond + DM Sans + Outfit

Yes, one too many, and it is cheap to fix.
- **Outfit is dead weight.** It is listed only as the second fallback in `--font-body` and is requested only on `index.html` (500 weight range 300-700 x 5). The first font, DM Sans, is always available once loaded, so Outfit is never rendered unless DM Sans fails. Remove it from `index.html` and from the stack. The homepage is where first-time and slow-network users arrive, so the extra stylesheet-driven font download is paid by the most important page.
- **Weight and style cost.** Cormorant Garamond loads 6 styles (400/500/600/700 + italic 400/600) and DM Sans loads 4 weights + italic with the variable optical-size axis. Trim to what is rendered: Cormorant 500/600 (+ italic 500 for the testimonial pull-quotes), DM Sans 400/500/600/700. Use `font-display: swap` (already set). Consider self-hosting for the CSS round trip (UX-050).
- **Devanagari.** The brand mark is Hindi, but neither Cormorant nor DM Sans contains Devanagari glyphs. Any Hindi UI text will silently fall back to a system font (e.g. Noto/Mangal) with mismatched weight. If Hindi copy is planned, add Noto Serif/Sans Devanagari to the stacks and test line-height (Devanagari needs about 1.6+).
- **Type scale.** Body is 15px on `body` but 14px on inputs/cards, 13px on filter chips and 9-11px on badges. Define a scale (12, 14, 16, 18, 22, 28, 36, 48) and set the minimum body-adjacent text to 12px (UX-056).
- **Heading semantics.** Several pages use `<h2>` as the first heading or a `<div>` (product title) and the heading font is applied to them only by class (UX-011).

### 2.6 Opacity as a colour system (a hidden contrast problem)

`.small{opacity:.75}` is combined with inline `opacity:.6` to `.9` and with parents that also set opacity (for example `.pd-meta{opacity:.72}` wrapping `.small` children, which makes the SKU and stock line .54 effective opacity and about 3.8:1 on white at 12px). Opacity stacks multiplicatively and cannot be audited from the tokens. Replace with explicit colours (`--text-light`, `--text-muted`) and reserve opacity for disabled states (UX-017).

---

## 3. Per-page findings

Legend: **[V]** verified from source, **[I]** inferred from shared template or pattern.

### 3.0 Shared shell (applies to every page)

- **Header** (`ui.js` -> `renderHeader`): fixed, `position:fixed`, z-index 1000, topbar (about 30px) + logo row (76px logo + 18px x 2 padding) + nav row (about 45px) = about 187px on desktop. Mobile: topbar + 34px logo row = about 84px. The page's `padding-top` is `var(--header-offset,120px)` and is corrected by JS after load. This is a likely CLS source and a heavy fixed bar on desktop (about 24% of a 768px-tall laptop viewport).
- **No skip link, no `<main>`, no `<html lang>`** on 28 of 30 pages. `about.html` and `404.html` have `lang`; `404.html` and `account.html` have `<main>`.
- **Header and footer are JS-rendered.** If the ES-module graph fails (the chain is `ui.js` -> `supabase.js` -> `https://esm.sh/@supabase/supabase-js@2.112.4`), the page has no navigation and no footer at all. On a slow connection the header appears late (UX-026).
- **Focus:** no `:focus-visible` rule exists in the CSS (grep count 0). Links and buttons fall back to the browser default ring, which is acceptable. `.input`, `.pd-qty-input` and `.search-input` set `outline:0`/`none` and replace it with a faint border tint (about 2:1) (UX-004).
- **Touch targets in the header:** `.icon-btn/.icon-link` 40x40 (36x36 at <=480px), `.mobile-drawer-caret` 34x34, topbar links about 18px tall (hidden on mobile), nav links 13.5px text with 2px padding about 22px tall.
- **Mobile drawer:** good dialog behaviour (focus moves in, Tab is trapped, Escape closes, focus returns). It does not contain wishlist, account, login or track-order links (UX-016).
- **Hover-only submenus:** desktop `.nav-submenu` opens on `:hover` / `:focus-within`. Between 821px and about 1100px (tablets) the desktop nav shows but there is no hover on touch (UX-055).
- **Popups:** `ui.js` mounts a welcome popup and a sign-in popup on every page. Both are `role="dialog" aria-modal="true"` with Escape handling, but see UX-024.
- **Footer** (`renderFooter`): link-only columns at 13.5px (about 22px tall hit areas, 14px apart; passes WCAG 2.5.8 spacing exception, below 44px guidance). Payment "chips" are plain text spans, not logos. Copyright line is about 3.6:1 (UX-019). Footer link hover colour is `--brand-hover #96401f` on a dark gradient, about 2.3:1 (UX-019).
- **Trust elements in the shell:** "Complimentary shipping across India" in the topbar (admin-managed). No business identity (address, GSTIN, phone) in the footer. No policy links beyond Terms, Privacy, Cookies, Shipping, Returns and FAQ.
- **Floating WhatsApp CTA:** present only on `index.html` (`.floating-cta`). It is absent on PDP, cart and checkout, where help matters most (UX-049).

### 3.1 `index.html` (homepage) [V]

- **Visual hierarchy:** the structure runs hero -> text-only trust strip -> two category tiles -> New Arrivals -> Curated Collections -> "Most loved" -> Instagram reels -> testimonials. Sections have kicker + serif title + "See more" link, which is clear. The hero is 88vh (min 520, max 860) on desktop, so the first product row is below the fold on a laptop. The trust strip is 13.5px grey text without icons, quiet and easy to miss.
- **Mobile-first:** hero is `82vw` (min 320px) on phones, good. The hero subtitle is hidden below 480px. Category tiles are 100px tall on phones (cat-tile min-height 100). Product grid is 2-up. The `.trust-col` stacks with divider lines, which works.
- **Touch targets:** hero dots 7x7px (active 22x7), the worst on the site (UX-013). `.section-link` about 35px tall. `.p-card-wish` 30x30 (UX-031). Reel strip tiles are 340px wide with iframes (embedded Instagram) that take focus.
- **Accessibility:** no `lang`, no `main`. **No static `h1`.** The only `h1` is the first hero slide title, injected from an admin-managed API, so if there are zero slides the page has no `h1` at all (UX-011). The hero carousel auto-advances every 6.5s with no pause control and no pause on hover/focus (WCAG 2.2.2, level A) (UX-012). The carousel track uses `scroll-snap`, and off-screen slides keep focusable CTAs (they are not `inert`). Hero dots use `aria-current` but are not grouped as a carousel region. `role="tablist"` is on the dots container, but there are no `role="tab"` children (ARIA misuse). Testimonial stars are `★★★★★` text with no accessible rating.
- **Performance:** the LCP candidate is the first hero image, but it is only discovered after JS loads, then a Supabase edge-function fetch returns the slide list (`get-active-hero-slides`). The `fetchpriority="high"` is correctly set, but the waterfall (HTML -> module graph -> esm.sh -> API -> image) means the browser cannot preload it (UX-027). Product cards use `srcset`/`sizes`, intrinsic width/height via `cardImageAttrs`, `loading=lazy` and `decoding=async`, which is good. All three product grids and the reel strip load after JS (skeletons present, which helps CLS). The Google Fonts request includes Outfit (unused; UX-050). GTM/GA loads in `<head>` as `async`.
- **Trust:** has 3 factual claims (handwoven by master artisans; complimentary shipping; quality checked before dispatch). Testimonials are admin-managed (hidden if none), which is the right approach. The "Most loved" / "Customer Favourites" label is driven by `view_count` (page views), not sales or favourites (UX-067). Missing: about/artisan provenance link, policy links near the trust strip, a visible returns summary.
- **States:** skeletons for hero, category tiles, grids. Error fallback in `home.js` is plain text "Could not load collections." with no retry. Sections hide on empty (testimonials, reels).

### 3.2 `products.html` (listing) [V for markup and CSS, I for script]

- **Visual hierarchy:** a serif `h1` hero, then category tabs (Cormorant 20px) and weave pills, then a filter pill bar, then the grid. Clear and consistent with the flat style. Active state combines an underline (category) and gold fill (weave pill).
- **Mobile-first:** below 700px the filter bar is replaced by two buttons (Filters / Sort) that open a bottom sheet with 44px-min options and a sticky "Show N results" footer. This is a strong pattern. Weave pills scroll sideways with a hidden scrollbar, with no edge fade to signal more.
- **Touch targets:** weave pill 34px high, filter pill 38px, `.p-card-wish` 30x30, category tab about 38px. The mobile sheet options are 44px (good).
- **Accessibility:** `role="tablist"` is applied to `<a>` links (category) and `<button>` pills (weave) with no `tabpanel`, so the pattern is semantically wrong (UX-036). The filter pill panel uses `role="menu"` for checkbox lists (should be a disclosure with a group). The sheet is `role="dialog" aria-modal="true"` but I could not confirm focus trapping [I]. `aria-pressed` on the heart is good. The weave pill active state is white on `#b8863b` at 3.23:1 (13px semibold, fails 1.4.3) and its hover state is gold text on white at 3.23:1 (UX-018). No `aria-live` region for the "N items" count or the status line (UX-037). Sort `<select>` has `aria-label` (good).
- **Performance:** images lazy, sized, `srcset`. 8 skeletons and infinite scroll via sentinel with a "Load more" fallback button (good). Risk: first page of products is fetched after JS and Supabase, so LCP is the first card image (UX-027).
- **Trust:** none on the listing (no policy line, no shipping line). Cards show price, sale price, "New" / "Sold out" / "Only N left" and a sale % badge. No colour or fabric on the card (UX-038).
- **States:** skeleton on first load. Empty is `status.textContent = "No products found."` in 12px grey with no "Clear filters" CTA (UX-035). Error is `"Error: " + error.message`, which shows raw database text to shoppers (UX-035).

### 3.3 `collection.html` [V partial]

- **Hierarchy:** hero with `h1` (rendered from the collection name, two variants) and the shared `.p-card` grid. Consistent with `products.html`.
- **Mobile:** inherits the grid; sort/filter tools are not present (collection pages are short).
- **Touch/A11y:** same `.p-card-wish` 30x30; the status line is a plain `div` with no live region. Two `h1` literals exist in the script (one is probably the with-image variant); verify only one renders at a time [I].
- **Performance:** `loading=lazy` once, not on all images [I].
- **Trust:** none. **States:** "Missing collection slug.", "Collection not found.", `"Error: " + error.message` (raw), and a styled empty state "No products yet" (good, but no CTA). The text for missing/not-found is a bare `small` line with no way out (no "Browse all sarees" link) (UX-035).

### 3.4 `collections.html` [V partial]

- **Hierarchy:** serif `h1` "Curated *Collections*" hero, then tile grid. Has styled empty ("No collections yet") and error states with the `collections-empty` class. Good state coverage compared with the rest of the site.
- **A11y/performance [I]:** tiles are `a` links with background or `<img>`; one `<img>` without lazy loading found in markup. Tile hover relies on colour change only (no `:focus-visible` style).
- **Trust:** none needed. **States:** present (empty, error).

### 3.5 `new-arrivals.html` [I]

- Same listing template as `sale.html` and `products.html`: serif hero, `.p-card` grid with "New" badge (60-day window from `created_at`), `loading=lazy` once. Raw `"Error: " + error.message`. No filters or sort. Shares UX-035, UX-037 and UX-031.
- The "New" badge window (60 days) is a business rule shown to users without explanation. Fine, but a shopper cannot sort by newest (it is the default order).

### 3.6 `sale.html` [V partial]

- **Hierarchy:** `h1` "End of Season **Sale**" with sub "while stocks last". Sale price in brand orange with struck-through MRP and a "% OFF" badge (top-right, 46px below the corner, under the heart).
- **A11y:** the struck-through original price is `#6b6b6b` on white (5.33:1, passes). White on `#b5502f` badge text is 5.05:1 but 9px bold (below any comfortable minimum, UX-056).
- **Trust/honesty:** copy says "Limited-time offers ... while stocks last". There is no countdown, which is good. Decision for the owner: is "End of Season Sale" an actual defined period? If it is permanent, the label could erode trust (see Section 8).
- **States:** raw error string (UX-035). Empty state not verified [I].

### 3.7 `search.html` [V]

- **Hierarchy:** clear `h1`, sub copy, a large input (18px, 16px 20px padding about 62px tall), quick-link chips, results grid. Good.
- **Mobile:** input font is 18px (no iOS zoom). Results grid is 2-up from 768px.
- **Touch:** quick-link chips about 38px tall (9px padding + 13px text).
- **A11y:** the input has **no `<label>` or `aria-label`** (placeholder only, WCAG 3.3.2/4.1.2) and sets `outline:none`; focus is signalled by a border colour change to `#b5502f` (5.05:1 against white, which passes 1.4.11, so this one is acceptable). `autofocus` pulls focus on load and skips announcing the page title. The magnifier SVG is decorative but sits `position:absolute` over the input with no `aria-hidden`. Results and counts have no `aria-live` (UX-034/UX-037). Radius is 12px (inconsistent with the flat system). The search is limited to `title` and `description` (UX-007) and capped at 20 results with no pagination.
- **Performance:** debounced; no results above the fold to lazy-load.
- **Trust:** none. **States:** has a prompt state (quick links), a "searching" status and presumably "no results" copy [I]. No suggestions, no "did you mean", and no recovery links on zero results beyond the prompt's quick links [I].

### 3.8 `product.html` (PDP) [V]

- **Visual hierarchy:** left gallery with vertical 80x100 thumbs, right column: title, SKU/stock, price, spec strip, shipping note, qty, Add to cart (outline), wishlist heart, Buy it now (solid), View cart link, trust icons, pincode check, tabs, offers. Buy it now (solid) over Add to cart (outline) is a clear hierarchy. The price is brand-orange 22px bold. Spec strip (colour, material, craft) is well placed above the buy buttons. Sale % badge on the image.
- **Mobile-first:** single column, sticky bottom bar (`pd-mobile-bar`) with price + Add to cart once scrolled. Thumbs become a horizontal strip (62x78). Main image max-height 480px. Good. Gaps: the sticky bar adds only "Add to cart", with no "Buy now". The bar and the WhatsApp CTA would overlap if the CTA were added here. "Click image to zoom" hint text is shown on touch devices where the lightbox hint says "Double-tap to zoom".
- **Touch targets:** `.pd-qty-btn` about 42x38 and `.pd-qty-input` 44x37 (UX-032); `.pd-tab-btn` about 38px high; `.pd-delivery-btn` about 39px; delivery input about 37px high; thumbs OK (80x100 / 62x78); wishlist icon 48 wide OK; lightbox buttons about 40x42 and **have no accessible names** (they render "✕", "‹", "›").
- **Accessibility:**
  - There is **no `h1`**: the title is `<div id="title" class="pd-title">` (UX-011).
  - **The main image is an `<img>` with a click handler only**, so it is not focusable or operable by keyboard. The zoom lightbox is therefore unreachable without a pointer (WCAG 2.1.1 level A) (UX-010). The lightbox container has `aria-hidden` but no `role="dialog"`, `aria-modal`, label, focus move on open, focus trap or focus return. Escape does close it.
  - Qty `−`/`+` buttons have no `aria-label` and the qty input has no label (the cart page has them; the PDP does not) (WCAG 4.1.2, 3.3.2).
  - The info tabs are buttons with an `.active` class, with no `role=tab/tablist/tabpanel`, no `aria-selected` and no arrow-key support.
  - **Contrast:** the struck-through MRP (`.pd-price-mrp`, brand orange at `opacity:.55` over white, 14px) is about **2.3:1** (fail). The SKU and stock text sit inside `.pd-meta` (opacity .72) and `.small` (opacity .75), about **3.8:1** at 12px (fail). Stock is key information ("5 available", "Sold out") (UX-017).
  - The pincode input font is 13.5px, so iOS Safari zooms the page on focus, because the `.input` 16px-on-mobile rule is overridden by the later `.pd-delivery-input` rule (UX-041).
  - Result text uses inline colours (`crimson`, `#64748b`, `#9a3412`, `#166534`) as the only status signal beside the message, which is acceptable because the message text carries the meaning. There is no `aria-live`.
  - Sold-out and discontinued states rewrite the button label and apply inline grey (`#ddd`/`#666` at 4.2:1 is exempt as disabled).
- **Performance:** the `#content` block is `display:none` until Supabase returns the product, so the whole page body is empty "Loading…" text until then, and the LCP image is not requested until after the data fetch (UX-028). `#mainImg` has no `width`/`height`/`aspect-ratio` (the container is a flex box with `height:auto` image, `max-height:780px`), so the gallery height jumps when the image loads (CLS). Thumbs correctly use `thumb_url`, `loading=lazy`; neighbours are preloaded (good). Related products load via a second and third query.
- **Trust:** has the 3-claim icon row, a "Quality checked" line and an estimated-delivery line ("3-5 business days across India", which matches `shipping.html`), a live pincode serviceability check, and live coupon offers. **Missing:** returns/exchange summary (the checkout promises "7-day returns" while policy is defect-only/48h; UX-003), fabric-care block (only if an admin authored a tab), any product-level reviews or ratings (none exist; not proposing fake content; see Section 8), and no mention of the colour variation notice from the Returns policy.
- **States:** "Product not found." as a bare line with no link back; "Could not load specifications."; sold-out / "Max qty already in cart" button states; **Add to cart immediately navigates to `cart.html`** with no confirmation, and Buy it now goes straight to checkout (UX-025). `alert()` is used for wishlist errors (UX-046).

### 3.9 `cart.html` [V]

- **Hierarchy:** `h1` "Your cart", line items (96px thumb, title, price, qty pill, Remove, line total), a summary card, Checkout primary + Clear cart secondary. Clear.
- **Mobile:** summary is `max-width:420px;margin-left:auto`, stacks fine. On <=480px `#summary .row` becomes a column with full-width buttons. Good.
- **Touch:** qty buttons about 42x38; **Remove is about 39px** tall; `Clear cart` sits beside Checkout, so a mistap on the wrong button clears the cart.
- **A11y:** qty controls have `aria-label`s (good). The product thumbnail and title are two links to the same destination (redundant tab stops), both with `target="_blank"`, which opens a new tab from the cart (unexpected). Checkout button handles `aria-disabled`. The stock message is crimson text (about 5:1, passes) but there is no `role="alert"`. No `aria-live` for quantity or total updates.
- **Performance:** every qty or remove action re-renders the whole list and re-fetches product rows (30s cache). The cart thumbnails have no `srcset` or `loading=lazy` and no explicit width/height (they use `aspect-ratio` on a 96px box, so no CLS).
- **Trust:** the summary says "GST, shipping, and any coupon or AhamStree Cash discount are calculated at checkout" (shipping is complimentary, so say so). Razorpay and "secure checkout" are mentioned only in the empty-cart state and the subtitle. No returns/shipping link beside the Checkout button.
- **States:** a good empty state with recommended products. **No loading state** while the list fetches (`#list` is empty and the summary is shown), so a cart can briefly look like a bare Subtotal. Clear cart has no confirmation or undo, and Remove has no undo (UX-042).

### 3.10 `checkout.html` [V]

- **Hierarchy:** `h1` Checkout, breadcrumbs, a saved-address banner (nice), a warning box, then two columns: shipping form (left) and order summary (right) with trust strip. The "Pay with Razorpay" button is full-width. The summary has a clean totals block (subtotal, discount, GST, shipping, total).
- **Mobile-first (UX-002):** the grid collapses to one column below 980px with the **form first and the summary second**, so on a phone the order of elements is: shipping form, payment method, **Pay button**, then (after scrolling past it) the line items, coupon, AhamStree Cash, and **total**. A shopper cannot see the final amount, apply a coupon or redeem Cash before the pay button. Coupon codes entered after tapping Pay would be too late.
- **Touch:** "Use this address" / "Enter new" buttons about 37px; Apply coupon 42px (explicit height); the coupon toggle about 42px; AhamStree Cash checkbox is the native 13px control with a `.small` label (about 13px target).
- **Accessibility:**
  - **Labels are not associated.** Every field is `<label class="small">Full name</label>` followed by `<input name="full_name">`, with no `for` and no `id` and no wrapping (8 fields). Screen readers announce unlabelled edit fields, clicking the label does not focus the input, and autofill cannot use the label (WCAG 1.3.1, 3.3.2, 4.1.2) (UX-001). `autocomplete` tokens are present and correct, which helps.
  - **Pay is `disabled` until all fields validate**, with no text explaining why (UX-006). Errors surface in `#warn` (top of the page, above the form) and in the single `first error` message, not beside the field. `data-error` is set on invalid fields but there is no CSS or DOM that renders it, so per-field messages never appear. The invalid indicator is only a faint red border (`rgba(220,20,60,.4)`) and valid is a faint green border: colour only (1.4.1) and low contrast (1.4.11). The warning box has no `role="alert"`, and focus does not move to it.
  - Status `Creating payment link…` and `Redirecting to Razorpay…` are not live regions.
  - `#coupon toggle` has no `aria-expanded`.
  - `State` is a free-text input (typos like "Tamilnadu"); pincode does not auto-fill city/state.
- **Performance:** a top-level `await` on `supabase.js` (esm.sh) blocks everything on the page; `79` inline `style=` attributes; three server quote calls on load (read-only quote, coupons, wallet) [I].
- **Trust:** Razorpay is named; the trust strip links to Returns and Shipping policies (opening in new tabs, good). **The strip says "Easy 7-day returns", which contradicts the policy (UX-003).** There is no GST invoice mention, no seller identity and no phone/WhatsApp help link on this page (UX-049). A "login required" gate shows when logged out (UX-005): guest checkout was removed on purpose, and the page offers "Log in / Create account" (WhatsApp OTP + 4-digit PIN).
- **States:** logged-out gate, saved-address banner, validation, stock errors, "Could not verify product stock. Please refresh", session-expired redirect to `login.html?next=checkout.html`, and pending-payment resume banner (good). The `login.html?next=` redirect after expiry is inconsistent with the in-place modal used for the first gate.

### 3.11 `success.html` [V]

- **Hierarchy:** one centred card with an icon, `h2`, and two buttons. Unlike the rest of the site the icons are **emoji** (⏳ ✅ ❌ 🕐), the card radius is 20px, and the heading is `h2` (no `h1`). Visually off-brand.
- **A11y:** state changes are not announced (no `role="status"`). The emoji have no text alternative. The `Retry` and cancelled/pending panels are **dead code**: every non-"paid" outcome calls `redirectToOrders()` (UX-022).
- **Integrity:** success is shown, the cart is cleared and the GA4 `purchase` event fires based on the `razorpay_payment_link_status=paid` URL parameter alone. Anyone can open `success.html?razorpay_payment_link_status=paid&razorpay_payment_link_reference_id=x` to see a "Payment successful!" page, clear their cart, and send a purchase event with a value from `orders` (RLS scoped, so the value is 0 for a non-owned id). The code comments acknowledge that signature verification is deferred to the server (UX-045).
- **Trust/next steps:** "We'll send you updates shortly" with no stated channel (SMS/WhatsApp/email), no estimated delivery, no link to track, no order summary, and no Returns/shipping reminder. Order ID is shown (good).
- **States:** loading ("Verifying your payment…"), success, plus the dead states above.

### 3.12 `cancel.html` [V]

- A static "Payment cancelled" card (`h2`, 18px radius) with Back to Cart, Continue Shopping, Home. It is **orphaned**: no code in the customer site links to `cancel.html` (grep found no references), because Razorpay now returns to `success.html`. Either wire it as the explicit cancel target or delete it (UX-022).
- No `h1`, three buttons of near equal weight, and no explanation of what happened next ("no money charged" is only in the unused `success.html` panel). No help link.

### 3.13 `login.html` [V markup]

- **Hierarchy:** a single `account-card` with `h2` "Login", a Google button, and the WhatsApp number -> PIN/OTP -> name -> set-PIN steps. Calm and focused.
- **A11y:** here labels use `for`/`id` correctly (good). PIN fields use `type="password"` with `inputmode="numeric"`, `maxlength=4`. OTP uses `autocomplete="one-time-code"` (good). "Forgot PIN" is a text button at `opacity:.6`, 13px and about 21px tall (below the 24px AA minimum; text about 4.5:1 borderline) (UX-033). No `h1` (UX-011). Step transitions are not announced and focus is moved programmatically (partly good).
- **Performance:** `signin-popup.js` is 30KB of JS imported on every page via `ui.js`.
- **Trust:** says what the number is used for (WhatsApp). No privacy-policy link on the form; no explanation that a PIN replaces passwords.
- **States:** step panels, countdown for resend, error text with `.error-text` (12px, about 4.5:1 at the limit). WhatsApp-only OTP excludes shoppers without WhatsApp; Google is the only alternative (Section 8).

### 3.14 `account.html` [I]

- A hub that switches views (orders, wallet, profile, wishlist) inside `#app`. It uses `<main>` and a `h2` "My Account" (no `h1`), and `.nav-item` buttons whose class collides with the header's `.nav-item` rule (flex, relative) (UX-060). "Loading…" is the only loading state. `window.location.href = "login.html"` for logged-out users with no `next` parameter, so users do not return to where they were [V from code].

### 3.15 `profile.html` [V]

- A profile form whose `<label class="small">` elements again have **no `for`**, though the inputs do have `id`s (so it is a one-attribute fix here, unlike checkout) (UX-001). `h2` "Profile", no `h1`. Same free-text State field. Saving feedback style not verified.

### 3.16 `orders.html` [V markup]

- **Hierarchy:** `h2` "My Orders", cards per order, a Track panel, pending-payment countdown (`20px` bold brand orange), invoice, cancel and return actions. Reservation countdown is a real server-side timer and not a manufactured-urgency device. It is acceptable if labelled as "your items are reserved until...".
- **A11y:** the return flow is an overlay `div.modal-overlay` with **no `role="dialog"`, `aria-modal`, label or focus management**. The defect-reason "chips" are `<div class="chip" data-r=...>` (not buttons), so they cannot be reached or chosen by keyboard (WCAG 2.1.1), which blocks keyboard users from filing a return (UX-020). The file input has no label (the preceding `div.small` is not associated). Uses native `alert()` and `confirm()` for cancel and invoice errors (UX-046). Track toggles use inline `onclick` with `window.__track`.
- **Trust:** the return modal states the defect-only, 48-hour policy plainly, and sets the expectation about handloom variation (good transparency). The same wording is not shown pre-purchase on the PDP (UX-023).
- **States:** "Loading…", `Could not load orders: <raw message>`, empty state not verified.

### 3.17 `track.html` [V]

- **Hierarchy:** one card, `h2`, AWB input, Track button, results timeline of cards. **No `h1`**; 18px card radius.
- **Function/UX:** it asks for a "Shiprocket AWB number" and tells users to "find the AWB in your Shiprocket panel or shipping label". Customers have no Shiprocket panel. They have an order number or the phone number used at checkout (UX-021). Entry from `orders.html` passes `?awb=` so signed-in users are fine, but the footer's "Track Order" link lands logged-out users on a form they cannot complete.
- **A11y:** label is associated (good). The status line `#status` is not a live region. The timeline cards have no list semantics.
- **States:** loading text, error with real server reason (good), `shipped === false` message, no events. Button is disabled during the request and re-enabled in `finally` (good).

### 3.18 `wishlist.html` [V partial]

- `h1` "My Wishlist" (32px inline), grid of `.p-card`s with remove (native `confirm()`), empty state ("Your wishlist is empty" + Browse Products), `Error loading wishlist` with no retry.
- Guest wishlists are supported and merged on login (good), but a signed-out visitor is not told the list is stored only in the browser. At <=480px the wishlist icon is **hidden from the mobile header** (UX-016).
- No "move to cart" or price/stock change cues from the wishlist cards [I].

### 3.19 Policy template pages: `shipping.html`, `returns.html`, `privacy.html`, `terms.html`, `cookies.html`, `help.html`

All six share one pattern. `shipping.html` and `returns.html` verified; the other four **[I]** from the identical markup.

- **Hierarchy:** `account-card` (max 820px) containing `#policyContent` with a first-heading `h2` (no `h1`; UX-011). The `#policyContent` CSS override sets body copy to 16px/1.75 and 72ch measure, which reads well.
- **Mobile:** 15px body on <=600px; readable. Long policy pages have no table of contents or anchors (Terms/Privacy).
- **A11y:** every paragraph is `class="small"` (neutralised by the CSS override). Closing buttons "Browse Sarees / Go to Cart / Home" are `btn` + `btn ghost`, but **`.btn.ghost` has no CSS**, so all three render as identical solid orange primary buttons (UX-052).
- **Performance:** the static fallback text renders, then `get-policy-page` replaces the content (a layout shift if the CMS copy differs in length) (UX-059).
- **Trust:** the content is clear, and the policies are consistent with each other (defect-only returns within 48 hours; 3-5 business days delivery; no cancellation after dispatch). The Shipping policy does not mention that shipping is complimentary (the topbar, homepage and PDP do). It does not state carrier names, dispatch time (hours/days after order) or what happens for remote pincodes. The Returns policy buries the single most important sentence (defect-only) in paragraph 2 under a neutral "Returns" heading, with no summary box.
- **Privacy/Terms/Cookies:** `cookies.html` is a policy page only. No consent mechanism exists, while GTM/GA loads unconditionally on all pages (UX-057, a decision item).
- **States:** CMS failure silently keeps the static copy (good).

### 3.20 `contact.html` [V]

- `h1` "Contact Us", phone (`tel:` link), optional email (hidden until the admin sets it), hours line. Supports live admin-managed values.
- Missing: no contact form, no WhatsApp link on this page (WhatsApp is the primary support channel everywhere else), no postal address, no response-time promise, and no "order enquiries: have your order ID ready" guidance. Three identical `ghost`-less buttons again (UX-052). `<p>` links are underlined orange, passing.

### 3.21 `about.html` [V]

- The only content page with `lang="en"`. `h1` "Our Story", a text column and a founder photo (`nisha.jpg`) with caption. The photo is **497KB**, `loading=lazy`, no width/height, `object-fit:contain` with 6px padding, and on mobile `order:-1` puts the photo above the story.
- **Trust:** the story is generic ("born out of a deep love for handloom") with no specifics (which weavers or cluster, how many looms, years in business, how orders are made). I am not proposing content, only noting that specificity is the main trust lever this page lacks, and that factual provenance is the brand owner's to supply (Section 8). No GI/handloom-mark claim is made or implied here; do not add one unless it is genuinely held.
- Alt text "Founder of AhamStree" is acceptable but could name the person ("Nisha, founder").

### 3.22 `blog.html` and `blogs.html` [V partial]

- **`blogs.html`:** `h1` "Stories of *Craft* & Cloth", journal cards (cover image `eager` for the first and `lazy` for the rest, good), a styled empty state ("No articles yet") and an error state. Good state coverage.
- **`blog.html`:** the `h1` is injected from data (`<h1 id="title">` is empty until the article loads), one cover image without lazy loading (it is above the fold, which is right). Article body typography not verified [I]. Without JS or on a failed fetch the article page is blank.
- No related products or "shop this" link from articles (conversion opportunity) [I].

### 3.23 `stores.html` [V]

- A card containing the literal text **"Stores page placeholder. Add your store addresses, opening hours, and map links."** (UX-029). It is not in the sitemap or the footer, but it is a public URL and anyone who finds it sees internal placeholder copy. Delete the page, redirect it, or complete it. `h2`, 18px radius.

### 3.24 `404.html` [V]

- Has `lang`, `<main>` and an `h1`. But `<link href="assets/styles.css">` and the module imports use **relative paths** (and there is no fonts link). GitHub Pages serves `404.html` at the *requested* URL, so `/collections/foo/bar` resolves `assets/styles.css` to `/collections/foo/assets/styles.css` and renders **unstyled** (UX-054). It also has no search box and shows a "Blogs" button before "Cart"/"Search". The card uses 18px radius and a 40px `h1` inline.

---

## 4. User-journey findings

### Journey 1 — First-time customer exploring sarees

The visitor lands on the homepage. If they are logged out, a welcome popup or a sign-in popup appears about 600ms after load (UX-024) before they have seen a single saree. The hero is full-height and its content depends on an API call, so on a slow or cold load they see a shimmering block first. The trust strip beneath it is quiet but factual. The two category tiles (Sarees, Suits) give a clear entry. The "Most loved" row is ordered by page views, not purchases (UX-067), which is honest enough as a default but mislabelled as "Customer Favourites".

Friction: there is no explanation of what handwoven Chanderi is, no weave guide, and the About page is generic. The header is about 187px tall on desktop, so the product grid starts low on a laptop. On a phone the Hindi logo is tiny (UX-014). On narrow phones (<=480px) the wishlist icon is hidden and the menu has no Account, Wishlist or Track link (UX-016). Cards show title, price and badges but no colour, fabric or weave (UX-038), so a newcomer cannot learn the vocabulary from browsing.

**Biggest single blocker:** a newcomer has no orientation to the product category plus an interruption popup within a second. Neither is a hard stop, but together they raise bounce on the first visit. The popup is configured from the admin and fires at most once per day per device (the `reappear_hours` setting), so the cost is small per visitor but lands precisely on first-time visitors.

### Journey 2 — Customer searching for a particular fabric or colour

Two entry routes: the header search (overlay on desktop, page on mobile) and the listing filters. The placeholder in both reads "Search for sarees, fabrics, colors…", but `search.js` queries only `title ILIKE` and `description ILIKE` and returns at most 20 rows (UX-007). Colour, fabric, weave and occasion are separate columns/relations that the listing filters use, but search ignores them. A search for "mustard" or "cotton silk" succeeds only if a copywriter happened to put those words in the title.

The listing page has the right tools: fabric, collection, colour, occasion and price filter pills, weave pills, a mobile bottom sheet and sort. But colours are listed as text with no swatches, and the filter options come from a text column, so near-duplicates ("Mustard", "mustard yellow") may split the filter. After filtering, an empty result shows "No products found." with no "Clear filters" button (UX-035).

Search page problems: the input has no label, there is no live region for results, no suggestions or zero-result recovery, and spelling "colors" differs from Indian-English "colours".

**Biggest single blocker:** search ignores the attributes the placeholder promises. Fix by searching `colour`, `fabric.name`, `weave_line.name`, `occasion` and `craft` (or a generated `search_text`/tsvector column), then by showing those attributes on result cards.

### Journey 3 — Customer comparing multiple sarees

There is no compare feature. The substitutes are the wishlist (heart on cards and PDP) and browser tabs. Cards expose only title, price, sale price, a status badge and low-stock text, so comparing means opening each PDP. On the PDP the spec strip shows colour, material and craft (if filled). A shopper cannot see the same fields side by side on the listing.

The cart thumbnail and title links open in a new tab (`target=_blank`), so a shopper who goes from the cart back to browse accumulates tabs, which is the opposite of a clean compare flow. The wishlist page is fine, but the heart is 30x30px on cards and the wishlist is hidden from the mobile header at <=480px (UX-016). Wishlist items do not show stock changes or price drops [I].

Because each saree is a unique handloom piece, the compare need is real (for example "same border, different colour"), and pieces sell out ("Sold out" overlays exist).

**Biggest single blocker:** the absence of key attributes (colour, fabric, weave) on the product card. A low-cost improvement is to add one line of metadata to the card (UX-038) and to surface "similar pieces" on PDP; a full compare table (UX-063) is optional and Low priority for a small catalogue.

### Journey 4 — Customer viewing detailed fabric information

The PDP offers: a gallery with zoom lightbox, a spec strip (Colour/Material/Craft plus admin-defined specs), an info-tab block whose tabs come from admin "Additional details" sections (Description, plus anything like Fabric Care or Shipping), a delivery pincode check and live offers.

Friction: (a) the zoom lightbox is the only way to inspect weave detail, and it is **not keyboard accessible** and has unlabelled controls (UX-010); (b) structured saree attributes a buyer asks about (length, blouse piece included or not, weight, wash/care, zari type) exist as columns (`zari`, `border_type`, `motif`, `print_type`, `occasion`) but the PDP renders only `colour`, `fabric` and `craft` automatically, and everything else depends on admin-authored sections (UX-039); (c) `.pd-tab-panel` text is `opacity:.9`, 14px; (d) the alt text for every gallery image is the product title or the `alt_text` field, which is fine; (e) tabs have 38px targets and no ARIA tab semantics (UX-041); (f) the returns paragraph that explains handloom colour variation lives only on the policy pages, not beside the colour spec, where the buyer's expectation forms.

The images are the core fabric evidence; the main image has no intrinsic size, so the layout shifts while it loads (UX-028).

**Biggest single blocker:** fabric detail depends on whether an admin filled each product's sections. The fix is a consistent structured "Fabric & care" block that renders the available columns for every product, plus a short "variation in handloom colour is natural" note that links to Returns.

### Journey 5 — Mobile customer purchasing a saree

Happy path: card -> PDP -> sticky "Add to cart" bar -> **redirect to cart** -> Checkout -> login gate -> WhatsApp OTP and PIN -> checkout form -> Pay -> Razorpay -> back to `success.html`.

Friction points in order:
1. Add to cart navigates away immediately (UX-025). It is fast but loses the browsing context, and "Buy it now" skips the cart entirely.
2. At checkout a logged-out user hits a hard gate (UX-005). A returning user with a session does not.
3. The shipping form has labels that are not associated with inputs (UX-001); a 10-digit phone `maxlength` and numeric keypad are good; `State` is free text; pincode does not fill city/state.
4. **The Pay button precedes the summary, coupon and Cash redemption** (UX-002). A buyer with a coupon code is likely to enter the code, scroll, and find the Pay button hidden behind validation, or pay without applying it.
5. The Pay button is disabled with no reason given until all fields validate (UX-006).
6. The "Easy 7-day returns" tile contradicts the policy (UX-003); a buyer who relies on it and then sees the 48-hour defect-only rule has grounds for a dispute.
7. Redirect to Razorpay and back works, but see Journey 6.

Positive: the saved-address banner, the 16px input size on mobile, `autocomplete` tokens, the sticky PDP bar with safe-area padding, a pincode serviceability check, and complimentary shipping.

**Biggest single blocker:** the combination of forced login and a checkout that hides the total below the pay button. Together these sit exactly where abandonment concentrates. Fix by reordering the mobile layout (summary and coupon collapsed above the form, a sticky "Pay ₹X" bar), and decide on guest or deferred-account checkout (Section 8).

### Journey 6 — Customer experiencing payment failure

If the payment fails or the shopper presses Back from Razorpay, `success.html` runs: a `paid` parameter shows success. A `cancelled` parameter, no parameter, or an unknown state all call `window.location.replace("orders.html#order-...")`. The "Payment not completed" and "Payment pending" panels, with their "your cart is still saved and no money was charged" text and Retry link, are never displayed (UX-022). The shopper lands on the Orders page and must infer what happened from an order card that shows a pending-payment banner with a countdown and a retry action.

Positives: the cart is preserved until confirmed success (`clearCart()` runs only on paid), a pending payment is persisted (`ahamstree_pending_payment`) and resumed at checkout with a banner and countdown (reservation timer is real), and the Orders page owns retry. Weaknesses: there is no message on landing explaining the failure and reassuring that no money moved, no cause (declined, UPI timeout, bank error) and no human help link (WhatsApp/phone) at the moment of anxiety. `cancel.html` exists but nothing links to it. Errors during payment-link creation appear in the warning box at the top of the checkout page (possibly off-screen on mobile) and are not announced (UX-006).

A second issue: if the user closes the tab after paying but before redirect, success depends on the webhook updating the order. The Orders page reflects the DB, which is correct, but there is no proactive "we are confirming your payment" state.

**Biggest single blocker:** the failure landing page has no message. A buyer who has just seen a bank error and then lands on a list of orders will not know whether to retry, wait or call. Show an explicit failure/pending panel on arrival, with Retry as the primary action and WhatsApp help beside it.

### Journey 7 — Customer returning after leaving a cart

The cart is stored in `localStorage` (`ahamstree_cart_v1`) and survives revisits on the same device; the header badge updates live and across tabs (storage event). On return the cart re-validates price and stock against Supabase and clamps the quantity, with a "Please fix: …" message listing sold-out items (good, and honest about unique pieces).

Friction: (a) the cart is device-bound, since there is no server cart, so a shopper who built a cart on the phone and returns on a laptop finds it empty, and the page does not say so; (b) there is no "saved for later" or move-to-wishlist from the cart; (c) the sold-out message is a single crimson line and the Checkout button is made inert with `pointer-events:none` plus a `title` tooltip (not visible on touch); (d) no loading state while the cart refreshes; (e) the empty state is good ("Your cart is empty" + recommendations) but does not suggest checking the wishlist or logging in to see orders; (f) if the user is logged out the header shows "Login / Sign up" but no prompt that logging in merges the wishlist (it does, silently).

Positive: no countdown or fake-urgency device is used. "Only N left" labels are factual and appear at <=3 on cards and <=5 in the cart.

**Biggest single blocker:** a device-bound cart without any signal to the shopper. Cheap mitigation: when a logged-in user has an empty local cart, say "Items added on another device are not synced", or persist carts server-side for logged-in users (larger work; decision item).

### Journey 8 — Customer trying to understand shipping or returns

Policy access: topbar (About, Shipping, Returns — desktop only), footer (Shipping Policy, Returns & Cancellations, FAQs, Track Order), drawer (Shipping, Returns). On the PDP there is only an estimated-delivery line and the pincode checker; there is no returns summary unless an admin authored a tab. On the cart there is none. On checkout the trust strip links to both, but the Returns tile says "Easy 7-day returns" (UX-003).

Policy content is clear prose but the decisive fact (defect-only, 48 hours, photo evidence) sits in paragraph 2 under a plain "Returns" heading with no summary. Shipping does not say "complimentary" and gives no dispatch time ("as soon as it is successfully placed" is vague). The Help page repeats the defect-only summary (good). The order-return modal is the clearest statement of the policy and appears only after purchase.

Track Order: the footer link opens a form requiring a Shiprocket AWB and instructs the user to look in "your Shiprocket panel", which customers do not have (UX-021). Signed-in users get a better route via Orders.

**Biggest single blocker:** the contradiction between the checkout's "7-day returns" and the actual policy, followed by Track Order asking for an identifier the customer does not have. Add a three-line policy summary (Shipping: complimentary, 3-5 business days; Returns: manufacturing defects only, within 48 hours, photos required; Cancellation: before dispatch) to the PDP, cart and checkout, sourced from the same CMS text so they cannot drift (UX-023).

### Journey 9 — Customer on slow mobile internet

The architecture is JS-first. Every page loads `ui.js`, which imports `supabase.js`, which imports the Supabase client from `esm.sh` (a third-party module CDN with its own dependency chain), plus `welcome-popup.js`, `signin-popup.js` (30KB), `search-overlay.js` and others. The header and footer are rendered by that script, so until it finishes the page has no navigation. Then each page fetches its data from Supabase (hero, products, collections), so there is a multi-step waterfall before meaningful content.

Positives: skeletons on the home and listing pages; images use `srcset`, `sizes`, thumbs for galleries, lazy loading; thumbs are small renditions; neighbours are preloaded; sessions cache nav for 10 minutes; fonts use `display=swap`; GTM is `async`.

Risks (hypotheses to measure): header and footer injection and the 120px -> about 187px offset change (CLS) (UX-026); hero LCP only starts after the API (UX-027); PDP `display:none` until data arrives and a main image without dimensions (UX-028); the Google Fonts stylesheet blocks rendering and now includes an unused family (UX-050); the sign-in popup JS is on the critical path of every page even for logged-in users; on failure of esm.sh there is no header, no footer, and no nav (no `<noscript>` fallback). Raw error messages ("Error: …") appear on timeouts.

**Biggest single blocker:** dependence on esm.sh plus a Supabase round trip before anything meaningful renders. Measure with Lighthouse mobile (Slow 4G, 4x CPU) and WebPageTest "Moto G4, 3G Fast", then consider (a) bundling the Supabase client locally, (b) server-rendering or inlining the header/footer HTML, (c) caching hero/home JSON in `localStorage` and rendering stale-while-revalidate.

### Journey 10 — Customer using keyboard or assistive technology

What works: the mobile drawer (focus in, trap, Escape, focus return); the login labels and `autocomplete`; `aria-pressed` on wishlist hearts; the PDP thumbnails are `<button>` with labels; `aria-label` on header icons; the cart quantity controls are labelled; the policy page type is readable (16px/1.75).

What fails (by severity):
1. **No visible focus on inputs** (UX-004): `.input` removes the outline and replaces it with a roughly 2:1 border tint plus a 4px 9%-opacity shadow. Search and PDP quantity do likewise.
2. **No skip link, no `<main>`, no `lang`** on nearly every page (UX-008/009): keyboard users tab through about 20 header links on every page; screen readers read English with the wrong voice rules.
3. **Checkout labels are not associated** (UX-001), and validation is a distant, non-announced box (UX-006).
4. **PDP zoom is mouse-only** (UX-010). The lightbox has no dialog role or focus management, and its buttons say "✕ ‹ ›".
5. **Return-reason chips are divs** (UX-020); the return modal has no dialog semantics.
6. **The hero auto-rotates** with no pause (UX-012).
7. **No live regions anywhere** in the storefront (UX-037): cart updates, search results, wishlist toggles, filter counts and payment status are silent.
8. Filter and tab widgets use the wrong ARIA roles (UX-036, UX-041).
9. **Focus can be hidden behind the fixed header** (about 187px) and the sticky PDP bar, since there is no `scroll-padding-top` (UX-015, WCAG 2.4.11).
10. Several heading structures are missing (no `h1` on the PDP and about 12 other pages) (UX-011).

**Biggest single blocker:** checkout (unassociated labels, silent errors, invisible focus). A screen-reader user cannot reliably complete an order. This is also a legal-risk area, since India's Rights of Persons with Disabilities Act and consumer-protection norms increasingly look at e-commerce accessibility; the fix is small.

---

## 5. Prioritized improvement backlog

Priority: Critical = blocks purchase or misleads the buyer; High = significant conversion or accessibility loss; Medium = noticeable friction; Low = polish or housekeeping. Complexity: S = under 2 hours, M = 2-8 hours, L = more than 8 hours. "Benefit" is expected direction, not a promised figure; all are hypotheses to validate.

| ID | Page/Component | Problem | Why it hurts | Recommended fix | Priority | Complexity (S/M/L) | Expected benefit | Validation method |
|---|---|---|---|---|---|---|---|---|
| UX-001 | checkout.html, profile.html forms | `<label class="small">` has no `for`; checkout inputs have no `id` (8 fields). | Screen readers announce unlabelled fields; label click does nothing; WCAG 1.3.1, 3.3.2, 4.1.2 fail. | Add matching `id`/`for` (or wrap input in label); keep `name` and `autocomplete`. Use the `.field label` style from login. | Critical | S | Completable checkout for AT users; fewer form errors | axe DevTools on checkout; NVDA/VoiceOver walk-through; click-label-focuses-input check |
| UX-002 | checkout.html layout (<=980px) | Form is first, summary/coupon/Cash/total after the Pay button. | Buyer pays before seeing the total, cannot apply a coupon or Cash in time. | Mobile order: collapsible order summary + coupon at top, form, then a sticky "Pay ₹X" bar showing total. Keep desktop two-column. | Critical | M | Fewer abandoned or mispriced orders; more coupon use before pay | GA4 checkout funnel before/after; 5-person mobile task test ("apply code WELCOME10") |
| UX-003 | checkout.html trust strip | Tile says "Easy 7-day returns"; policy is defect-only within 48h. | Misleading claim at purchase; dispute and chargeback risk; trust damage. | Replace with the true statement (e.g. "Returns for manufacturing defects within 48h") sourced from one CMS string used on PDP, cart, checkout. | Critical | S | Removes dispute risk; builds trust | Copy diff vs `returns.html`; legal/owner sign-off |
| UX-004 | Global CSS: `.input`, `.pd-qty-input`, `.search-input`, buttons | `outline:0`; focus = faint border tint (~2:1) + 9% shadow; no `:focus-visible` rule anywhere. | Keyboard users cannot see where they are; WCAG 2.4.7, 1.4.11 fail on inputs. | Add global `:focus-visible{outline:2px solid <action>;outline-offset:2px}`; never remove outline without replacement; ensure 3:1. | Critical | S | Keyboard operability across all forms | Tab through every page; axe; contrast check of ring vs adjacent colours |
| UX-005 | checkout.html login gate | Guest checkout removed; account (WhatsApp OTP + PIN) required before the form. | First-time buyers drop at forced registration; non-WhatsApp users blocked. | Decision needed: offer guest checkout with optional post-purchase account, or capture phone/OTP inline in the form (one step, not a gate). | Critical | L | Higher first-order conversion | GA4 step drop-off at gate; A/B on a traffic slice |
| UX-006 | checkout.html validation | Pay `disabled` with no reason; errors only in a top box (`#warn`), not announced; `data-error` never rendered; colour-only invalid state. | User cannot tell what is wrong; screen readers get nothing; WCAG 3.3.1, 4.1.3, 1.4.1. | Keep Pay enabled; on click, validate, show inline per-field error text (`aria-describedby`, icon), `role="alert"` summary, focus first error. | High | M | Fewer failed attempts; accessible errors | Keyboard/AT test; log validation-failure events; mobile usability test |
| UX-007 | search.js / search.html / overlay | Query matches `title` and `description` only; placeholder promises fabrics, colors. | "mustard", "cotton silk", "zari" return nothing; journey 2 fails. | Include `colour`, fabric name, weave, occasion, craft (or a `search_text` column); show matched attributes; add zero-result recovery. | High | M | More successful searches; fewer exits | Run 20 real queries before/after; GA4 search -> product click rate |
| UX-008 | 28 pages | `<html>` has no `lang`. | Screen readers use the wrong pronunciation; WCAG 3.1.1 (A) fail. | Add `lang="en-IN"` (and `lang="hi"` spans for Hindi). | High | S | A11y compliance; correct TTS | axe "html-has-lang"; grep for `<html>` |
| UX-009 | All pages | No `<main>`, no skip link; ~20 header tab stops per page. | Keyboard users re-tab the header every page; WCAG 2.4.1 (A) fail. | Wrap content in `<main id="main">`; add visually hidden "Skip to content" link first in `<body>`. | High | S | Faster keyboard navigation | Tab test; axe "landmark" rules |
| UX-010 | product.html gallery + lightbox | Main image is a click-only `<img>`; lightbox lacks `role="dialog"`, label, focus move/trap/return; buttons "✕ ‹ ›" unnamed. | Fabric zoom unreachable by keyboard; WCAG 2.1.1 (A), 4.1.2, 2.4.3 fail. | Make the main image a `<button>` (aria-label "Zoom image"); lightbox as `dialog` with labelled controls, focus trap, focus return. | High | M | Fabric inspection for all users | Keyboard-only walk-through; axe |
| UX-011 | PDP and ~12 pages | No `h1` on product (title is a `div`), account, orders, login, profile, track, stores, success, cancel, 6 policy pages; home `h1` depends on admin hero. | Weak page semantics, SEO and AT navigation; WCAG 1.3.1, 2.4.6. | One `h1` per page; PDP title -> `h1`; give homepage a static visually hidden `h1` fallback. | High | S | Better SEO and screen-reader landmarking | HeadingsMap extension; Search Console |
| UX-012 | index hero carousel | Auto-advance every 6.5s, no pause, no hover/focus pause, ignores reduced-motion; hidden slides' CTAs stay focusable. | WCAG 2.2.2 (A) fail; distracts; focus lands on invisible slides. | Add pause/play button, pause on hover/focus, disable autoplay for `prefers-reduced-motion`, set `inert` on off-screen slides. | High | M | A11y compliance; calmer homepage | Manual test with reduced-motion; axe |
| UX-013 | Hero dots | Dots are 7x7px (active 22x7). | Fails WCAG 2.5.8 (24px min); hard to tap; wrong carousel semantics. | Increase hit area to >=24px (ideally 44) with padding while keeping the visual 7px dot; add `role="group"`/`aria-roledescription="carousel"`. | High | S | Usable carousel on phones | DevTools box sizes; touch test |
| UX-014 | Header logo | Hindi mark ~12px glyph height on mobile (30-34px box, ~60% padding in PNG); alt/aria is Latin; footer wordmark Latin. | Brand unrecognisable at phone size; mismatched accessible name. | Crop PNG padding, provide SVG, raise mobile logo to >=44px glyph box; set `alt="AhamStree (अहम् स्त्री)"`; decide Latin vs Hindi rule. | High | M | Brand recall on mobile | 360px device screenshot test; 5-second recall test |
| UX-015 | Fixed header | ~187px tall on desktop (~84 mobile), `position:fixed`, no `scroll-padding-top`; focus/anchors can hide behind it. | Wastes ~24% of laptop viewport; WCAG 2.4.11 (AA) risk. | Compact header on scroll or non-fixed nav row; set `html{scroll-padding-top:var(--header-offset)}`. | High | M | More products above fold; focus visible | DevTools measure; keyboard Tab with fixed bar |
| UX-016 | Mobile drawer / header <=480px | Wishlist icon hidden; drawer has no Account, Wishlist, Orders, Track links. | Core account functions unreachable on small phones. | Add Account, Wishlist, My Orders, Track Order to the drawer; keep cart/search icons. | High | S | Fewer dead-ends on mobile | Click-path test on 360px; GA4 account-page visits |
| UX-017 | PDP price/meta contrast | MRP (brand @ .55 opacity, 14px) ~2.3:1; SKU/stock in `.pd-meta .72` x `.small .75` ~3.8:1 at 12px. | Price and stock hard to read; WCAG 1.4.3 fail. | Use solid `--text-light` (#6b6b6b, 5.33:1) for MRP/meta; remove nested opacity. | High | S | Readable price and stock | Contrast checker on computed colours |
| UX-018 | products.html weave pills | Active: white on #b8863b (3.23:1); hover: #b8863b text on white (3.23:1), 13px. | Fails WCAG 1.4.3 for text. | Use action colour or darker gold (#8a6320 ~5:1) for active/hover. | High | S | Legible filter state | Contrast check; visual regression |
| UX-019 | Footer contrast | Link hover `#96401f` on dark gradient ~2.3:1; copyright ~3.6:1 at 12px. | Fails 1.4.3 in hover/small text. | Use light hover (#fff / cream) and raise copyright alpha to >=.7. | High | S | Compliant footer | Contrast check at gradient start/end |
| UX-020 | orders.html return flow | Reason "chips" are `div`s; modal has no dialog role/focus mgmt; file input unlabelled. | Keyboard/AT users cannot file a return; WCAG 2.1.1 (A). | Use radio inputs/buttons for reasons; dialog semantics with focus trap; label the file input. | High | M | Returns accessible to all | Keyboard test; axe |
| UX-021 | track.html | Requires a Shiprocket AWB and points to "your Shiprocket panel". | Customers do not have an AWB or panel; footer "Track Order" dead-ends. | Accept order ID + phone (server looks up AWB); reword help text; link signed-in users to Orders. | High | M | Fewer "where is my order" contacts | Support ticket volume; task test |
| UX-022 | success.html / cancel.html | Failed/pending panels are dead code (everything redirects to Orders without a message); `cancel.html` orphaned. | Buyer lands on a list with no explanation after payment failure. | Show failure/pending panel on arrival (with Retry + WhatsApp help), then offer Orders; wire or remove `cancel.html`. | High | M | Higher retry-after-failure recovery | Simulate failure in Razorpay test mode; funnel recovery rate |
| UX-023 | PDP, cart | No returns/shipping summary near the buy action; defect-only rule is only found on policy pages and post-purchase. | Policy shock after purchase; hesitation before. | Add a 3-line policy summary (shipping free 3-5 days; defect-only returns within 48h with photos; cancel before dispatch) from one CMS source. | High | S | Fewer post-purchase disputes; clearer expectations | Support ticket tags; PDP scroll/click on policy link |
| UX-024 | ui.js popups | Welcome and sign-in popups auto-open ~600ms after load on every page for logged-out visitors (once per day). | Interrupts first-time visitors before browsing; sign-in prompt before any value shown. | Decision: delay until engagement (e.g. cart add, 2nd page) or move to an inline banner; never stack; keep Escape/close. No timers or urgency. | High | S | Lower first-visit bounce | Bounce/engagement for new visitors; A/B |
| UX-025 | product.html add-to-cart | Add to cart immediately navigates to cart; no confirmation; Buy now bypasses cart. | Loses browse context; no sense of "added"; can't keep shopping. | Show an in-page confirmation (mini-cart or toast with "View cart / Continue"), keep navigation for Buy now. | High | M | More multi-item sessions; less backtracking | Pages/session; add-to-cart -> checkout rate |
| UX-026 | ui.js header/footer injection | Header/footer rendered by JS after esm.sh import; offset 120px -> ~187px. | Blank nav on slow nets; layout shift on every page; no nav if esm.sh fails. | Pre-render header/footer HTML in each page (build step or snippet include) and hydrate; self-host Supabase client. | High | L | Better CLS and resilience | Lighthouse CLS; WebPageTest 3G; block esm.sh and test |
| UX-027 | index/products LCP | LCP image only requested after module graph + API calls (hero, product list). | Slow LCP on mobile. | Cache hero/product JSON in `localStorage` (stale-while-revalidate); preload likely LCP image; consider inlining the first slide. | High | M | Faster LCP | Lighthouse mobile LCP; field data (CrUX) |
| UX-028 | product.html loading | `#content` hidden until data returns; `#mainImg` has no width/height/aspect ratio. | Empty PDP and layout jump when the image loads. | Add skeleton for gallery/summary; reserve main image space with `aspect-ratio:3/4`; set image dimensions from `product_images`. | High | M | Lower PDP CLS/LCP | Lighthouse CLS on PDP; Performance panel layout-shift regions |
| UX-029 | stores.html | Live page reads "Stores page placeholder. Add your store addresses…". | Looks unfinished; erodes trust if found. | Delete or redirect, or complete with real details (owner decision). | High | S | Removes placeholder copy | Visit URL; sitemap/search check |
| UX-030 | Form fields (.input) | Border `#e8ded2` on white is 1.33:1; valid/invalid shown by faint border colour only. | WCAG 1.4.11 fails; states depend on colour (1.4.1). | Border >=3:1 (e.g. #8a8178 or darker); add icon/text for error and success. | High | S | Fields visible to low-vision users | Contrast checker; low-vision test |
| UX-031 | `.p-card-wish` (cards) | Heart is 30x30px. | Below 44px guidance; at AA minimum only (24px). | Increase hit area to 44x44 (keep icon size) via padding/pseudo-element. | Medium | S | Fewer mistaps | DevTools size; touch test |
| UX-032 | `.pd-qty-btn` (PDP, cart) | Buttons ~42x38px, input 44x37px. | Slightly under 44px height on a core control. | Set min 44x44 on stepper buttons and input. | Medium | S | More accurate qty changes | DevTools; touch test |
| UX-033 | Touch targets (misc) | `icon-btn` 40/36px; `filter-tab` ~37px; weave pill 34px; `pd-tab-btn` ~38px; `Remove` 39px; Forgot PIN ~21px; drawer caret 34px; footer links ~22px. | Below 44px guidance; Forgot PIN and some links near the 24px floor. | Normalise controls to >=44px min-height; add padding to text links. | Medium | M | Fewer mistaps on phones | DevTools audit; mobile test |
| UX-034 | search.html | Input has no label, `outline:none`, results not announced, 12px radius, capped at 20. | AT users cannot label/hear results; inconsistent style. | Add `<label>`/`aria-label`, live region for result count, tokenised radius, pagination or "view all". | Medium | S | Accessible, consistent search | axe; NVDA |
| UX-035 | Listing/collection pages | Empty = "No products found." plain text; errors print raw `error.message`; "not found" lines have no exit link. | Dead-ends; raw DB text looks broken. | Friendly empty state with "Clear filters"/browse links; generic error with Retry; log details to console. | Medium | S | Recovery from empty/error | Force each state; usability check |
| UX-036 | products.html filter widgets | `role="tablist"` on links/pills without tabpanels; `role="menu"` for checkbox lists. | Misleading roles confuse AT; WCAG 4.1.2. | Use `nav`/`aria-current` for categories; `aria-pressed` buttons for weave; disclosure + `fieldset` for filters. | Medium | M | Correct AT semantics | axe; NVDA |
| UX-037 | Global status messages | No `aria-live`/`role="status"` in any storefront page (counts, cart, wishlist, payment status, search). | Dynamic changes are silent to AT; WCAG 4.1.3. | Add a polite live region component; use for counts, add-to-cart, wishlist, payment states. | Medium | M | AT users informed of changes | NVDA test |
| UX-038 | Product cards | Cards show no colour, fabric or weave. | Cannot compare or learn vocabulary from the grid. | Add one metadata line (e.g. "Chanderi cotton-silk · Mustard"); keep it to a single line. | Medium | M | Better discovery and compare | Click-through on cards; task test |
| UX-039 | PDP fabric details | Only colour/material/craft auto-render; zari, border, motif, occasion, care depend on admin tabs. | Fabric information inconsistent per product. | Render all populated attribute columns in a "Fabric & care" block; add handloom-variation note linking to Returns. | Medium | M | Higher buyer confidence | Product-level completeness check; PDP engagement |
| UX-040 | PDP sold-out | Sold-out state only disables the button; no alternatives or notify option. | Dead-end for a unique piece. | Show "Similar pieces" (same weave/colour) and keep wishlist heart; consider back-in-stock request (owner decision). | Medium | M | Recover sold-out visitors | Click-through on alternatives |
| UX-041 | PDP tabs and pincode | Tabs are plain buttons (no `tab` roles, 38px); pincode input 13.5px triggers iOS zoom. | A11y and mobile usability issue. | Implement tab ARIA pattern with arrow keys; set input font-size 16px on mobile. | Medium | S | Smoother mobile PDP | iOS Safari test; axe |
| UX-042 | cart.html | No loading state; Clear cart sits beside Checkout with no confirm/undo; Remove has no undo; thumb/title open new tab. | Accidental loss; confusing blank state; tab sprawl. | Skeleton while fetching; confirm or undo toast for clear/remove; remove `target=_blank`; make Clear a text link. | Medium | M | Fewer accidental cart losses | Usability test; cart abandon rate |
| UX-043 | cart.html summary | "Shipping ... calculated at checkout"; no policy link beside Checkout. | Uncertainty about shipping cost (it is complimentary). | Show "Shipping: Complimentary" and a policy link beside the CTA. | Medium | S | Fewer cart exits | Cart -> checkout rate |
| UX-044 | checkout.html address | State is free text; pincode does not auto-fill city/state; coupon toggle lacks `aria-expanded`. | Typos, slower entry, AT gaps. | Replace State with `<select>` of Indian states/UTs; pincode lookup; add `aria-expanded`. | Medium | M | Cleaner addresses; faster form | Failed-delivery rate; form time-to-complete |
| UX-045 | success.html | Success/cart clear/GA purchase fire on a URL parameter alone; emoji icons; no live region; no delivery info. | Forgeable success page; analytics inflation; off-brand. | Verify status server-side (order lookup) before success; replace emoji with SVG; announce state; add ETA and channel for updates. | Medium | M | Reliable analytics; consistent brand | Test with forged URL; GA4 purchase count vs orders |
| UX-046 | orders, PDP, wishlist | Native `alert()` / `confirm()` used for errors and removals. | Jarring, blocks, untestable, not branded. | Build a shared toast and confirm-modal component. | Medium | M | Consistent feedback | Visual QA |
| UX-047 | Social proof | No product-level reviews or ratings; testimonials only on the homepage (admin-managed). | Missing a primary trust signal for apparel. | Decision: choose a real review collection method (post-delivery request); do not seed fake reviews. | Medium | L | Higher confidence, SEO | Owner decision; review-rate tracking |
| UX-048 | Footer / Contact | Payment "chips" are text; no business identity (address, GSTIN) in footer; contact has no address/WhatsApp/form. | Weak legitimacy signals. | Add real registered business details and WhatsApp to Contact and footer (owner-supplied). | Medium | S | Increases trust | Owner confirms content; trust survey |
| UX-049 | Help access | WhatsApp floating CTA appears only on the homepage. | No help at PDP, cart, checkout, failure states. | Show a compact "Need help?" link/CTA on those pages, avoiding overlap with the sticky PDP bar. | Medium | S | Fewer abandoned sessions | WhatsApp click events; checkout drop-off |
| UX-050 | Fonts | 3 families; Outfit loaded on index only and never rendered; 6+4 weights; render-blocking CSS. | Extra bytes on the homepage; slower first paint. | Drop Outfit; trim weights; self-host with `preload`; add Devanagari fallback. | Medium | S | Faster first render | Lighthouse; network panel |
| UX-051 | Tokens: brand colours | Maroon (topbar, logo) vs orange (all UI) vs blue-grey footer; `--gold` is orange; `--espresso` is blue-grey. | Incoherent brand colour; misleading token names. | Owner decision; then consolidate to role-named tokens (`--color-brand`, `--color-action`, `--color-accent`). | Medium | M | Coherent brand and easier maintenance | Style-guide review |
| UX-052 | `.btn.ghost` | Class used on 11 pages has no CSS; renders as solid primary. | Three equal primary buttons; weak hierarchy. | Define `.btn.ghost` (or replace with `.btn.secondary`/text link). | Medium | S | Clear action hierarchy | Visual review |
| UX-053 | Inline styles and radii | 79 inline styles on checkout; radius 12-20px on success/cancel/track/stores/404/search vs flat system; spacing off-scale. | Inconsistent look; hard to maintain. | Extract utilities/components; use tokens for radius/spacing. | Medium | L | Consistent UI | Visual regression |
| UX-054 | 404.html | Relative asset paths break styling at deep URLs; no fonts; no search. | Unstyled 404 on bad deep links. | Use root-relative paths (`/assets/...`); add search and fonts. | Medium | S | Better recovery from bad links | Visit `/x/y/z` |
| UX-055 | Desktop nav submenus (821-1100px) | Submenus open on hover/focus-within only. | Touch tablets cannot open them. | Add a toggle button for submenus at that width; or use mobile nav up to 1024px. | Medium | M | Tablet navigation works | iPad test |
| UX-056 | Micro-typography | 9px badges, 10-11px labels, 11.5px uppercase topbar. | Hard to read; accessibility and age. | Minimum 11-12px for all UI text; set a type scale. | Medium | S | Legibility | Visual QA at 360px |
| UX-057 | Analytics/consent | GTM/GA loads unconditionally; `cookies.html` is policy only. | Compliance and trust risk under India's DPDP Act. | Decision on a minimal, non-intrusive consent notice; load GA after choice. | Medium | M | Compliance | Legal review; network panel |
| UX-058 | Motion | Card `fadeUp` runs on every card; hover lifts/transforms; reduced-motion covers only some rules. | Motion discomfort; perceived slowness. | Respect `prefers-reduced-motion` across all animations; shorten delays. | Medium | S | Comfortable motion | Emulate reduced-motion |
| UX-059 | Policy pages | Static fallback replaced by CMS copy after fetch; content shifts. | Layout shift and flash. | Hide the container until CMS returns or fetch before render; cache. | Low | S | Stable layout | Layout-shift trace |
| UX-060 | account.html | `.nav-item` class collides with header's `.nav-item` rule; only "Loading…" state; no `next` on login redirect. | Style bleed; users not returned after login. | Rename class; skeleton; pass `next`. | Low | S | Cleaner account | Visual and flow check |
| UX-061 | wishlist.html | `confirm()` on remove; "Error loading wishlist" with no retry; guests not told list is device-only. | Friction and uncertainty. | Toast with undo; retry button; guest note and login prompt. | Low | S | Better wishlist UX | Manual test |
| UX-062 | Icons | Emoji (success.html), unicode glyphs (lightbox ✕ ‹ ›, footer ♥) mixed with inline SVGs. | Inconsistent rendering across devices. | Use one SVG sprite/icon set. | Low | M | Consistent icons | Cross-device check |
| UX-063 | Compare | No compare feature. | Comparison needs multiple tabs. | Optional compare drawer once card metadata exists. | Low | L | Easier comparison | Usage metrics if built |
| UX-064 | supabase.js | Comment says pinned 2.49.1; import is 2.112.4 from esm.sh. | Misleading maintenance note; third-party CDN risk. | Fix comment; vendor the file with a lockfile. | Low | S | Safer maintenance | Code review |
| UX-065 | blog.html, blogs.html | `h1` empty until fetch; no related product link. | Blank page without JS; missed conversion. | Server/inline title fallback; add "Shop this" links. | Low | S | Better content to commerce | Click metrics |
| UX-066 | Breadcrumbs | PDP uses "← Sarees / name" pill; checkout uses text breadcrumbs; listings have none. | Inconsistent wayfinding. | One breadcrumb component site-wide (with JSON-LD). | Low | M | Clearer navigation | Visual QA |
| UX-067 | index.html "Most loved" | Section labelled "Customer Favourites"/"Most loved" is ordered by `view_count` (page views), not sales or wishlist adds. | Label implies social proof not backed by data. | Relabel ("Most viewed") or base on real favourites/orders (owner decision). | Low | S | Honest labelling | Copy review |

---

## 6. Proposed design-system improvements

### 6.1 Consolidated token list

**Rename / re-point**
- `--brand` -> `--color-action` (+ `-hover`, `-active`, `-subtle`); `--brand-light/-lighter` -> `--color-action-tint-10/-5`.
- `--brand-maroon` -> `--color-brand`; decide whether it also drives headings, prices and links (Section 8).
- `--gold` -> delete (it duplicates `--brand`). `--accent-gold` -> `--color-accent`, usable only for borders and large decorative elements, never as small text or a white-on-fill (3.23:1).
- `--espresso` / `--indigo` -> `--color-footer-bg` (decide on a maroon or near-black; stop calling a blue-grey "espresso").
- `--surface-warm` -> delete (duplicate). `--muted` -> delete or replace with `--color-text-muted` as a solid colour.

**Add**
- Text: `--color-text` (#1a1a1a), `--color-text-muted` (#6b6b6b, 5.33:1), `--color-text-on-action` (#fff).
- Borders: `--color-border-decorative` (#e8ded2, divider only), `--color-border-control` (>=3:1, e.g. #8a8178 around 3.7:1; compute before adoption).
- Semantic status: `--color-success`, `--color-warning`, `--color-danger`, `--color-info` and their `-bg` tints (replace `crimson`, `#166534`, `#b45309`, `#b91c1c`, `#c0540a`, `#9a3412`, `#64748b`, `#a13d3d`, `#3f6b4f`).
- Focus: `--focus-ring: 2px solid var(--color-action)`, `--focus-offset: 2px`.
- Type scale: `--text-xs 12`, `-sm 14`, `-md 16`, `-lg 18`, `-xl 22`, `-2xl 28`, `-3xl 36`, `-4xl 48`; line-heights `--lh-tight 1.2`, `--lh-body 1.6`.
- Spacing: extend to `--space-3xl 72`; add `--space-2xs 2`, `-xs 4`, `-sm 8`, `-md 16`, and use 12 or 24 explicitly instead of ad hoc 10/14/18/22.
- Radius: keep `--radius-none:0`; add `--radius-pill:999px` only for chips/badges; remove 12-20px usages.
- Control sizing: `--control-h-sm 36`, `--control-h 44`, `--control-h-lg 48`; `--tap-min 44`.
- Layers: `--z-sticky 500`, `--z-header 1000`, `--z-overlay 1100`, `--z-drawer 1200`, `--z-popup 2000`, `--z-modal 3000`.
- Breakpoints: document 480 / 768 / 980 / 1200 (use as comments or custom media tokens); remove the other values.
- Motion: `--motion-fast .15s`, `--motion-base .25s`, `--motion-slow .5s`, one easing token, plus a global reduced-motion override.

### 6.2 Reusable-component gaps

| Component | Current state | Gap / proposal |
|---|---|---|
| Product card | `.p-card` is duplicated as JS strings in `home.js`, `products.html`, `collection.html`, `new-arrivals.html`, `sale.html`, `wishlist.html`, `product.html` (related), `cart.html` (empty recs) | One shared `productCard()` module (the code comments already note the duplication); one metadata line; 44px wish button. |
| Button | `.btn`, `.btn.secondary`, `.btn-outline`, undefined `.btn.ghost`, inline-styled buttons (padding/font overrides in cart, checkout, orders) | Define sizes (`sm/md/lg`), variants (primary/secondary/ghost/danger/link), and a proper disabled state that keeps text contrast and explains why. |
| Form field | `.field` + `.input`, but labels vary (associated on login, unassociated on checkout, profile, track-ok) | Single `field()` helper that generates `id`/`for`, help text, error text with `aria-describedby`, and an invalid state with icon. |
| Toast / alert | None; native `alert`/`confirm` | Toast with `role="status"`, and an inline `role="alert"` banner for errors. |
| Modal / dialog | Four bespoke dialogs (drawer, welcome popup, sign-in popup, return modal, filter sheet, lightbox), each with different focus handling | One dialog helper: focus trap, `Escape`, `aria-modal`, return focus, scroll lock, labelled. |
| Loading state | `.skeleton` for grids; none for cart, PDP, account, orders | Skeleton blocks for PDP gallery/summary, cart lines and order cards; spinner-in-button for async actions. |
| Empty state | Styled in `collections`, `blogs`, `cart`; bare text elsewhere | One `empty-state` component (icon-free, heading, sentence, primary action). |
| Tabs / disclosure | PDP tabs, listing tabs, filter pills, accordion CSS (`.ac-item`) unused | One accessible tabs component and one disclosure component. |
| Header/footer | JS-rendered | Static include or build step (UX-026). |
| Trust strip | Home, PDP, cart-empty, checkout use four different markups | One `trust-strip` component fed from a single copy source. |

### 6.3 Icon system

- Today: ~15 inline SVGs in `ui.js` as template strings (stroke 1.8-2.2, mixed 14-20px), more inline in HTML, PNG icons for social in the site root (`instagram.png` and `youtube.png` are each about 497KB, `whatsapp.png` about 15KB, and `facebook.png` is only 6 bytes, so it is almost certainly a broken file), plus emoji (success.html) and Unicode glyphs (`✕ ‹ › ♥ ★ −`).
- Recommendation: a single SVG sprite (`<symbol>` set) referenced via `<use>`, with stroke width 1.8, `currentColor`, `aria-hidden="true"` by default and labels on the parent control. Replace emoji and glyph icons. Keep social icons as inline SVG (the footer already uses `iconInstagram()`/`iconWhatsApp()`); remove unused root PNGs after confirming nothing references them (verify before deleting).
- Do not use icon-only controls without an accessible name (lightbox, qty steppers, wishlist, close buttons).

---

## 7. Implementation batches

Each batch ships as one PR / one commit and is independently reversible. Hours are rough engineering time, excluding approval and owner decisions.

### Batch 1 — Accessibility foundations (UX-001, 004, 008, 009, 010, 011, 015, 017, 018, 019, 020, 030, 036, 037, 041)
- **Effort:** ~20h
- **Risk:** Low to Medium. It is mostly additive attributes and CSS; the lightbox and return-modal changes touch behaviour.
- **Validation checklist:**
  - [ ] axe DevTools: 0 critical/serious on index, product, cart, checkout, orders, login.
  - [ ] Keyboard-only run: skip link -> menu -> PDP zoom -> add to cart -> checkout fields -> return request.
  - [ ] NVDA or VoiceOver reads each checkout field's label.
  - [ ] Visible focus ring on every input, button, link and dialog control (>=3:1).
  - [ ] Contrast spot-check on MRP, SKU/stock, weave pill, footer hover and copyright.
  - [ ] `scroll-padding-top` verified with Tab to elements below the fold.
  - [ ] Existing regression suite (`tests/`) still passes (74 tests).

### Batch 2 — Cart, checkout and payment clarity (UX-002, 003, 005*, 006, 022, 042, 043, 044, 045)
- **Effort:** ~22h (+ guest-checkout work if approved). *UX-005 is decision-gated.
- **Risk:** High. It touches the payment path and the order summary. Use Razorpay test mode, and ship behind a quick revert.
- **Validation checklist:**
  - [ ] Mobile checkout: total, coupon, and Cash visible before Pay at 360px and 390px.
  - [ ] Each validation error appears beside its field and is announced; focus goes to the first error.
  - [ ] Failure, cancel and pending landings show the right panel (Razorpay test cards: success, failure, user cancel).
  - [ ] Forged `success.html?...status=paid` no longer shows success or fires a purchase event.
  - [ ] Policy copy matches `returns.html` exactly.
  - [ ] Cart: clear/remove undo works; no new tab opens from line items.
  - [ ] GA4 events (`begin_checkout`, `purchase`) still fire once.

### Batch 3 — Mobile navigation, header, hero and touch targets (UX-012, 013, 014, 016, 031, 032, 033, 049, 055)
- **Effort:** ~16h
- **Risk:** Medium. Header changes affect every page.
- **Validation checklist:**
  - [ ] 360px, 390px and 768px screenshots of header, drawer and hero.
  - [ ] Drawer contains Account, Wishlist, Orders, Track.
  - [ ] All primary controls >=44px (DevTools measure) or the documented exception.
  - [ ] Hero pause works; reduced-motion stops autoplay.
  - [ ] Hindi logo legible on a real Android phone.
  - [ ] iPad: submenus reachable by touch.

### Batch 4 — Search, listings and product cards (UX-007, 034, 035, 038, 063)
- **Effort:** ~14h
- **Risk:** Low to Medium. Search queries change; test the backend load.
- **Validation checklist:**
  - [ ] 20 saved test queries (colour, fabric, weave, occasion, typos) return expected products.
  - [ ] Zero-result and error states show recovery links, with no raw messages.
  - [ ] Card metadata fits on one line at 320px.
  - [ ] Search input labelled; result count announced.
  - [ ] Supabase query time acceptable under the existing load-test (`loadtest/`), without hitting the live homepage with concurrent load.

### Batch 5 — PDP content, trust and conversion aids (UX-021, 023, 024*, 025, 028, 039, 040, 047*, 048, 067)
- **Effort:** ~22h. *UX-024 and UX-047 need owner decisions.
- **Risk:** Medium. PDP is the highest-traffic template.
- **Validation checklist:**
  - [ ] PDP skeleton and reserved image space: CLS < 0.1 in Lighthouse mobile.
  - [ ] Add to cart shows confirmation without navigation; Buy now still goes to checkout.
  - [ ] Policy summary text identical to CMS source.
  - [ ] "Fabric & care" block renders only populated fields (no empty labels).
  - [ ] Track Order accepts order ID + phone and returns the right shipment.
  - [ ] No invented reviews, badges or certifications anywhere.

### Batch 6 — Design-system consolidation (UX-046, 050, 051*, 052, 053, 056, 058, 062)
- **Effort:** ~24h. *UX-051 needs the brand-colour decision first.
- **Risk:** Medium. Broad visual impact; mostly token and class changes.
- **Validation checklist:**
  - [ ] Token diff reviewed; no unused tokens; no new hard-coded hex values.
  - [ ] Visual regression screenshots of 12 key pages at 360 / 768 / 1280px.
  - [ ] `.btn.ghost` renders as intended on policy, about, contact, track.
  - [ ] Toast and dialog components replace every `alert`/`confirm`.
  - [ ] Fonts: only two families requested; Lighthouse font-display passes.
  - [ ] Reduced-motion emulation: no animation remains.

### Batch 7 — Performance, resilience and housekeeping (UX-026, 027, 029, 054, 057*, 059, 060, 061, 064, 065, 066)
- **Effort:** ~22h (UX-026 is the large item; can be split off). *UX-057 needs a legal decision.
- **Risk:** Medium to High for UX-026 (touches every page); the rest are Low.
- **Validation checklist:**
  - [ ] Lighthouse mobile (Slow 4G) and WebPageTest before/after: LCP, CLS, TBT recorded.
  - [ ] With esm.sh blocked, the site still shows navigation and policy pages.
  - [ ] 404 renders styled at `/a/b/c`.
  - [ ] `stores.html` removed or complete.
  - [ ] Consent notice (if approved) does not block content and loads GA only after choice.
  - [ ] Regression suite and load test pass (do not run concurrent load against the live homepage URL).

**Suggested order:** 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7. Batches 1 and 2 carry the most conversion and compliance value. Batches 3 and 4 can run in parallel if capacity allows. Total about 140 engineering hours plus decisions.

---

## 8. Outstanding items / open questions for the brand owner

1. **Brand colour:** is the terracotta orange `#b5502f` being retired in favour of the maroon `#5F1D28`, or does orange stay as the action colour with maroon as the brand colour? (Drives UX-051 and the whole token rename.)
2. **Logo:** is the Hindi "अहम् स्त्री" mark the primary identity everywhere (header, footer, emails, social), with "AhamStree" as a descriptor? Can we get an SVG with the padding cropped?
3. **Guest checkout:** should checkout remain login-only (WhatsApp OTP + PIN), or may we offer guest checkout, or capture phone/OTP inline? Do you accept losing shoppers who do not use WhatsApp? (UX-005)
4. **Checkout structure:** single page (as now) or multi-step? I recommend keeping single-page and fixing mobile order and the sticky pay bar rather than building steps.
5. **Returns claim:** is the policy "defect-only, 48 hours" final? If so, the checkout tile must change; if you intend to offer 7-day returns, the policy, FAQ, order modal and metadata must all change instead. (UX-003)
6. **Customer reviews:** do you want product-level reviews? If yes, how will you collect them (post-delivery WhatsApp request, a form on the order page)? I will not add placeholder or sample reviews. The homepage testimonials are admin-managed, so please confirm they are all real customers. (UX-047)
7. **Popups:** keep the welcome and sign-in popups? If yes, when should they appear (after engagement rather than 600ms) and should they ever appear on the same page together? (UX-024)
8. **"Most loved" label:** relabel to "Most viewed" or base it on real favourites/orders? (UX-067)
9. **"End of Season Sale":** is it an actual time-bound sale? If it is permanent, rename it ("Sale" or "Offers") to protect trust.
10. **Business details:** can you supply registered business name, address, GSTIN and a support WhatsApp number for the footer and Contact page? (UX-048) Provide only what is true; no badges or certifications unless genuinely held.
11. **About page:** which factual specifics can you share (weaver cluster, number of artisans, how long a saree takes to weave)? Needed to replace generic copy without inventing facts.
12. **Stores page:** delete `stores.html`, or are physical stores planned? (UX-029)
13. **Consent/analytics:** do you want a minimal cookie notice? GA/GTM currently load without consent; a legal review against the DPDP Act is advisable. (UX-057)
14. **Server-side cart:** should logged-in users' carts sync across devices? (Journey 7)
15. **Search scope:** should search also cover SKU and occasion, and do you want typo tolerance (this may need a database change)? (UX-007)
16. **Hindi UI copy:** do you plan bilingual UI? If so, we need a Devanagari font stack and `lang` handling decisions before Batch 1.
17. **Hosting constraint:** GitHub Pages has no server rendering. Is a build step (static include, bundler) acceptable for header/footer and Supabase vendoring? (UX-026)
18. **Measurement:** may I add Core Web Vitals field reporting (web-vitals library to GA4) to replace the hypotheses in this document with real data?

---

*End of audit. No files other than this document were created or changed.*
