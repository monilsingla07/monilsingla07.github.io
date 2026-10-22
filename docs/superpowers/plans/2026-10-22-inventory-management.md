# Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a serialized per-piece inventory module for AhamStree with QR-tagged pieces, dedicated POS billing, and automatic FIFO assignment on online orders.

**Architecture:** New `inventory_pieces` table FK'd to existing `products`, with a trigger that keeps `products.stock` equal to the count of in-stock pieces for inventory-managed SKUs — so the storefront needs no changes. New admin pages (`admin-inventory`, `admin-pos`, `print-labels`) + modifications to `admin-products`. Four new edge functions and one-line hooks into six existing ones.

**Tech Stack:** Supabase (Postgres + Deno edge functions), vanilla HTML/CSS/JS storefront (no framework), `qrcode` browser lib via CDN for QR rendering, Playwright for regression.

**Spec:** [`docs/superpowers/specs/2026-10-22-inventory-management-design.md`](../specs/2026-10-22-inventory-management-design.md)

## Global Constraints

- Project id: `mgmgkwoxirvzdnmayhwq`. All migrations and function deploys go against this live project; there is no staging DB.
- Frontend lives in `site/` (git repo `monilsingla07/monilsingla07.github.io`). Edge functions live in `C:\Users\w\Documents\ahamstree\supabase\functions\` (not git-tracked; mirror of live).
- Serial format: `AHM-{seq:05d}`, sequence-backed, globally unique.
- Piece lifecycle: `in_stock | sold` only (simple).
- QR payload: raw serial string. Nothing else.
- Scanner: USB keyboard-emulation only; no camera path.
- Thermal printer: Seznik; label sizes 50×30mm and 50×50mm; fallback A4 grid (4×8).
- All inventory admin surfaces require authenticated admin role (same pattern as `admin-orders`).
- Storefront reads must not change behavior for existing SKUs (`inventory_managed=false` is the default and preserves current manual-stock paths exactly).
- Sync-then-deploy workflow: before each task, pull `main`; after each task's commit, push and deploy affected edge functions.
- Attribution: commits end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

## Review Focus

Inputs/failure modes the plan implies but no task's tests cover directly — reviewer should sanity-check these at the end:

1. **Concurrent POS scans of the same serial on two tabs** — exactly one `pos-checkout` call must succeed; the other returns "already sold" without creating a partial order. (Owning task: Task 7; test added in step 1 of Task 7.)
2. **Online checkout race on last piece** — two paid orders for a 1-stock SKU landing within the same second must not both receive the same piece. One gets the piece, the other is flagged `inventory_shortage=true`. (Owning task: Task 10; test added in step 1 of Task 10.)
3. **Returning a piece whose SKU was deleted or re-flagged** — restocking a piece must still succeed even if the parent product has had `inventory_managed` flipped off while the piece was sold. (Owning task: Task 12; test added in step 1 of Task 12.)
4. **Deleting a product that still has pieces** — must be rejected by FK `on delete restrict`, surfaced as a clear admin error, not a 500. (Owning task: Task 5; test added in step 1 of Task 5.)
5. **Serial typed by hand into POS instead of scanned (whitespace / case)** — leading/trailing whitespace and lower/upper case variants must still resolve to the right piece or fail cleanly, never match the wrong piece. (Owning task: Task 7; test added in step 1 of Task 7.)

---

## Phase 1 — Data model & intake

### Task 1: Migration — table, trigger, product flags, storage bucket

**Files:**
- Create: `supabase/migrations/2026-10-22_inventory_pieces.sql` (new; keep locally even though the folder isn't tracked — paste into Supabase SQL editor to apply)
- Modify: live `products` table (via migration)
- Create: Supabase Storage bucket `inventory-pieces` (admin-only RLS)

**Interfaces produced:**
- Table `inventory_pieces` with columns per spec §3.1.
- Sequence `inventory_piece_seq`; SQL function `generate_inventory_serial() returns text`.
- Trigger `inventory_pieces_stock_sync` on `AFTER INSERT/UPDATE/DELETE`.
- Columns on `products`: `inventory_managed boolean not null default false`, and `visible_on_site boolean not null default true` **only if no equivalent flag already exists** (confirm via `list_tables` before writing the migration).

- [ ] **Step 1: Confirm existing `products` schema**

Use Supabase MCP `list_tables` for schema `public`. Identify whether `products` already has a visibility column (`status`, `active`, `published`, etc.). If yes, reuse it in all later tasks and skip adding `visible_on_site`. Record the chosen column name as `<VISIBILITY_COL>` in the migration file as a SQL comment.

- [ ] **Step 2: Write the migration SQL**

Include: `create sequence`, `create function generate_inventory_serial`, `create table inventory_pieces` (columns and indexes per spec §3.1), status check constraint, FK `on delete restrict` on `product_id`, FK `on delete set null` on `order_id`, `updated_at` touch trigger, the stock-sync trigger function + trigger, `alter table products add column inventory_managed`, and conditionally `visible_on_site`.

- [ ] **Step 3: Apply the migration**

Use `apply_migration` via Supabase MCP with the SQL from Step 2. Expected: success, no errors.

- [ ] **Step 4: Create storage bucket `inventory-pieces` with admin-only RLS**

Via Supabase dashboard or SQL. Verify via `list_tables`/dashboard.

- [ ] **Step 5: Verification queries**

Run via `execute_sql`:
- `select generate_inventory_serial();` → returns `AHM-00001`.
- `insert into inventory_pieces (product_id, cost_price, serial) values (<any existing product id>, 1000, generate_inventory_serial()); select stock from products where id = <that id>;` — if the product is `inventory_managed=false`, stock unchanged; set `inventory_managed=true` on it and insert another piece → stock increments by 1.
- Delete the test pieces and reset `inventory_managed` on the test product.

- [ ] **Step 6: Commit**

```bash
git add site/docs/superpowers/plans/*.md
# migration file lives outside site/ (supabase/migrations/) and is intentionally untracked per project memory
git commit -m "feat(inventory): migration applied — inventory_pieces, trigger, product flags"
```

---

### Task 2: `admin-manage-inventory` edge function

**Files:**
- Create: `supabase/functions/admin-manage-inventory/index.ts`

**Interfaces produced:**
- POST endpoint accepting `{ action: 'list' | 'create' | 'update' | 'delete' | 'get-by-serial' | 'reprint', ...payload }`.
- `create` payload: `{ product_id, qty, cost_price, weaver_name?, photo_url?, new_sku?: { name, selling_price, thumbnail_url? } }` — if `new_sku` is set, creates the product first (inventory_managed=true, `<VISIBILITY_COL>`=false) and uses its id. Returns `{ serials: string[], product_id }`.
- `list` payload: `{ status?, product_id?, weaver?, date_from?, date_to?, serial_contains?, limit, offset }`. Returns `{ rows, total }`.
- `update` only on `in_stock` pieces; fields: `cost_price`, `weaver_name`, `photo_url`.
- `delete` only on `in_stock` pieces.
- `get-by-serial`: `{ serial }` → full piece row or 404.
- `reprint`: `{ ids: uuid[] }` → `{ serials: string[] }`.

**Consumes:** Admin JWT verification helper used by other admin functions (grep `supabase/functions/admin-*` for the pattern).

- [ ] **Step 1: Write failing tests**

Tests in `tests/` (new file `tests/inventory-admin.spec.ts` under Playwright suite OR via direct HTTP calls in a Deno test file alongside the function — follow whichever pattern existing functions use; grep `supabase/functions/*/test*` first).

Test names:
- `create single piece returns one serial and stock increments`
- `create bulk of N pieces returns N distinct serials`
- `delete rejects on sold piece`
- `update rejects on sold piece`
- `get-by-serial returns piece by exact match`
- `create with new_sku provisions product with inventory_managed=true and visibility off`

- [ ] **Step 2: Run tests to verify they fail**

Expected: function not deployed, 404s.

- [ ] **Step 3: Implement `supabase/functions/admin-manage-inventory/index.ts`**

Pattern: match `admin-manage-products` (CORS, admin JWT check, action switch, service-role Supabase client). Each action maps to a single parameterised SQL. Use `generate_inventory_serial()` for every piece insert.

- [ ] **Step 4: Deploy and run tests**

Use `deploy_edge_function`. Expected: all six tests pass.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "feat(inventory): admin-manage-inventory edge function"
```

---

### Task 3: `print-labels.html` — QR generation and print view

**Files:**
- Create: `site/print-labels.html`
- Create: `site/scripts/print-labels.js`
- Create: `site/assets/print-labels.css`

**Interfaces produced:**
- URL: `/print-labels.html?serials=AHM-00001,AHM-00002&layout=50x30|50x50|a4`.
- Also reads from `sessionStorage.inventorySerials` when the list is too long for a URL.
- Layouts: `50x30`, `50x50`, `a4` (4×8 of 50×30).

**Consumes:** `qrcode` browser build from CDN (`https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js`).

- [ ] **Step 1: Write failing Playwright test**

In `tests/`, add `inventory-print.spec.ts`:
- `print-labels page renders N QR svgs for N serials` — navigate to `print-labels.html?serials=AHM-00001,AHM-00002,AHM-00003&layout=50x30`; expect 3 QR canvases/svgs; expect each label to display its serial text.
- `layout switch changes @page size` — change dropdown to `50x50`; expect a visible class/attribute reflecting the choice.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement the page**

- `print-labels.html`: layout dropdown, Print button, label grid container, QR lib script tag.
- `print-labels.js`: `renderLabels(serials: string[], layout: '50x30'|'50x50'|'a4'): void`. Per layout, applies the matching CSS class to the container (which drives `@page size` via CSS).
- `print-labels.css`: three `@page` rules under layout-specific classes; label `.label--50x30 { width: 50mm; height: 30mm; page-break-after: always; }`, etc. 50×30 shows QR + serial + truncated SKU name; 50×50 adds price. A4 lays out 4×8 of 50×30 inside a 210×297mm `@page`.

Fetch SKU name/price for the involved serials via a one-shot call to `admin-manage-inventory` `list` filtered on those serials.

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Commit**

```bash
git add site/print-labels.html site/scripts/print-labels.js site/assets/print-labels.css tests/inventory-print.spec.ts
git commit -m "feat(inventory): print-labels.html with 50x30/50x50/A4 layouts"
```

---

### Task 4: `admin-inventory.html` — ledger + Add inventory modal

**Files:**
- Create: `site/admin-inventory.html`
- Create: `site/scripts/admin-inventory.js`
- Modify: whichever file renders the admin nav (grep for the link to `admin-products.html` in existing admin pages; add "Inventory" and "POS" links the same way)

**Interfaces produced:**
- Admin page at `/admin-inventory.html`.

**Consumes:** `admin-manage-inventory` (Task 2), `inventory-stats` (Task 6, placeholder stub returning zeros is fine until Task 6 ships).

- [ ] **Step 1: Write failing Playwright test**

In `tests/`, extend `inventory-admin.spec.ts`:
- `admin-inventory page loads with KPI strip and ledger` — login as admin, navigate, expect four KPI tiles and a ledger table with ≥1 row (seeded test piece from Task 2).
- `Add inventory modal creates N pieces and opens print view` — click Add inventory, pick existing SKU, qty=2, cost=1000, submit; expect redirect/popup to `print-labels.html?serials=…` with 2 serials.
- `search by serial filters the ledger` — type a known serial, expect only that row.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement page**

- KPI strip (4 tiles) wired to `inventory-stats`.
- Ledger table with pagination; filters wired to `admin-manage-inventory` `list`.
- Add inventory modal: SKU picker (searchable `<select>` populated from `admin-manage-catalog` or equivalent product list function), **+ New SKU** inline form (name, selling_price, optional thumbnail), qty, cost_price, weaver, photo. Submit → calls `admin-manage-inventory` `create` → opens `print-labels.html` with returned serials in a new tab.
- Row actions: Reprint QR, Edit, Delete.
- Export CSV: client-side CSV from current ledger result set.
- Match visual style of existing admin pages (`assets/styles.css`, `.p-card` etc.).

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Commit**

```bash
git add site/admin-inventory.html site/scripts/admin-inventory.js tests/inventory-admin.spec.ts
# plus the admin nav file
git commit -m "feat(inventory): admin-inventory page with ledger and intake modal"
```

---

### Task 5: `admin-products.html` modifications

**Files:**
- Modify: `site/admin-products.html`
- Modify: `site/scripts/admin-products.js` (or inline script — follow existing pattern)
- Modify: `supabase/functions/admin-manage-products/index.ts`

**Interfaces produced:**
- Product edit panel: two new toggles (**Inventory-managed**, **Visible on site**) and a "Pieces" section visible when inventory-managed is on.
- `admin-manage-products` accepts and persists `inventory_managed` and `<VISIBILITY_COL>` on save.
- Deleting a product with pieces: FK rejects; UI surfaces a clean error.

**Consumes:** `admin-manage-inventory` for the per-SKU piece list.

- [ ] **Step 1: Write failing Playwright test**

Extend `inventory-admin.spec.ts`:
- `toggling inventory_managed on a SKU persists and reveals Pieces section`
- `toggling visible_on_site persists and reflects in storefront product-fetch`
- `deleting a SKU with pieces shows a friendly rejection, not 500` *(covers Review Focus #4)*

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement**

- In the product edit panel: add two labelled toggles above the Save row.
- Below Save (visible only when inventory_managed=true): "Pieces" section — count summary and a table of this SKU's pieces (reuse the ledger row renderer from Task 4 by extracting to `site/scripts/inventory-rows.js`).
- **Add piece** / **Add N pieces** buttons reuse the Add inventory modal from Task 4 (prefilled with this SKU).
- Modify `admin-manage-products` to accept the two flags; reject toggling `inventory_managed=false` if any `in_stock` pieces exist for that SKU; catch FK error on delete and return `{ error: 'cannot_delete_sku_with_pieces' }` → UI shows the friendly message.

- [ ] **Step 4: Run tests, deploy function, verify pass**

- [ ] **Step 5: Commit**

```bash
git add site/admin-products.html site/scripts/* tests/inventory-admin.spec.ts
git commit -m "feat(inventory): product-level inventory flags and per-SKU pieces section"
```

---

### Task 6: `inventory-stats` edge function

**Files:**
- Create: `supabase/functions/inventory-stats/index.ts`

**Interfaces produced:**
- GET/POST returning `{ in_stock_count, inventory_value_at_cost, added_this_month, sold_this_month }`.

- [ ] **Step 1: Write failing test**

`inventory-stats returns four KPIs with correct types and values`.

- [ ] **Step 2–4: TDD cycle**

Implement with four parameterised SQL queries. Deploy. Wire the Task 4 KPI strip to real data (remove stub).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(inventory): inventory-stats function and KPI wiring"
```

---

## Phase 2 — POS

### Task 7: `pos-checkout` edge function

**Files:**
- Create: `supabase/functions/pos-checkout/index.ts`

**Interfaces produced:**
- POST input: `{ serials: string[], customer: { phone?, name?, address? } | null, payment_method: 'cash'|'upi'|'card', discount?: { type: 'flat'|'percent', value: number } }`.
- Returns: `{ order_id: uuid, invoice_url: string }` on success; `{ error, details: { serial, reason }[] }` on failure.

**Consumes:** Existing `orders` table + payments pattern (grep `admin-create-order` for the write path). Add `source` column to `orders` if not present (one-line migration applied in this task).

- [ ] **Step 1: Write failing tests**

- `pos-checkout happy path creates order, flips pieces to sold, records payment`
- `pos-checkout rejects already-sold piece without partial write` *(race test — covers Review Focus #1)*
- `pos-checkout rejects unknown serial`
- `pos-checkout trims whitespace and is case-insensitive on serial lookup` *(covers Review Focus #5)*
- `pos-checkout concurrent calls with overlapping serials: exactly one succeeds` *(parallel-call test)*

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement**

Function body:
1. Admin JWT check.
2. If `orders.source` column absent, apply migration adding it (`text default 'web'`).
3. Normalise serials: `trim().toUpperCase()`.
4. Begin transaction (via a single `rpc` SQL function so lock scope is tight):
   - `SELECT id, product_id, status FROM inventory_pieces WHERE serial = any($1) FOR UPDATE;`
   - If any `status != 'in_stock'` or any serial missing → rollback, return error listing offending serials.
   - Create `orders` row with `source='pos'`, derived line items (one per piece, each qty 1 at the SKU's selling price), customer fields, discount applied order-level.
   - Insert payment row (match existing payments schema).
   - Update pieces: `status='sold', sold_at=now(), sold_via='pos', order_id=<new>`.
5. Return `{ order_id, invoice_url }` (invoice path from `get-order-invoice`).

- [ ] **Step 4: Deploy and run tests**

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "feat(pos): pos-checkout transactional sale function"
```

---

### Task 8: `admin-pos.html` page

**Files:**
- Create: `site/admin-pos.html`
- Create: `site/scripts/admin-pos.js`
- Create: `site/assets/admin-pos.css`

**Interfaces produced:**
- Page at `/admin-pos.html`.
- Opens receipt popup after charge; receipt uses the invoice URL returned by `pos-checkout`.

**Consumes:** `pos-checkout` (Task 7), existing user-lookup endpoint (grep `admin-create-order.html` for the phone-lookup call).

- [ ] **Step 1: Write failing Playwright test**

In `tests/inventory-pos.spec.ts`:
- `admin-pos loads with scan input focused by default`
- `synthetic scan adds a line item and shows product name/price`
- `second scan of same serial in same bill is ignored`
- `Charge disabled on empty bill, enabled after one line`
- `pressing Esc clears the bill`

(Do not test an actual Charge call — Task 7's tests cover that path end-to-end.)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement**

- Hidden `<input id="scan-input">` with `autofocus`; global `keydown` handler refocuses it on any keystroke outside form fields.
- On Enter: debounce 50ms, read value, call `admin-manage-inventory` `get-by-serial`, add line (or toast on error), clear input.
- Bill array in memory. Render list, subtotal, discount input, total.
- Customer rail: phone lookup, walk-in form, anonymous radio.
- Charge button → `pos-checkout` → open invoice popup → **New sale** resets state.
- Keyboard: F2 focus phone, F9 charge, Esc clear.

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Commit**

```bash
git add site/admin-pos.html site/scripts/admin-pos.js site/assets/admin-pos.css tests/inventory-pos.spec.ts
git commit -m "feat(pos): admin-pos.html counter billing page"
```

---

### Task 9: Invoice updates — serial beside inventory-managed line items

**Files:**
- Modify: `supabase/functions/get-order-invoice/index.ts`
- Modify: `supabase/functions/admin-generate-invoice/index.ts`

**Interfaces produced:**
- Invoice HTML/PDF includes the piece serial(s) assigned to each inventory-managed line item.

- [ ] **Step 1: Write failing test**

`invoice renders serial next to each inventory-managed line item for POS and online orders`.

- [ ] **Step 2–4: TDD cycle**

Query assigned pieces by `order_id` grouped by `product_id`; append `(Piece: AHM-00142)` to each line item's description in the existing invoice template.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "feat(inventory): invoices include assigned piece serials"
```

---

## Phase 3 — Online integration + returns

### Task 10: `assign-pieces-to-order` edge function

**Files:**
- Create: `supabase/functions/assign-pieces-to-order/index.ts`
- Migration (small): add `inventory_shortage boolean default false` to `orders`.

**Interfaces produced:**
- POST input: `{ order_id: uuid }`.
- Idempotent — safe to call multiple times.
- Returns `{ assigned: { line_item_id, serials }[], shortages: { line_item_id, missing_qty }[] }`.

- [ ] **Step 1: Write failing tests**

- `FIFO: assigns oldest in-stock pieces first by intake_date`
- `idempotent: second call does not re-assign new pieces to the same order`
- `undersupply: assigns what's available, flags order with inventory_shortage=true`
- `concurrent orders on last piece: each gets a distinct piece` *(parallel-call test — covers Review Focus #2)*
- `skips line items whose product is not inventory_managed`

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement**

Service-role function. For each order line item where `product.inventory_managed=true`:
- Count already-assigned pieces for this order+product (`select count(*) from inventory_pieces where order_id=? and product_id=?`). Deficit = qty − assigned.
- If deficit > 0:
  ```sql
  SELECT id FROM inventory_pieces
   WHERE product_id = ? AND status = 'in_stock'
   ORDER BY intake_date ASC, id ASC
   LIMIT <deficit>
   FOR UPDATE SKIP LOCKED;
  ```
  Update to `sold`, `sold_via='online'`, `order_id=<order>`.
- If selected count < deficit, set `orders.inventory_shortage=true`.

- [ ] **Step 4: Deploy and run tests**

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "feat(inventory): assign-pieces-to-order FIFO function"
```

---

### Task 11: Hook assignment into existing order-confirmation paths

**Files:**
- Modify: `supabase/functions/razorpay-webhook/index.ts`
- Modify: `supabase/functions/create-cod-order/index.ts`
- Modify: `supabase/functions/admin-create-order/index.ts`
- Modify: `site/admin-orders.html` (add a "Reassign pieces" button on orders with `inventory_shortage=true`)

**Interfaces produced:**
- All three order-creation flows invoke `assign-pieces-to-order(order_id)` after the order row is committed and payment is confirmed (for COD: after confirm; for Razorpay: in the payment-success branch).
- Admin order detail shows assigned serials and offers manual retry on shortage.

- [ ] **Step 1: Write Playwright integration test**

- `COD order on inventory-managed SKU assigns piece and marks it sold_via=online` — create a test SKU with 1 piece, place a COD order via `create-cod-order`, assert piece is sold with correct linkage.
- `admin-orders detail shows assigned serial and shortage banner when applicable`.

- [ ] **Step 2: Verify failing**

- [ ] **Step 3: Implement**

In each of the three functions, after the existing success branch's final `insert` into `orders`, add one line:

```ts
await supabase.functions.invoke('assign-pieces-to-order', { body: { order_id } });
```

Don't await when the invocation would block webhook timeouts; use fire-and-forget with a trailing log instead. Pattern-match whatever each function already does for similar follow-ups.

In `admin-orders.html`: expand order rows to list assigned serials; show a yellow banner + "Reassign pieces" button if `inventory_shortage=true`.

- [ ] **Step 4: Deploy and run tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(inventory): wire piece assignment into razorpay/COD/admin order flows"
```

---

### Task 12: Cancel / return → restock

**Files:**
- Modify: `supabase/functions/cancel-order/index.ts`
- Modify: `supabase/functions/admin-manage-return/index.ts`
- Possibly modify: `supabase/functions/shiprocket-return/index.ts` (confirm during implementation — the restock decision lives wherever the "received back" state is finalised).
- Modify: `site/admin-returns.html` — per-piece Restock/Discard radio in the accept-return UI.

**Interfaces produced:**
- Cancelling a paid order with assigned pieces: pieces → `in_stock`, cleared sold fields, trigger restores `products.stock`.
- Accepting a return: admin selects per piece **Restock** (default) or **Discard**; backend applies decision.
- Restock succeeds even if parent product is no longer `inventory_managed` *(Review Focus #3)* — the piece row just goes back to `in_stock` and the trigger no-ops on non-managed products.

- [ ] **Step 1: Write failing tests**

- `cancel-order on paid order with assigned pieces restocks them and restores stock count`
- `admin-manage-return applies Restock vs Discard per piece`
- `restock succeeds when parent product has inventory_managed=false` *(Review Focus #3)*

- [ ] **Step 2: Verify failing**

- [ ] **Step 3: Implement**

- In `cancel-order`: after existing cancel logic, `update inventory_pieces set status='in_stock', sold_at=null, sold_via=null, order_id=null where order_id=<cancelled>` — but only when the order was paid and pieces had been assigned.
- In `admin-manage-return`: accept new field `restock_decisions: { piece_id: 'restock'|'discard' }[]`. Apply: `restock` → update to in_stock cleared; `discard` → delete row.
- UI changes in `admin-returns.html` to collect decisions.

- [ ] **Step 4: Deploy and run tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(inventory): cancel/return pathways restock or discard pieces"
```

---

### Task 13: Storefront visibility filter

**Files:**
- Modify: whichever edge function(s) serve the public product list, search, product page, sitemap generator, merchant-center feed (grep `.from('products')` across `supabase/functions/` for the public read paths). Likely candidates: `admin-manage-catalog` (if dual-use), a dedicated public endpoint, or inline on static page builds — confirm during implementation.
- Modify: `site/merchant-center-feed.xml` / `site/sitemap.xml` generator if either is built client-side.

**Interfaces produced:**
- Public queries filter `where <VISIBILITY_COL> = true`. If an equivalent filter already exists (per Task 1 Step 1), this task is a no-op beyond verifying coverage.

- [ ] **Step 1: Write failing Playwright test**

- `product with visible_on_site=false does not appear in /products, /search, sitemap, merchant feed`.

- [ ] **Step 2: Verify failing (if the filter is missing)**

- [ ] **Step 3: Implement**

Add the WHERE clause to each public read path identified in Step 1. Keep admin paths unchanged.

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(inventory): storefront filters out visible_on_site=false SKUs"
```

---

## Phase 4 — Regression

### Task 14: Playwright regression consolidation

**Files:**
- Modify: `tests/` test index / tagging

**Interfaces produced:**
- Full non-destructive inventory suite runnable alongside the existing 74-test regression (per project memory).

- [ ] **Step 1: Review the Review Focus checklist against test files**

Confirm each Review Focus item has its test living in the owning task's spec file. If any is missing, add it.

- [ ] **Step 2: Tag inventory tests**

Add `@inventory` tag to all new test files so they can be run as a focused subset or as part of full regression.

- [ ] **Step 3: Run the full regression suite**

Expected: all 74 pre-existing tests still pass; new inventory tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "test(inventory): consolidate regression suite with @inventory tag"
```

---

## Deployment checklist (after each task's commit)

Per project memory `feedback_batch_deploy_ahamstree`:
- `git push` the storefront changes (GitHub Pages auto-deploys `main`).
- Deploy affected edge functions via `deploy_edge_function` MCP action.
- No live-site re-check (per `feedback_sandbox_verify_then_deploy_no_live_check`) — rely on sandbox verification + the test suite.
