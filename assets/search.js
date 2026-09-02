// assets/search.js
import { supabase } from "./supabase.js";
import { escapeHtml, escapeAttr, safeSrc } from "./safe.js";

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
  return (rows ?? []).map((p) => {
    const imgs = (p.product_images ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { ...p, image_url: imgs[0]?.image_url ?? "", image_url_hover: imgs[1]?.image_url ?? "" };
  });
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

/**
 * Search for products
 */
export async function searchProducts(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return { data: [], error: null };

  // NOTE: We don't force lowercasing because Postgres ILIKE is already case-insensitive.
  // Basic safety:
  // - avoid wildcard injection (%)
  // - avoid breaking PostgREST OR syntax with commas/parentheses
  const term = q.replace(/[%,()]/g, "");

  const { data, error } = await supabase
    .from("products")
    .select(
      // NOTE: Your current schema does NOT have a `fabric` column.
      // If you add it later, you can include it again.
      "id,title,description,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at, product_images(image_url, sort_order)"
    )
    .eq("is_active", true)
    .or(
      `title.ilike.%${term}%,description.ilike.%${term}%`
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return { data: normalizeProducts(data || []), error };
}

/**
 * Render search results
 */
export function renderSearchResults(products) {
  const items = products || [];

  if (!items.length) {
    return `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
        <p style="font-size: 18px; color: var(--text-light);">No products found</p>
        <p style="margin-top: 10px;">Try different keywords or browse our collections</p>
        <a href="products.html" class="btn" style="margin-top: 20px;">View All Products</a>
      </div>
    `;
  }

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
        ? `<img class="${p.image_url_hover ? "p-card-img-primary" : ""}" src="${safeSrc(p.image_url)}" alt="${escapeAttr(p.title || "Product")}" loading="lazy" decoding="async">${p.image_url_hover ? `<img class="p-card-img-hover" src="${safeSrc(p.image_url_hover)}" alt="" loading="lazy" decoding="async" aria-hidden="true">` : ""}`
        : `<div class="p-card-img-empty"></div>`;

      return `
        <div class="p-card" style="animation-delay:${(idx % 8) * 55}ms">
          <a href="product.html?id=${encodeURIComponent(p.id)}&from=search" class="product-link">
            <div class="p-card-img${p.image_url_hover ? " has-hover-img" : ""}">
              ${imgHtml}
              ${soldOut ? `<div class="p-card-status-badge is-sold">Sold Out</div>` : (isNewItem ? `<div class="p-card-status-badge is-new">New</div>` : "")}
              ${pctOff > 0 ? `<div class="p-card-badge">${pctOff}% OFF</div>` : ""}
            </div>
            <div class="p-card-body">
              <div class="p-card-title">${escapeHtml(p.title || "")}</div>
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
