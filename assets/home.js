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
    const inv = Number(p.inventory_qty || 0);
    const res = Number(p.reserved_qty || 0);
    return { ...p, image_url: imgs[0]?.image_url ?? "", available_qty: Math.max(0, inv - res) };
  });
}


const CATEGORY_LABELS = { saree: "Sarees", suit: "Suits" };

function weaveGroupHtml(categoryKey, rows){
  const label = CATEGORY_LABELS[categoryKey] || categoryKey;
  const tiles = rows.map(w => `
    <a class="cat-tile" href="products.html?type=${encodeURIComponent(categoryKey)}&weave=${encodeURIComponent(w.slug)}">
      <div class="cat-title">${escapeHtml(w.name)}</div>
      <div class="cat-sub">${escapeHtml(w.description || "")}</div>
    </a>
  `).join("");
  return `
    <div class="weave-group">
      <div class="weave-group-head">
        <div class="weave-group-title">${escapeHtml(label)}</div>
        <a class="weave-group-link" href="products.html?type=${encodeURIComponent(categoryKey)}">View all ${escapeHtml(label)} →</a>
      </div>
      <div class="category-tiles">${tiles}</div>
    </div>
  `;
}

async function hydrateCategoryTiles(){
  const box = document.getElementById("homeCategoryTiles");
  if (!box) return;

  // Fallback (shown only if the live query below fails entirely) — mirrors
  // the real hierarchy: Sarees come in both weaves, Suits only in Chanderi
  // Handloom.
  const fallback = {
    saree: [
      { name: "Chanderi Handloom", slug: "chanderi-handloom", description: "Cotton Silk & Silk" },
      { name: "Chanderi Cotton", slug: "chanderi-cotton", description: "Hand block print" },
    ],
    suit: [
      { name: "Chanderi Handloom", slug: "chanderi-handloom", description: "Cotton Silk & Silk" },
    ],
  };

  const renderFallback = () => {
    box.innerHTML = Object.entries(fallback).map(([cat, rows]) => weaveGroupHtml(cat, rows)).join("");
  };

  try{
    // Which (category, weave) combinations actually have at least one live
    // product — this is what previously went missing: the old query just
    // listed every weave_lines row flat, with every tile hardcoded to link
    // to type=saree, so Suits never appeared here at all and clicking a
    // weave tile never actually filtered the listing page by that weave
    // (see the matching fix in products.html). Grouping by real product
    // data means this stays correct automatically as products/categories/
    // weaves change, instead of a hardcoded mapping going stale.
    const { data, error } = await supabase
      .from("products")
      .select("category, weave_line:weave_lines!inner(id,name,slug,sort_order,is_active)")
      .eq("is_active", true)
      .eq("weave_line.is_active", true);

    if (error || !data || data.length === 0) { renderFallback(); return; }

    const groups = {}; // category -> Map(slug -> weave_line row)
    for (const row of data) {
      const cat = row.category || "saree";
      const wl = row.weave_line;
      if (!wl) continue;
      if (!groups[cat]) groups[cat] = new Map();
      if (!groups[cat].has(wl.slug)) groups[cat].set(wl.slug, wl);
    }

    const order = ["saree", "suit"];
    const categoryKeys = Object.keys(groups).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    if (categoryKeys.length === 0) { renderFallback(); return; }

    box.innerHTML = categoryKeys.map(cat => {
      const rows = Array.from(groups[cat].values()).sort((a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name))
      );
      return weaveGroupHtml(cat, rows);
    }).join("");
  } catch(e){
    renderFallback();
  }
}

async function hydrateHomeCollections(){
  const box = document.getElementById("homeCollectionTiles");
  if (!box) return;

  try{
    const { data, error } = await supabase
      .from("collections")
      .select("name,slug,description,cover_image_url,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0){
      box.innerHTML = `<div class="small">No collections yet.</div>`;
      return;
    }

    box.innerHTML = rows.map(c => {
      const photo = safeCssUrl(c.cover_image_url || "");
      const cls = photo ? "cat-tile has-photo" : "cat-tile";
      const style = photo ? ` style="background-image:url('${photo}')"` : "";
      return `
        <a class="${cls}" href="products.html?collection=${encodeURIComponent(c.slug)}"${style}>
          <div class="cat-title">${escapeHtml(c.name)}</div>
          <div class="cat-sub">${escapeHtml(c.description || "Explore")}</div>
        </a>
      `;
    }).join("");
  } catch(e){
    box.innerHTML = `<div class="small">Could not load collections.</div>`;
  }
}

function productCard(p) {
  const base = Number(p.price_inr || 0);
  const sale = p.sale_price_inr == null ? null : Number(p.sale_price_inr);
  const hasSale = sale != null && sale > 0 && sale < base;
  const pctOff = hasSale ? Math.round((1 - sale / base) * 100) : 0;
  const available = Number(p.available_qty || 0);
  const soldOut = available <= 0;

  const priceHtml = hasSale
    ? `<span class="p-card-original">${moneyINR(base)}</span><span class="p-card-sale-price">${moneyINR(sale)}</span>`
    : `<span class="p-card-price">${moneyINR(base)}</span>`;

  const imgHtml = p.image_url
    ? `<img src="${safeSrc(p.image_url)}" alt="${escapeAttr(p.title ?? "")}" loading="lazy" decoding="async">`
    : `<div class="p-card-img-empty"></div>`;

  return `
    <div class="p-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-link">
        <div class="p-card-img">
          ${imgHtml}
          ${pctOff > 0 ? `<div class="p-card-badge">${pctOff}% OFF</div>` : ""}
          ${soldOut ? `<div class="p-card-sold-overlay"><span class="p-card-sold-label">Sold Out</span></div>` : ""}
        </div>
        <div class="p-card-body">
          <div class="p-card-title">${escapeHtml(p.title ?? "")}</div>
          <div class="p-card-pricing">${priceHtml}</div>
          ${!soldOut && available <= 3 ? `<div class="p-card-stock low">Only ${available} left</div>` : ""}
          ${soldOut ? `<div class="p-card-stock">Sold out</div>` : ""}
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
      "id,title,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at,view_count, product_images(image_url, sort_order)"
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
      "id,title,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at, product_images(image_url, sort_order)"
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
