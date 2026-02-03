// assets/home.js
import { supabase } from "./supabase.js";

/**
 * Home page helpers:
 * - Renders "Most loved" + "New Collection" (6 items each)
 * - Uses view_count for Most loved
 * - Uses created_at for New Collection
 * - Sets hero background from latest product image
 */

function moneyINR(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return "₹" + n.toLocaleString("en-IN", {
    maximumFractionDigits: 0
  });
}

function normalizeProducts(rows = []) {
  return (rows ?? []).map(p => {
    const imgs = (p.product_images ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { ...p, image_url: imgs[0]?.image_url ?? "" };
  });
}

function productCard(p) {
  const img = p.image_url
    ? `<img src="${p.image_url}" alt="${p.title ?? ""}" loading="lazy">`
    : `<div class="img-placeholder" aria-label="${p.title ?? ""}"></div>`;

  return `
    <div class="card product-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-link">
        ${img}
        <div class="p">
          <div class="product-title">${p.title ?? ""}</div>
          <div class="product-price">${moneyINR(p.price_inr)}</div>
          <div class="small" style="margin-top:6px;">
            ${(p.inventory_qty ?? 0) > 0 ? "In stock" : "Sold out"}
          </div>
        </div>
      </a>
    </div>
  `;
}

function setStatus(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg ?? "";
}

function renderGrid(gridId, items) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = (items ?? []).map(productCard).join("");
}

function pickHeroBackground(products) {
  const hero = document.querySelector(".hero-slide[data-slide='1']");
  if (!hero) return;
  const img = (products ?? []).find(p => p.image_url)?.image_url;
  if (img) hero.style.setProperty("--hero-bg", `url('${img}')`);
}

/* ------------------ DATA FETCHERS ------------------ */

// Most loved = highest view_count
async function fetchMostLoved(limit = 6) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,title,price_inr,inventory_qty,is_active,created_at,view_count, product_images(image_url, sort_order)"
    )
    .eq("is_active", true)
    .order("view_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeProducts(data ?? []);
}

// New Collection = latest products by created_at
async function fetchLatestActive(limit = 6) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,title,price_inr,inventory_qty,is_active,created_at, product_images(image_url, sort_order)"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeProducts(data ?? []);
}

/* ------------------ MAIN HYDRATOR ------------------ */

export async function hydrateHome() {
  try {
    setStatus("bestsellersStatus", "Loading…");
    setStatus("newCollectionStatus", "Loading…");

    // Most loved
    const mostLoved = await fetchMostLoved(6);
    renderGrid("bestsellersGrid", mostLoved);
    setStatus("bestsellersStatus", "");

    // New Collection (latest arrivals)
    const latest = await fetchLatestActive(6);
    renderGrid("newCollectionGrid", latest);
    setStatus("newCollectionStatus", "");

    // Hero background from latest products
    pickHeroBackground(latest);

  } catch (e) {
    console.error(e);
    setStatus("bestsellersStatus", "Could not load products.");
    setStatus("newCollectionStatus", "Could not load products.");
  }
}
