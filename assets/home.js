// assets/home.js
import { supabase } from "./supabase.js";
import { escapeHtml, escapeAttr, safeSrc, safeCssUrl } from "./safe.js";

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


async function hydrateCategoryTiles(){
  const box = document.getElementById("homeCategoryTiles");
  if (!box) return;

  // Fallback tiles (shown if the fabrics table doesn't exist yet)
  const fallback = [
    { name: "Silk", slug: "silk", description: "Wedding & festive" },
    { name: "Cotton", slug: "cotton", description: "Everyday comfort" },
    { name: "Banarasi", slug: "banarasi", description: "Classic zari" },
    { name: "Kanjivaram", slug: "kanjivaram", description: "Iconic weaves" }
  ];

  try{
    const { data, error } = await supabase
      .from("fabrics")
      .select("name,slug,description,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const rows = (error || !data || data.length === 0) ? fallback : data;
    box.innerHTML = rows.map(f => `
      <a class="cat-tile" href="products.html?type=saree&fabric=${encodeURIComponent(f.slug)}">
        <div class="cat-title">${escapeHtml(f.name)}</div>
        <div class="cat-sub">${escapeHtml(f.description || "")}</div>
      </a>
    `).join("");
  } catch(e){
    box.innerHTML = fallback.map(f => `
      <a class="cat-tile" href="products.html?type=saree&fabric=${encodeURIComponent(f.slug)}">
        <div class="cat-title">${escapeHtml(f.name)}</div>
        <div class="cat-sub">${escapeHtml(f.description || "")}</div>
      </a>
    `).join("");
  }
}

async function hydrateHomeCollections(){
  const box = document.getElementById("homeCollectionTiles");
  if (!box) return;

  try{
    const { data, error } = await supabase
      .from("collections")
      .select("name,slug,description,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0){
      box.innerHTML = `<div class="small">No collections yet.</div>`;
      return;
    }

    box.innerHTML = rows.map(c => `
      <a class="cat-tile" href="products.html?collection=${encodeURIComponent(c.slug)}">
        <div class="cat-title">${escapeHtml(c.name)}</div>
        <div class="cat-sub">${escapeHtml(c.description || "Explore")}</div>
      </a>
    `).join("");
  } catch(e){
    box.innerHTML = `<div class="small">Could not load collections.</div>`;
  }
}

function productCard(p) {
  const img = p.image_url
    ? `<img src="${safeSrc(p.image_url)}" alt="${escapeAttr(p.title ?? "")}" loading="lazy">`
    : `<div class="img-placeholder" aria-label="${escapeAttr(p.title ?? "")}"></div>`;

  const inv = Number(p.inventory_qty || 0);
  const res = Number(p.reserved_qty || 0);
  const available = Math.max(0, inv - res);

  return `
    <div class="card product-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-link">
        ${img}
        <div class="p">
          <div class="product-title">${escapeHtml(p.title ?? "")}</div>
          <div class="product-price">${moneyINR(p.price_inr)}</div>
          <div class="small" style="margin-top:6px;">
            ${available > 0 ? `In stock (${available})` : "Sold out"}
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
  if (img) hero.style.setProperty("--hero-bg", `url("${safeCssUrl(img)}")`);
}

/* ------------------ DATA FETCHERS ------------------ */

// Most loved = highest view_count
async function fetchMostLoved(limit = 6) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,title,price_inr,inventory_qty,reserved_qty,is_active,created_at,view_count, product_images(image_url, sort_order)"
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
      "id,title,price_inr,inventory_qty,reserved_qty,is_active,created_at, product_images(image_url, sort_order)"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeProducts(data ?? []);
}

/* ------------------ MAIN HYDRATOR ------------------ */

export async function hydrateHome() {
  hydrateCategoryTiles();
  hydrateHomeCollections();
  try {
    setStatus("bestsellersStatus", "Loading…");
    setStatus("newCollectionStatus", "Loading…");

    // Most loved
    const mostLoved = await fetchMostLoved(8);
    renderGrid("bestsellersGrid", mostLoved);
    setStatus("bestsellersStatus", "");

    // New Collection (latest arrivals)
    const latest = await fetchLatestActive(8);
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
