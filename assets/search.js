// assets/search.js
import { supabase } from "./supabase.js";

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
    return { ...p, image_url: imgs[0]?.image_url ?? "" };
  });
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
  const term = q.replace(/%/g, ""); // basic safety: avoid accidental wildcard injection

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,title,description,price_inr,sale_price_inr,inventory_qty,is_active,fabric,created_at, product_images(image_url, sort_order)"
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
    .map((p) => {
      const price = Number(p.price_inr || 0);
      const sale =
        p.sale_price_inr === null || p.sale_price_inr === undefined
          ? null
          : Number(p.sale_price_inr || 0);

      const showSale =
        Number.isFinite(sale) && sale > 0 && sale < price && Number.isFinite(price);

      const priceHtml = showSale
        ? `<span style="font-weight:900;">${moneyINR(sale)}</span> <span class="small" style="opacity:.7;text-decoration:line-through;">${moneyINR(
            price
          )}</span>`
        : `<span style="font-weight:900;">${moneyINR(price)}</span>`;

      const imgHtml = p.image_url
        ? `<img src="${p.image_url}" alt="${p.title || "Product"}" loading="lazy">`
        : `<div style="height:260px;background:#fafafa;border-radius:12px;"></div>`;

      return `
        <a href="product.html?id=${encodeURIComponent(
          p.id
        )}" class="card product-card" style="text-decoration:none;color:inherit;">
          ${imgHtml}
          <div class="p">
            <div class="product-title">${p.title || ""}</div>
            <div class="product-price" style="margin-top:6px;">${priceHtml}</div>
            <div class="small" style="margin-top:6px; opacity:.75;">
              ${(Number(p.inventory_qty || 0) > 0) ? "In stock" : "Sold out"}
            </div>
          </div>
        </a>
      `;
    })
    .join("");
}
