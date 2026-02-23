# AhamStree — Codebase Context (GitHub Pages + Supabase + Razorpay)

This README is meant to be a **“context handoff”**. When you come back later and want to change something, you can share *this file* (plus the few files you’re editing) and we won’t need to re-explain the whole project.

---

## 1) What this project is

**AhamStree** is a static e‑commerce site hosted on **GitHub Pages** (pure HTML/CSS/JS).  
Backend capabilities (auth, database, server logic) are handled by **Supabase**:

- **Supabase Auth**: login / session
- **Supabase Postgres**: products, orders, coupons, etc.
- **Supabase Storage**: invoice PDFs (bucket: `invoices`)
- **Supabase Edge Functions (Deno/TypeScript)**: checkout + payments + admin + shipping tracking

Payments are done via **Razorpay Payment Links**.  
Shipping tracking is done via **Shiprocket** (tracking by AWB).

Domain (from `CNAME`): **www.ahamstree.com**

---

## 2) Repo / folder layout

### Website (GitHub Pages repo)
Top-level is a static site:

- Pages (examples):
  - `index.html` (home)
  - `products.html` (listing + filters)
  - `product.html` (PDP)
  - `cart.html`, `checkout.html`, `success.html`, `cancel.html`
  - `orders.html`, `account.html`, `profile.html`
  - `admin.html`, `admin-orders.html`
  - `blogs.html`, `blog.html`
  - `track.html` (Shiprocket tracking)
- `/assets/`
  - `supabase.js` → Supabase URL + anon key + client init
  - `safe.js` → escaping + safe URL helpers (XSS safety)
  - `ui.js` → header/footer rendering + auth UI
  - `home.js`, `search.js`, `filters.js` → page logic
  - `cart.js` → cart stored in `localStorage`
  - `wishlist.js` → wishlist (localStorage for guests; DB for logged-in users)
  - `styles.css`

### Supabase Edge Functions (separate folder/zip you shared)
Functions found in `/functions/`:

- `quote-order`
- `create-payment-link`
- `create-cod-order`
- `razorpay-webhook`
- `shiprocket-track`
- `admin-orders`
- `admin-generate-invoice`
- `admin-regenerate-payment-link`
- `admin-dashboard` (**⚠️ currently looks wrong / mismatched; see “Known issues”**)

---

## 3) How the site works (high-level)

### Cart (frontend-only)
- Cart is stored in browser local storage:
  - Key: `ahamstree_cart_v1`
- Coupon code is also stored locally:
  - Key: `ahamstree_coupon`

### Products browsing
- `products.html` queries `products` and supports:
  - `category` (example: `saree`)
  - filters by `fabric_id`, price range, stock
  - sorting by `view_count`, `created_at`, price

### Checkout
- `checkout.html`:
  1. Shows cart summary and stock checks using `products.inventory_qty` and `products.reserved_qty`
  2. Calls **`quote-order`** to compute totals (subtotal, discount, GST, shipping, total)
  3. On submit:
     - **Online pay** → calls **`create-payment-link`** → redirects to Razorpay payment link
     - **COD** → calls **`create-cod-order`** → redirects to `success.html?method=cod&order_id=...`

### Razorpay payment completion
- Razorpay hits your webhook edge function **`razorpay-webhook`**
- That function verifies webhook signature and updates `orders.status` (e.g., `paid` / `failed`) and logs `order_events`

### Tracking
- `track.html` calls **`shiprocket-track`** with an AWB (public lookup) or order_id (owner check best-effort).

### Admin
- `admin.html` shows dashboard stats via **`admin-dashboard`** (but function code seems mismatched right now).
- `admin-orders.html` loads orders via **`admin-orders`**
- Admin actions:
  - generate invoice → **`admin-generate-invoice`** (PDF, stored in Storage bucket `invoices`)
  - regenerate payment link → **`admin-regenerate-payment-link`** (⚠️ implementation is in `intex.ts`)

---

## 4) Supabase client config (frontend)

File: `assets/supabase.js`

- Uses `@supabase/supabase-js@2` via ESM import
- **SUPABASE_URL** and **SUPABASE_ANON_KEY** are currently hard-coded in that file.

✅ It’s normal for the anon key to be public.  
❌ Do **not** ever put service role keys or Razorpay secrets in frontend code.

---

## 5) Database overview

### Key tables & relationships (conceptual)

- `products` (UUID id)  
  ↳ `product_images` (many images per product, ordered by `sort_order`)  
  ↳ `product_specs` (label/value list)  
  ↳ `product_sections` (content blocks on product page)

- `collections` (bigint id)  
  ↳ `collection_products` (joins collection_id ↔ product_id, optional `sort_order`)

- `carts` (uuid)  
  ↳ `cart_items` (uuid row id)

- `orders` (uuid)  
  ↳ `order_items`  
  ↳ `order_events` (audit trail)  
  ↳ `coupon_redemptions` (logging coupon usage)

- `coupons` (definitions)  
- `admin_users` (emails allowed to use admin pages)

### Important “stock locking” concept
`create-payment-link` (and COD flow) call Postgres RPC functions:

- `reserve_stock(...)` → returns a `reservationId`  
- `release_stock_reservation(...)` → releases reserved stock on failure/timeouts

Your `orders` table includes `reservation_id` (uuid).  
So you likely have a reservations table behind the scenes (or reservations encoded inside those RPCs).

---

## 6) Database schema snapshot you provided

Below is the schema list you pasted (verbatim).  
If your schema changed since then, update this section.

| table_name          | column_name               | data_type                | is_nullable |
| ------------------- | ------------------------- | ------------------------ | ----------- |
| admin_users         | email                     | text                     | NO          |
| admin_users         | created_at                | timestamp with time zone | NO          |
| blog_posts          | id                        | bigint                   | NO          |
| blog_posts          | title                     | text                     | NO          |
| blog_posts          | slug                      | text                     | NO          |
| blog_posts          | excerpt                   | text                     | YES         |
| blog_posts          | content                   | text                     | NO          |
| blog_posts          | cover_image_url           | text                     | YES         |
| blog_posts          | is_published              | boolean                  | NO          |
| blog_posts          | published_at              | timestamp with time zone | YES         |
| cart_items          | id                        | uuid                     | NO          |
| cart_items          | cart_id                   | uuid                     | NO          |
| cart_items          | product_id                | uuid                     | NO          |
| cart_items          | qty                       | integer                  | NO          |
| cart_items          | price_inr_at_time         | integer                  | NO          |
| cart_items          | created_at                | timestamp with time zone | NO          |
| cart_items          | updated_at                | timestamp with time zone | NO          |
| carts               | id                        | uuid                     | NO          |
| carts               | user_id                   | uuid                     | NO          |
| carts               | status                    | text                     | NO          |
| carts               | created_at                | timestamp with time zone | NO          |
| carts               | updated_at                | timestamp with time zone | NO          |
| collection_products | collection_id             | bigint                   | NO          |
| collection_products | product_id                | uuid                     | NO          |
| collection_products | sort_order                | integer                  | YES         |
| collections         | id                        | bigint                   | NO          |
| collections         | name                      | text                     | NO          |
| collections         | slug                      | text                     | NO          |
| collections         | description               | text                     | YES         |
| collections         | cover_image_url           | text                     | YES         |
| collections         | is_active                 | boolean                  | NO          |
| collections         | created_at                | timestamp with time zone | NO          |
| coupon_redemptions  | id                        | bigint                   | NO          |
| coupon_redemptions  | coupon_code               | text                     | NO          |
| coupon_redemptions  | email                     | text                     | NO          |
| coupon_redemptions  | order_id                  | text                     | YES         |
| coupon_redemptions  | created_at                | timestamp with time zone | NO          |
| coupons             | id                        | bigint                   | NO          |
| coupons             | code                      | text                     | NO          |
| coupons             | email                     | text                     | YES         |
| coupons             | type                      | text                     | NO          |
| coupons             | value                     | numeric                  | NO          |
| coupons             | active                    | boolean                  | NO          |
| coupons             | expires_at                | timestamp with time zone | YES         |
| coupons             | max_uses                  | integer                  | YES         |
| coupons             | used_count                | integer                  | NO          |
| coupons             | created_at                | timestamp with time zone | NO          |
| fabrics             | id                        | bigint                   | NO          |
| fabrics             | name                      | text                     | NO          |
| fabrics             | slug                      | text                     | NO          |
| fabrics             | description               | text                     | YES         |
| fabrics             | sort_order                | integer                  | NO          |
| fabrics             | is_active                 | boolean                  | NO          |
| fabrics             | created_at                | timestamp with time zone | NO          |
| order_events        | id                        | uuid                     | NO          |
| order_events        | order_id                  | uuid                     | NO          |
| order_events        | event_type                | text                     | NO          |
| order_events        | payload                   | jsonb                    | YES         |
| order_events        | created_at                | timestamp with time zone | NO          |
| order_items         | id                        | uuid                     | NO          |
| order_items         | order_id                  | uuid                     | NO          |
| order_items         | product_id                | uuid                     | NO          |
| order_items         | title                     | text                     | NO          |
| order_items         | qty                       | integer                  | NO          |
| order_items         | price_inr                 | integer                  | NO          |
| order_items         | created_at                | timestamp with time zone | NO          |
| orders              | id                        | uuid                     | NO          |
| orders              | user_id                   | uuid                     | NO          |
| orders              | cart_id                   | uuid                     | YES         |
| orders              | status                    | text                     | NO          |
| orders              | subtotal_inr              | integer                  | NO          |
| orders              | shipping_inr              | integer                  | NO          |
| orders              | total_inr                 | integer                  | NO          |
| orders              | razorpay_payment_link_id  | text                     | YES         |
| orders              | razorpay_payment_link_url | text                     | YES         |
| orders              | created_at                | timestamp with time zone | NO          |
| orders              | updated_at                | timestamp with time zone | NO          |
| orders              | customer_name             | text                     | YES         |
| orders              | customer_phone            | text                     | YES         |
| orders              | shipping_address          | jsonb                    | YES         |
| orders              | invoice_path              | text                     | YES         |
| orders              | invoice_url               | text                     | YES         |
| orders              | reservation_id            | uuid                     | YES         |
| orders              | customer_email            | text                     | YES         |
| orders              | coupon_code               | text                     | YES         |
| orders              | discount_inr              | integer                  | NO          |
| orders              | gst_inr                   | integer                  | NO          |
| orders              | shiprocket_awb            | text                     | YES         |
| orders              | payment_method            | text                     | NO          |
| orders              | razorpay_payment_id       | text                     | YES         |
| product_images      | id                        | uuid                     | NO          |
| product_images      | product_id                | uuid                     | NO          |
| product_images      | image_url                 | text                     | NO          |
| product_images      | sort_order                | integer                  | NO          |
| product_images      | alt_text                  | text                     | YES         |
| product_images      | created_at                | timestamp with time zone | NO          |
| product_sections    | id                        | bigint                   | NO          |
| product_sections    | product_id                | uuid                     | YES         |
| product_sections    | title                     | text                     | NO          |
| product_sections    | content                   | text                     | NO          |

---

## 7) Tables/columns referenced in code (please confirm they exist)

These are referenced by the HTML/JS but were **not** in the pasted schema snippet above:

### `products` (required)
Seen fields in queries:
- `id` (uuid), `title`, `description`, `sku`
- `price_inr`, `sale_price_inr`
- `inventory_qty`, `reserved_qty`
- `is_active`
- `created_at`, `view_count`
- `category` (used for type filter)
- `fabric_id` (FK to `fabrics.id`)

### `product_specs` (optional but used on product page)
- `product_id`, `label`, `value`, `sort_order`

### `profiles` (used by `profile.html`)
- `user_id` (uuid), plus typical shipping fields:
  - `full_name`, `phone`, `address_line1`, `address_line2`, `city`, `state`, `pincode`
  - `updated_at`

### Wishlist table (name needs to be consistent)
`assets/wishlist.js` currently uses:
- `wishlist_items` (recommended), but code comments mention older name `wishlists`
- Expected fields: `user_id`, `product_id`
- Suggested: unique constraint on `(user_id, product_id)` to prevent duplicates

### `return_requests` (optional / TODO feature)
`product.html` inserts return requests:
- `order_id`, `product_id`, `reason`, `status` (e.g. `"requested"`)

---

## 8) Supabase Edge Functions — what each one does

### `quote-order` (should be public)
Purpose: returns server-side quote totals (subtotal/discount/GST/shipping/total) and stock issues.  
Input (POST JSON):
```json
{
  "cart": [{ "product_id": "uuid", "qty": 2 }],
  "coupon_code": "WELCOME10",
  "shipping_inr": 0
}
```
Output includes: `items[]`, `subtotal_inr`, `discount_inr`, `gst_inr`, `total_inr`, `issues[]`, `ok`.

**Important:** Checkout calls this even for guests. If Supabase function JWT verification is enabled, guests will get 401.  
➡️ Make sure `verify_jwt = false` for this function.

### `create-payment-link` (requires login)
Purpose:
- validates cart + coupon
- reserves stock via `reserve_stock` RPC
- creates `orders` + `order_items`
- creates Razorpay payment link
- stores `orders.razorpay_payment_link_*`
- logs `order_events`

Returns: `payment_link_url` + `order_id` + totals.

### `create-cod-order` (requires login)
Purpose:
- same server-side totals + reserve stock
- creates order with:
  - `payment_method: "cod"`
  - `status: "confirmed"`
- logs `order_events` (`cod_order_confirmed`)

### `razorpay-webhook` (public, signature-protected)
Purpose:
- verifies `x-razorpay-signature` using `RAZORPAY_WEBHOOK_SECRET`
- finds the order (by `reference_id` or `razorpay_payment_link_id`)
- updates `orders.status` to `paid` or `failed`
- logs webhook payload in `order_events`

### `shiprocket-track` (should be public)
Purpose:
- fetch tracking from Shiprocket using `SHIPROCKET_EMAIL` + `SHIPROCKET_PASSWORD`
- accepts:
  - `{ "awb": "..." }` (guest allowed)
  - or `{ "order_id": "..." }` (tries to check owner if JWT present)

➡️ `track.html` calls it without auth, so `verify_jwt` likely needs to be `false`.

### `admin-orders` (requires admin)
Purpose:
- admin-only list of recent orders (with `order_items`)
- supports `?status=...&q=...` (q matches order id or phone)

Admin check:
- takes JWT from `Authorization: Bearer <token>`
- checks logged-in user email exists in `admin_users`

### `admin-generate-invoice` (requires admin)
Purpose:
- generates a PDF invoice (pdf-lib)
- uploads to Storage bucket: `invoices`
- updates `orders.invoice_path`
- returns a signed URL (valid 7 days)

### `admin-regenerate-payment-link` (requires admin) — ⚠️ file naming
There are two files:
- `index.ts` → placeholder “Hello from Functions!”
- `intex.ts` → actual implementation (regenerates Razorpay payment link)

➡️ To make this function work, rename `intex.ts` → `index.ts` (or deploy the correct file).

### `admin-dashboard` — ⚠️ likely incorrect
`admin.html` expects metrics like:
- `ordersCount`, `usersCount`, `paidCount`, `pendingCount`, `failedCount`, `expiredCount`, `revenuePaidInr`

But the current `admin-dashboard/index.ts` looks like a Razorpay webhook handler (expects `x-razorpay-signature` and raw webhook body).  
➡️ This likely needs to be replaced with a real “dashboard metrics” function.

---

## 9) Edge Function environment variables (Supabase secrets)

Set these in Supabase (Functions → Secrets). Do **not** commit secrets in GitHub.

### Supabase
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Pricing / taxes
- `GST_RATE` (example: `0.05` for 5%)
- `GST_INCLUDED` (`true` / `false`)
- `DEFAULT_SHIPPING_INR` (example: `0` or `99`)
- `RESERVATION_TTL_MINUTES` (example: `20`)

### Razorpay
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `PAYMENT_CALLBACK_URL` (example: `https://www.ahamstree.com/success.html`)

(Older code variant used `PUBLIC_SITE_URL` to build the callback URL.)

### Shiprocket
- `SHIPROCKET_EMAIL`
- `SHIPROCKET_PASSWORD`

---

## 10) Running locally (for quick testing)

Because scripts use ES Modules (`type="module"`), you must run a local web server (not `file://`).

Simple option:
1. Open terminal in the site folder
2. Run:
   - `python -m http.server 8080`
3. Open:
   - `http://localhost:8080`

---

## 11) Deploying

### Website (GitHub Pages)
- Push commits to the branch that GitHub Pages serves (often `main`).
- Changes typically appear within a couple of minutes.
- `CNAME` controls custom domain.

### Supabase Edge Functions
Typical flow (high-level):
1. Install Supabase CLI
2. Login + link to your project
3. Deploy functions you changed

If you tell me:
- your project ref (or you can paste the exact CLI commands you’re using)
- which function you changed

…I can write exact copy-paste commands.

---

## 12) Known issues / TODO list (important)

1. **`admin-dashboard` function mismatch**  
   Admin page expects dashboard metrics, but function code behaves like webhook handler.

2. **`admin-regenerate-payment-link` uses `intex.ts`**  
   `index.ts` is a placeholder. Rename or deploy the correct file.

3. **`verify_jwt` likely needs to be disabled** on:
   - `quote-order` (guest quote)
   - `shiprocket-track` (guest tracking by AWB)
   Possibly others depending on your intended security model.

4. **Wishlist table name mismatch**  
   Code mentions `wishlists` vs `wishlist_items`. Pick one and keep consistent.

5. **Return requests**  
   `product.html` has a return request insert, but it notes you still need the `return_requests` table + RLS policies.

---

## 13) “How to ask ChatGPT for changes later” (copy/paste template)

When you want an update, send:

1) What you want to change (in plain English)  
2) Which page/function it touches  
3) Any constraints (must keep existing DB, must not break checkout, etc.)  
4) Attach the specific files (or paste snippets) you changed

Template:
```
Here’s the current project context (README attached).
Change request:
- Goal:
- Pages affected:
- Edge functions affected:
- DB changes needed (yes/no):
- What should stay the same:
Files:
- <upload or paste relevant files>
```

---

## 14) Quick glossary (helps future you)

- **Anon key**: safe to use in frontend; RLS still protects data.
- **Service role key**: powerful secret; only use in Edge Functions.
- **Payment Link**: Razorpay hosted payment page URL.
- **AWB**: Air Waybill number from Shiprocket used for tracking.
- **RLS**: Row Level Security; controls which rows users can read/write.
