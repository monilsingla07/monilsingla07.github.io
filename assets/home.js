// assets/home.js
import { supabase } from "./supabase.js";
import { escapeHtml, escapeAttr, safeSrc, safeCssUrl } from "./safe.js";
import { withCardImages, cardImageSrc, cardImageAttrs } from "./media.js";
import { cardMetaLine, emptyStateHtml, errorStateHtml, logListingError } from "./listing-ui.js";
import { addToWishlist, removeFromWishlist, isInWishlist } from "./wishlist.js";

/**
 * Home page helpers:
 * - Renders "Most viewed" + "New Arrivals" (6 items each)
 * - Uses view_count for Most viewed
 * - Uses created_at for New Arrivals
 * - Sets hero background from latest product image
 */

// A product counts as "New" for NEW_WINDOW_DAYS from the moment its row was
// first created (created_at), never from when it was last edited
// (updated_at) — editing a product's price/stock/description should not
// reset its "New" clock.
const NEW_WINDOW_DAYS = 60;
function isNew(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function moneyINR(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return "₹" + n.toLocaleString("en-IN", {
    maximumFractionDigits: 0
  });
}

function normalizeProducts(rows = []) {
  return (rows ?? []).map(p => {
    const inv = Number(p.inventory_qty || 0);
    const res = Number(p.reserved_qty || 0);
    return { ...withCardImages(p), available_qty: Math.max(0, inv - res) };
  });
}


// Fetches collections once; used by both the quick-jump circle row and the
// full Curated Collections showcase further down, so a visitor sees the
// exact same set in both places instead of two independently-fetched lists
// that could drift (e.g. different "latest 6" on each query).
async function fetchCollections(){
  const { data, error } = await supabase
    .from("collections")
    .select("name,slug,description,cover_image_url,is_active,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  return data ?? [];
}

function renderCollectionsShowcase(rows){
  const box = document.getElementById("homeCollectionTiles");
  if (!box) return;

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
}

/* ------------------ Quick-jump circle row ------------------ */
// A fast, visual way to jump straight into Sarees/Suits/New Arrivals/Sale
// or any curated collection — one tap, no scrolling, no price/story
// required first (see the homepage restructure discussion: inspired by
// Suta's circular category row, adapted to this catalog's actual breadth —
// plain categories mixed with real collections rather than a dozen product
// types this store doesn't carry).

function firstImage(product){
  const imgs = (product?.product_images || []).slice().sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return imgs[0]?.image_url || null;
}

async function fetchQuickJumpCategoryImages(){
  const [sareeR, suitR, saleR] = await Promise.all([
    supabase.from("products").select("product_images(image_url,sort_order)")
      .eq("is_active", true).eq("category", "saree")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("products").select("product_images(image_url,sort_order)")
      .eq("is_active", true).eq("category", "suit")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("products").select("product_images(image_url,sort_order)")
      .eq("is_active", true).not("sale_price_inr", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    saree: firstImage(sareeR.data),
    suit: firstImage(suitR.data),
    sale: firstImage(saleR.data),
  };
}

function quickJumpItemHtml(href, label, photoUrl){
  const photo = safeCssUrl(photoUrl || "");
  const style = photo ? ` style="background-image:url('${photo}')"` : "";
  return `
    <a class="qj-item" href="${href}">
      <span class="qj-circle${photo ? "" : " is-empty"}"${style}></span>
      <span class="qj-label">${escapeHtml(label)}</span>
    </a>
  `;
}

async function hydrateQuickJumpRow(newArrivalsFirstImage, collectionsRows){
  const row = document.getElementById("quickJumpRow");
  if (!row) return;

  let catImages = { saree: null, suit: null, sale: null };
  try { catImages = await fetchQuickJumpCategoryImages(); } catch (_e) { /* circles just render as plain tinted discs */ }

  const items = [
    quickJumpItemHtml("products.html?type=saree", "Sarees", catImages.saree),
    quickJumpItemHtml("products.html?type=suit", "Suits", catImages.suit),
    quickJumpItemHtml("new-arrivals.html", "New Arrivals", newArrivalsFirstImage),
    ...collectionsRows.map(c => quickJumpItemHtml(`products.html?collection=${encodeURIComponent(c.slug)}`, c.name, c.cover_image_url)),
    quickJumpItemHtml("sale.html", "Sale", catImages.sale),
  ];
  row.innerHTML = items.join("");
}

function productCard(p) {
  const base = Number(p.price_inr || 0);
  const sale = p.sale_price_inr == null ? null : Number(p.sale_price_inr);
  const hasSale = sale != null && sale > 0 && sale < base;
  const pctOff = hasSale ? Math.round((1 - sale / base) * 100) : 0;
  const available = Number(p.available_qty || 0);
  const soldOut = available <= 0;
  // Sold Out wins the top-left corner slot over New — once stock hits zero,
  // "recently added" stops being the useful thing to tell a shopper.
  const isNewItem = !soldOut && isNew(p.created_at);

  const priceHtml = hasSale
    ? `<span class="p-card-original">${moneyINR(base)}</span><span class="p-card-sale-price">${moneyINR(sale)}</span>`
    : `<span class="p-card-price">${moneyINR(base)}</span>`;

  const imgHtml = p.image_url
    ? `<img class="${p.image_url_hover ? "p-card-img-primary" : ""}" src="${cardImageSrc(p._img)}" ${cardImageAttrs(p._img)} alt="${escapeAttr(p.title ?? "")}" loading="lazy" decoding="async">${p.image_url_hover ? `<img class="p-card-img-hover" src="${cardImageSrc(p._imgHover)}" ${cardImageAttrs(p._imgHover)} alt="" loading="lazy" decoding="async" aria-hidden="true">` : ""}`
    : `<div class="p-card-img-empty"></div>`;

  return `
    <div class="p-card">
      <button type="button" class="p-card-wish" data-product-id="${escapeAttr(p.id)}" aria-label="Add to wishlist" aria-pressed="false">${heartIcon()}</button>
      <a href="${p.slug ? `product.html?slug=${encodeURIComponent(p.slug)}` : `product.html?id=${encodeURIComponent(p.id)}`}" class="product-link">
        <div class="p-card-img${p.image_url_hover ? " has-hover-img" : ""}">
          ${imgHtml}
          ${soldOut ? `<div class="p-card-status-badge is-sold">Sold Out</div>` : (isNewItem ? `<div class="p-card-status-badge is-new">New</div>` : "")}
          ${pctOff > 0 ? `<div class="p-card-badge">${pctOff}% OFF</div>` : ""}
        </div>
        <div class="p-card-body">
          <div class="p-card-title">${escapeHtml(p.title ?? "")}</div>
          ${cardMetaLine(p)}
          <div class="p-card-pricing">${priceHtml}</div>
          ${!soldOut && available <= 3 ? `<div class="p-card-stock low">Only ${available} left</div>` : ""}
          ${soldOut ? `<div class="p-card-stock">Sold out</div>` : ""}
        </div>
      </a>
    </div>
  `;
}

function heartIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;
}

// Same wishlist-heart wiring as products.html's grid — see the comment there
// for the isInWishlist() cost tradeoff. Kept as a duplicate here rather than
// a shared import because productCard()/renderGrid() are themselves already
// duplicated between this file and products.html.
function hydrateWishlistHearts(scope) {
  const buttons = scope.querySelectorAll(".p-card-wish");
  buttons.forEach(async (btn) => {
    const id = btn.dataset.productId;
    if (!id) return;
    try {
      if (await isInWishlist(id)) {
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
      }
    } catch {}
  });
  if (scope.dataset.wishBound) return;
  scope.dataset.wishBound = "1";
  scope.addEventListener("click", async (e) => {
    const btn = e.target.closest(".p-card-wish");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.productId;
    if (!id) return;
    const active = btn.classList.toggle("is-active");
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    try {
      if (active) await addToWishlist(id);
      else await removeFromWishlist(id);
    } catch {
      btn.classList.toggle("is-active", !active);
      btn.setAttribute("aria-pressed", !active ? "true" : "false");
    }
  });
}

function setStatus(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg ?? "";
}

function renderGrid(gridId, items) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = (items ?? []).map(productCard).join("");
  hydrateWishlistHearts(grid);
}

function pickHeroBackground(products) {
  const hero = document.querySelector(".hero-slide[data-slide='1']");
  if (!hero) return;
  const img = (products ?? []).find(p => p.image_url)?.image_url;
  if (img) hero.style.setProperty("--hero-bg", `url("${safeCssUrl(img)}")`);
}

/* ------------------ DATA FETCHERS ------------------ */

// New Arrivals = latest products by created_at, available ones only. This
// catalog is one-of-a-kind handloom pieces that mostly never restock, so a
// "trending/most viewed" rail (removed — see the homepage restructure
// discussion) would just skew toward showing what already sold out. New
// Arrivals has the same risk, just slower — a piece posted as "new" this
// week can be gone next week — so this over-fetches (3x the display count)
// and filters to available_qty > 0 client-side, since inventory_qty alone
// doesn't account for an active reservation holding the last unit.
async function fetchLatestActive(displayLimit = 8) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,title,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at,colour,fabric:fabrics(name), product_images(image_url, thumb_url, width, height, sort_order)"
    )
    .eq("is_active", true)
    .gt("inventory_qty", 0)
    .order("created_at", { ascending: false })
    .limit(displayLimit * 3);

  if (error) throw error;
  return normalizeProducts(data ?? []).filter(p => p.available_qty > 0).slice(0, displayLimit);
}

/* ------------------ MAIN HYDRATOR ------------------ */

// UX-027: stale-while-revalidate for the New Arrivals grid. Raw rows from
// the last good fetch are kept in localStorage; a repeat visit paints them
// at once and only re-queries once they are older than HOME_TTL_MS,
// re-rendering only if the rows changed. Normalisation (image sizes,
// available_qty) runs on the way out of the cache so the cached shape
// stays the plain query result.
const HOME_CACHE_KEY = "ahamstree_home_products_v2";
const HOME_TTL_MS = 10 * 60 * 1000;
const HOME_MAX_STALE_MS = 24 * 60 * 60 * 1000;

function readHomeCache() {
  try {
    const c = JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || "null");
    if (!c || !Array.isArray(c.latest)) return null;
    const age = Date.now() - Number(c.t || 0);
    if (!(age >= 0) || age > HOME_MAX_STALE_MS) return null;
    return { latest: c.latest, fresh: age < HOME_TTL_MS };
  } catch (_) { return null; }
}
function writeHomeCache(latest) {
  try { localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ t: Date.now(), latest })); } catch (_) {}
}

function paintHome(latestRaw) {
  const latest = normalizeProducts(latestRaw);
  renderGrid("newCollectionGrid", latest);
  setStatus("newCollectionStatus", "");
  pickHeroBackground(latest);
  return latest;
}

export async function hydrateHome() {
  // Collections are shared between the quick-jump row and the full
  // showcase further down — fetched once, rendered in both places.
  const collectionsPromise = fetchCollections().catch(() => []);

  const cached = readHomeCache();
  let shownSig = "";
  let latestForQuickJump = null;
  if (cached) {
    try {
      latestForQuickJump = paintHome(cached.latest);
      shownSig = JSON.stringify(cached.latest);
    } catch (e) { console.error(e); }
  }

  const collections = await collectionsPromise;
  renderCollectionsShowcase(collections);
  hydrateQuickJumpRow(latestForQuickJump?.[0]?.image_url || null, collections);

  if (cached?.fresh) return;

  try {
    const latest = await fetchLatestActive(8);
    writeHomeCache(latest);
    if (JSON.stringify(latest) !== shownSig) {
      const painted = paintHome(latest);
      // Quick-jump's "New Arrivals" circle photo may have been missing (or
      // stale) on the first pass above — refresh it now that a live fetch
      // landed, same collections already rendered.
      hydrateQuickJumpRow(painted?.[0]?.image_url || null, collections);
    }
  } catch (e) {
    console.error(e);
    if (!cached) setStatus("newCollectionStatus", "Could not load products.");
  }
}
