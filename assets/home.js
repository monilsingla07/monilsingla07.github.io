// assets/home.js
import { supabase } from "./supabase.js";

/**
 * Home page helpers:
 * - Renders Bestsellers + New Collection (6 items each, 3 per row on desktop)
 * - Hydrates the hero banner background using the latest product image (if available)
 */

function moneyINR(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return "₹" + n.toString("en-IN");
}

function normalizeProducts(rows = []) {
  return (rows ?? []).map(p => {
    const imgs = (p.product_images ?? []).slice().sort((a,b)=> (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { ...p, image_url: imgs[0]?.image_url ?? "" };
  });
}

function productCard(p) {
  const img = p.image_url
    ? `<img src="${p.image_url}" alt="${p.title}" loading="lazy">`
    : `<div class="img-placeholder" aria-label="${p.title}"></div>`;

  return `
    <div class="card product-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-link">
        ${img}
        <div class="p">
          <div class="product-title">${p.title ?? ""}</div>
          <div class="product-price">${moneyINR(p.price_inr)}</div>
          <div class="small" style="margin-top:6px;">${(p.inventory_qty ?? 0) > 0 ? "In stock" : "Sold out"}</div>
        </div>
      </a>
    </div>
  `;
}

async function fetchMostLoved(limit = 6) {
  const { data, error } = await supabase
    .from("products")
    .select("id,title,price_inr,inventory_qty,is_active,created_at,view_count, product_images(image_url, sort_order)")
    .eq("is_active", true)
    .order("view_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeProducts(data ?? []);
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

export async function hydrateHome() {
  try {
    setStatus("bestsellersStatus", "Loading…");
    setStatus("newCollectionStatus", "Loading…");

    // Bestsellers: until you add an explicit bestseller flag in the DB,
    // we show the latest active products (fast + reliable).
   const bestsellers = await fetchMostLoved(6);

    renderGrid("bestsellersGrid", bestsellers);
    setStatus("bestsellersStatus", "");

    // New Collection: same data source for now, but offset a bit so sections differ.
    const allLatest = await fetchLatestActive(12);
    const newCollection = allLatest.slice(6, 12);
    renderGrid("newCollectionGrid", newCollection);
    setStatus("newCollectionStatus", "");

    // Use freshest image for hero background (slide 1).
    pickHeroBackground(allLatest);

  } catch (e) {
    console.error(e);
    setStatus("bestsellersStatus", "Could not load products. Please try again later.");
    setStatus("newCollectionStatus", "");
  }
}
