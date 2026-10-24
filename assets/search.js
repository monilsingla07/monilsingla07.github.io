// assets/search.js
import { supabase } from "./supabase.js";
import { escapeHtml, escapeAttr, safeSrc } from "./safe.js";
import { withCardImages, cardImageSrc, cardImageAttrs } from "./media.js";
import { cardMetaLine } from "./listing-ui.js";

/**
 * IMPORTANT
 * ---------
 * Your database schema uses:
 *   - products.title (not products.name)
 *   - products.price_inr (not products.price)
 *   - products.inventory_qty (not products.in_stock)
 *   - product_images table for images
 *
 * The previous version of this file was querying non‑existing columns.
 * That caused search to fail with a Supabase error.
 */

function normalizeProducts(rows = []) {
  return (rows ?? []).map(withCardImages);
}

// Same 60-day "New" window as every other product grid on the site (home.js,
// products.html, sale.html, ...) — kept as a duplicate here rather than a
// shared import for the same reason those already are (see home.js).
const NEW_WINDOW_DAYS = 60;
function isNew(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function moneyINR(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export const SEARCH_PAGE_SIZE = 20;

/**
 * Search for products (UX-007).
 * Uses the public.search_products RPC, which matches title, description,
 * colour, craft, occasion, zari, motif, border, print type, category, fabric,
 * weave, saree type and care instructions (every word must match somewhere;
 * falls back to typo-tolerant matching when there are no exact hits) and only
 * ever considers is_active products. Returns { data, total, error }; each
 * product carries _matched = { field: value } for the "matched:" badges.
 */
export async function searchProducts(query, { limit = SEARCH_PAGE_SIZE, offset = 0 } = {}) {
  const q = String(query || "").trim();
  if (q.length < 2) return { data: [], total: 0, error: null };

  const { data: hits, error: rpcErr } = await supabase.rpc("search_products", { q, lim: limit, off: offset });
  if (rpcErr) return { data: [], total: 0, error: rpcErr };
  if (!hits || !hits.length) return { data: [], total: 0, error: null };

  const total = Number(hits[0].total) || hits.length;
  const ids = hits.map((h) => h.id);

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,title,description,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at,colour,fabric:fabrics(name), product_images(image_url, thumb_url, width, height, sort_order)"
    )
    .eq("is_active", true)
    .in("id", ids);
  if (error) return { data: [], total: 0, error };

  const byId = new Map((data || []).map((p) => [p.id, p]));
  const ordered = hits
    .map((h) => {
      const p = byId.get(h.id);
      if (p) p._matched = h.matched || {};
      return p;
    })
    .filter(Boolean);

  return { data: normalizeProducts(ordered), total, error: null };
}

const MATCH_LABELS = {
  colour: "colour", fabric: "fabric", weave: "weave", saree_type: "type", craft: "craft",
  occasion: "occasion", zari: "zari", motif: "motif", border: "border", print: "print",
  category: "category", care: "care",
};

// "matched: colour: Navy Blue" badges for fields other than title/description.
function matchBadges(p) {
  const m = p._matched || {};
  const keys = Object.keys(MATCH_LABELS).filter((k) => m[k]);
  if (!keys.length) return "";
  return `<div class="p-card-matched">${keys.slice(0, 2).map((k) =>
    `<span class="match-badge">matched ${MATCH_LABELS[k]}: ${escapeHtml(m[k])}</span>`).join("")}</div>`;
}

/**
 * Compact result rows for the header search overlay (thumbnail + title +
 * price, one per line) — distinct from renderSearchResults()'s full .p-card
 * grid, which is for the dedicated search.html results page. A dropdown
 * panel needs a scannable list, not full product cards.
 */
export function renderSearchPreview(products) {
  return (products || [])
    .map((p) => {
      const price = Number(p.price_inr || 0);
      const sale = p.sale_price_inr == null ? null : Number(p.sale_price_inr);
      const hasSale = Number.isFinite(sale) && sale > 0 && sale < price;
      const priceHtml = hasSale
        ? `<span style="text-decoration:line-through;opacity:.55;margin-right:6px;">${moneyINR(price)}</span><span style="color:var(--color-action);font-weight:700;">${moneyINR(sale)}</span>`
        : `<span style="font-weight:700;">${moneyINR(price)}</span>`;
      const imgHtml = p.image_url
        ? `<img src="${safeSrc(p.image_url)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;">`
        : "";
      return `
        <a href="${p.slug ? `product.html?slug=${encodeURIComponent(p.slug)}` : `product.html?id=${encodeURIComponent(p.id)}`}&from=search" class="search-preview-row">
          <div class="search-preview-thumb">${imgHtml}</div>
          <div class="search-preview-info">
            <div class="search-preview-title">${escapeHtml(p.title || "")}</div>
            <div class="search-preview-price">${priceHtml}</div>
          </div>
        </a>
      `;
    })
    .join("");
}

/**
 * Render search results
 */
export function renderSearchResults(products) {
  const items = products || [];

  if (!items.length) return "";

  return items
    .map((p, idx) => {
      const price = Number(p.price_inr || 0);
      const sale =
        p.sale_price_inr === null || p.sale_price_inr === undefined
          ? null
          : Number(p.sale_price_inr || 0);
      const hasSale = Number.isFinite(sale) && sale > 0 && sale < price && Number.isFinite(price);
      const pctOff = hasSale ? Math.round((1 - sale / price) * 100) : 0;

      const inv = Number(p.inventory_qty || 0);
      const res = Number(p.reserved_qty || 0);
      const available = Math.max(0, inv - res);
      const soldOut = available <= 0;
      const isNewItem = !soldOut && isNew(p.created_at);

      const priceHtml = hasSale
        ? `<span class="p-card-original">${moneyINR(price)}</span><span class="p-card-sale-price">${moneyINR(sale)}</span>`
        : `<span class="p-card-price">${moneyINR(price)}</span>`;

      const imgHtml = p.image_url
        ? `<img class="${p.image_url_hover ? "p-card-img-primary" : ""}" src="${cardImageSrc(p._img)}" ${cardImageAttrs(p._img)} alt="${escapeAttr(p.title || "Product")}" loading="lazy" decoding="async">${p.image_url_hover ? `<img class="p-card-img-hover" src="${cardImageSrc(p._imgHover)}" ${cardImageAttrs(p._imgHover)} alt="" loading="lazy" decoding="async" aria-hidden="true">` : ""}`
        : `<div class="p-card-img-empty"></div>`;

      return `
        <div class="p-card" style="animation-delay:${(idx % 8) * 28}ms">
          <a href="${p.slug ? `product.html?slug=${encodeURIComponent(p.slug)}` : `product.html?id=${encodeURIComponent(p.id)}`}&from=search" class="product-link">
            <div class="p-card-img${p.image_url_hover ? " has-hover-img" : ""}">
              ${imgHtml}
              ${soldOut ? `<div class="p-card-status-badge is-sold">Sold Out</div>` : (isNewItem ? `<div class="p-card-status-badge is-new">New</div>` : "")}
              ${pctOff > 0 ? `<div class="p-card-badge">${pctOff}% OFF</div>` : ""}
            </div>
            <div class="p-card-body">
              <div class="p-card-title">${escapeHtml(p.title || "")}</div>
              ${cardMetaLine(p)}
              ${matchBadges(p)}
              <div class="p-card-pricing">${priceHtml}</div>
              ${!soldOut && available <= 3 ? `<div class="p-card-stock low">Only ${available} left</div>` : ""}
              ${soldOut ? `<div class="p-card-stock">Sold out</div>` : ""}
            </div>
          </a>
        </div>
      `;
    })
    .join("");
}
