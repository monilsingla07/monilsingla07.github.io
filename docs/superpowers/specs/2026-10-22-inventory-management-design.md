# Inventory Management Module — Design

Date: 2026-10-22
Status: Approved for implementation planning
Scope: AhamStree (Supabase backend + GitHub Pages storefront)

## 1. Goal

Add a serialized, per-piece inventory module. Each physical saree becomes a tracked piece with a unique QR tag. Pieces back website SKUs (SKU-grouped listings, piece-level stock) and can also be sold at the shop counter by scanning the tag. Inventory becomes the primary entrypoint for adding stock; publishing a SKU online is a separate decision.

Non-goals (v1): split payments at POS; piece-level per-photo per bulk-add; piece statuses beyond in-stock/sold; multi-location inventory; camera scanning.

## 2. User-facing flows

### 2.1 Intake (shop staff adds pieces)
1. Open `admin-inventory.html` → **Add inventory**.
2. Pick an existing SKU or create a new SKU inline (name + selling price + optional thumbnail). New SKUs default `inventory_managed=true`, `visible_on_site=false`.
3. Enter quantity, cost price, weaver, optional photo.
4. **Create & print** → serials generated, pieces written, `print-labels.html` opens with the serial list queued for the Seznik thermal printer.

### 2.2 Publish online (separate step)
From `admin-products.html`, open the SKU and flip `visible_on_site=true` once ready (photos, description, price confirmed). Storefront immediately starts listing it; stock is piece-count driven.

### 2.3 POS sale
1. Staff opens `admin-pos.html` at the counter.
2. Scans a QR → line item added. Repeats for every piece in the bill.
3. Captures customer (phone-lookup / walk-in / anonymous), picks payment method (Cash / UPI / Card), optional discount.
4. **Charge** → `pos-checkout` writes an `orders` row with `source='pos'`, flips pieces to `sold`, records payment. Receipt pops up for thermal print.

### 2.4 Online sale
Unchanged from the customer's perspective. On order payment/confirmation, `assign-pieces-to-order` runs server-side: picks the oldest `in_stock` piece per inventory-managed line item (FIFO), flips to `sold`, records `sold_via='online'`, `order_id`.

### 2.5 Return / cancel
Admin accepting a return (or a cancelled paid order) chooses per piece: **Restock** (piece → `in_stock`, cleared sold fields) or **Discard** (piece row deleted). Trigger brings `products.stock` back in sync automatically.

## 3. Data model

### 3.1 New table `inventory_pieces`

| column | type | notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `serial` | text unique not null | human-readable, format `AHM-{seq:05d}`; QR payload |
| `product_id` | uuid not null references `products(id)` on delete restrict | the SKU |
| `status` | text not null check in (`'in_stock'`, `'sold'`) default `'in_stock'` | |
| `cost_price` | numeric(10,2) not null | per-piece cost |
| `weaver_name` | text | nullable |
| `photo_url` | text | nullable; Supabase Storage path (bucket `inventory-pieces`) |
| `intake_date` | timestamptz not null default `now()` | |
| `sold_at` | timestamptz | null until sold |
| `sold_via` | text check in (`'pos'`, `'online'`) | null until sold |
| `order_id` | uuid references `orders(id)` on delete set null | null for in-stock pieces |
| `created_at` | timestamptz not null default `now()` | |
| `updated_at` | timestamptz not null default `now()` | updated by trigger |

Indexes:
- `inventory_pieces_product_status_idx` on `(product_id, status)` — serves count + FIFO.
- `inventory_pieces_serial_idx` unique on `(serial)` — POS/search lookup.
- `inventory_pieces_order_idx` on `(order_id)` — reverse lookup for invoice/order views.

### 3.2 Serial generator
Postgres sequence `inventory_piece_seq` starting at 1. Serial formatted at write time: `'AHM-' || lpad(nextval('inventory_piece_seq')::text, 5, '0')`. Encapsulate in SQL function `generate_inventory_serial()` so callers never collide.

### 3.3 Changes to existing `products` table
- Add `inventory_managed boolean not null default false`.
- Add `visible_on_site boolean not null default true` — defaults to true so **existing products are unaffected** (they stay listed on the storefront as today). New SKUs created via the inventory flow explicitly set it to `false`.

**Important:** before writing the migration, confirm against the live Supabase schema whether a visibility flag already exists on `products` (e.g. `status`, `active`, `published`). If so, reuse it instead of adding `visible_on_site`.

### 3.4 Stock-sync trigger
`AFTER INSERT OR UPDATE OR DELETE ON inventory_pieces` function:
```sql
if the affected product has inventory_managed = true:
  update products
     set stock = (select count(*) from inventory_pieces
                   where product_id = <affected_id> and status = 'in_stock')
   where id = <affected_id>;
```
Keeps `products.stock` authoritative for all current storefront reads (listings, product page, cart, search, sitemap). **Zero storefront code changes required**.

### 3.5 RLS
- `inventory_pieces`: select/insert/update/delete allowed only for authenticated admin role (match the pattern used by `orders` admin tables).
- Serial lookup for POS is admin-only — POS is behind admin auth already.
- Storefront never reads `inventory_pieces` directly; it reads only `products.stock`.

### 3.6 Storage
New bucket `inventory-pieces` for per-piece photos. Admin-only read/write RLS.

## 4. Admin surfaces (frontend, `site/`)

### 4.1 `admin-inventory.html` (new, primary entrypoint)
- Header: **Add inventory** button (opens intake modal as described in 2.1).
- KPI strip: in-stock count, inventory value at cost (sum of `cost_price` where `in_stock`), pieces added this month, pieces sold this month. Served by `inventory-stats`.
- Ledger table: serial, product (thumbnail + name), status pill, cost, weaver, intake date, sold date, sold via, order link.
- Filters: status, SKU (searchable dropdown), weaver, date range.
- Search box at top of table: scan or type a serial → scrolls/filters to that piece.
- Export CSV.
- Row actions on in-stock pieces: Reprint QR, Edit (cost/weaver/photo), Delete.
- Row actions on sold pieces: view linked order (read-only).

### 4.2 `admin-products.html` (modifications)
- Toggle **Inventory-managed** on the SKU edit panel. When on:
  - New section "Pieces" showing live counts (in stock / sold / total) and a table of this SKU's pieces (serial, status, intake date, cost, weaver, thumbnail).
  - **Add piece** button (modal with cost/weaver/photo → creates one piece, opens single-label print).
  - **Add N pieces** button (same modal + qty → creates N, opens multi-label print).
- Toggle **Visible on site** (`visible_on_site`). Independent of inventory-managed. The "publish online" lever.

### 4.3 `admin-pos.html` (new)
- Fixed, always-focused hidden `<input>` captures scans. Any keypress anywhere refocuses it. Visible "Scan a QR" prompt and last-scanned confirmation.
- Centre pane: bill (thumbnail, product name, serial, price, remove ✕). Subtotal, discount input, total.
- Right rail: customer block — phone lookup (hits existing user-lookup endpoint) autofills name/address, or walk-in (name + phone free-text), or anonymous. Payment method radio: Cash / UPI / Card. (No split in v1.)
- Bottom bar: **Charge** (disabled until bill ≥ 1 line). After successful charge: **Print receipt** (opens receipt popup), **New sale** (clears state).
- Keyboard shortcuts: `F2` focus customer phone, `F9` charge, `Esc` clear.
- Scan outcomes:
  - `in_stock` → append line (SKU price), green flash.
  - `sold` → red toast "Already sold on {date} via {pos|online}".
  - unknown → red toast "Not found".
  - duplicate in current bill → ignore + buzz.
- Line items pending until Charge; no DB writes before.

### 4.4 `print-labels.html` (new)
- Reads serials from `?serials=…` or `sessionStorage` (long lists).
- Layout dropdown: **50×30mm**, **50×50mm**, **A4 grid (4×8 of 50×30)**.
- Per layout a `@page { size: Wmm Hmm; margin: 0; }` block; each label `page-break-after: always`.
- QR generated client-side with the `qrcode` browser library (CDN load, same pattern as existing site scripts). Payload = raw serial string.
- 50×30: QR + serial + truncated SKU name.
- 50×50: QR + serial + full product name + price.
- Big **Print** button → `window.print()` → Seznik's standard print dialog (paper size auto-selected from `@page`).

### 4.5 Admin nav
Add an "Inventory" link in the admin sidebar/menu alongside existing admin pages. Add a secondary "POS" link.

## 5. Edge functions (Supabase)

### 5.1 New
- **`admin-manage-inventory`** — actions: `list` (filter/paginate), `create` (single + bulk; generates serials from sequence, uploads optional photo to `inventory-pieces` bucket, returns created rows), `update` (cost/weaver/photo on in-stock only), `delete` (in-stock only), `get-by-serial`, `reprint` (returns serials to feed `print-labels.html`). Admin JWT required.
- **`pos-checkout`** — input `{ serials[], customer, payment_method, discount }`. In a single transaction:
  1. `SELECT id, product_id, status FROM inventory_pieces WHERE serial = any(?) FOR UPDATE;`
  2. If any piece is not `in_stock`, abort with details.
  3. Create `orders` row with `source='pos'`, line items derived from pieces' SKUs.
  4. Update each piece: `status='sold', sold_at=now(), sold_via='pos', order_id=<new order id>`.
  5. Record payment (reuse existing payments table pattern).
  6. Return `{ order_id, invoice_url }`.
  Admin JWT required.
- **`assign-pieces-to-order`** — input `{ order_id }`. Idempotent. For each line item on the order whose product is `inventory_managed=true` and that doesn't already have assigned pieces (query by `order_id`), FIFO-assign using:
  ```sql
  SELECT id FROM inventory_pieces
   WHERE product_id = ? AND status = 'in_stock'
   ORDER BY intake_date ASC, id ASC
   LIMIT <qty>
   FOR UPDATE SKIP LOCKED;
  ```
  Flip selected pieces to `sold`, record `sold_via='online'`, `order_id`. If fewer than qty available: assign what we have, flag the order with `inventory_shortage=true`, log alert. (With trigger-maintained stock this is a rare pure-race case.) Admin or service-role invocation.
- **`inventory-stats`** — returns the four KPIs for 4.1. Admin JWT.

### 5.2 Modified
One-line change each — call `assign-pieces-to-order(order_id)` after successful order confirmation:
- `razorpay-webhook` — on payment success branch.
- `create-cod-order` — after order row written.
- `admin-create-order` — after admin-side confirm.

Return / cancel handling:
- `cancel-order` — if the order has assigned pieces (any `inventory_pieces` with this `order_id` and `status='sold'`), flip them back to `in_stock`, clear `sold_at/sold_via/order_id`.
- `admin-manage-return` (and/or `shiprocket-return` wherever the "received back" state lands — confirm during spec-to-plan): accept `restock_decision` per piece; apply **Restock** (flip to `in_stock`) or **Discard** (delete row).

Product management:
- `admin-manage-products` — accept and persist the two new flags (`inventory_managed`, `visible_on_site`). Reject toggling `inventory_managed` off if the SKU has any `in_stock` pieces (needs manual cleanup first).

Storefront reads:
- Wherever products are fetched for public pages (confirm by grep during spec-to-plan — likely `admin-manage-catalog` or a public-facing function), add `visible_on_site = true` to the WHERE clause. **Only** if an equivalent flag doesn't already exist — in which case reuse it.

Invoices:
- `get-order-invoice`, `admin-generate-invoice` — append the assigned serial beside each inventory-managed line item on the rendered invoice.

## 6. Edge cases & decisions

- **Race on online checkout** — `FOR UPDATE SKIP LOCKED` + the trigger-maintained `products.stock` make true overselling extremely rare. If it happens: `inventory_shortage=true` flag on the order, admin follow-up, Shiprocket shipment not created until resolved.
- **POS race** (two staff scan the same serial on two POS tabs) — `pos-checkout`'s `FOR UPDATE` fails one of them cleanly; UI shows "Already sold, scan another or refresh".
- **Deleting a piece** — only allowed on `in_stock`. Sold pieces are immutable history.
- **Deleting a product** — `on delete restrict` on the FK prevents deleting a SKU that has any pieces. User must discard/restock-and-sell all pieces first.
- **Reprint** — idempotent, no DB write beyond an optional audit log (out of v1).
- **Serial collisions** — impossible: sequence-backed, unique index enforces.
- **Legacy products** — unaffected. `inventory_managed=false` by default; manual stock behaviour preserved exactly.
- **Discounts at POS** — single order-level discount in v1 (percent or flat), captured on the `orders` row the same way web orders capture coupon discount.
- **Multi-piece same SKU in one POS bill** — each line is a distinct serial; UI shows them as separate rows (not qty-stacked) to make the printed receipt match the physical pieces exactly.
- **Negative inventory** — forbidden by the status check + trigger; `products.stock` cannot go below zero because it is derived.

## 7. Testing

### 7.1 Supabase / SQL
- Schema: serial uniqueness, status check constraint, sequence formatting, FK restrict on product delete.
- Trigger: insert increments stock, update to `sold` decrements, delete decrements, update of non-managed product leaves stock untouched.
- `admin-manage-inventory` function tests: single create, bulk create of N returns N distinct serials, delete rejected on sold, update rejected on sold.
- `pos-checkout`: happy path end-to-end; invalid serial rejection; already-sold rejection; concurrent-scan race (two parallel calls with overlapping serials → exactly one succeeds).
- `assign-pieces-to-order`: FIFO ordering honoured; idempotent on repeated call; undersupply logs + partial-assigns; concurrent-order race with low stock → each gets distinct pieces (FOR UPDATE SKIP LOCKED).
- Cancel/return path: restock flips back and trigger restores `products.stock`.

### 7.2 Playwright (regression suite at `tests/`)
- `admin-inventory.html` loads, KPIs render, ledger loads, serial search filters.
- `admin-products.html` reflects both new toggles.
- `admin-pos.html` loads; synthetic keystroke scan of a known test serial adds a line; Charge disabled on empty bill, enabled otherwise. Stop before actual charge (or route to a dedicated staging test SKU).
- Keep existing 74-test suite non-destructive and green.

### 7.3 Manual pre-launch checklist
1. Print a label at 50×30 and 50×50 on the Seznik → scanner reads the printed sticker (not just screen).
2. End-to-end POS sale with a real test piece → `admin-orders` shows it with `source='pos'`; invoice shows the serial.
3. End-to-end online order of an inventory-managed SKU in staging → piece auto-assigned, `sold_via='online'`, invoice shows serial.
4. Cancel a staged online order → piece returns to `in_stock`, product stock restored.

## 8. Rollout plan (summary — details go into the implementation plan)

1. Migration: new table, trigger, sequence, product flags. Shipped behind no feature flag — defaults keep every existing SKU behaving exactly as today.
2. Deploy new edge functions. Deploy modifications to existing functions (each is additive).
3. Deploy frontend pages (`admin-inventory.html`, `admin-pos.html`, `print-labels.html`) and additions to `admin-products.html`. Add nav links.
4. Pilot with one real SKU: switch it to `inventory_managed`, add real pieces, print labels, run POS sales for a day, verify online orders FIFO-assign correctly.
5. Roll out to remaining SKUs as photos/pricing are ready.

## 9. Open items to resolve during implementation planning

Flagged for the plan author to confirm against the live schema/codebase (not blocking approval of this design):
- Exact existing visibility column on `products`, if any — reuse it rather than adding `visible_on_site`.
- The precise public product-fetch function(s) that need the `visible_on_site` filter.
- The exact point in the return flow (`admin-manage-return` vs `shiprocket-return`) where the restock decision belongs.
- The existing payments-record pattern reused by `pos-checkout`.
- Whether the current `orders` schema has `source`; if not, add it.
