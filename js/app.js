const WHATSAPP = "https://wa.me/919582297550";
const INSTAGRAM = "https://www.instagram.com/ahamstree/";

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

function moneyINR(n){
  try { return new Intl.NumberFormat("en-IN").format(n); }
  catch { return String(n); }
}

/* -------------------------
   Tracking (works now; upgrade later)
   - If GA4 exists (gtag), uses it
   - Else logs to console
   - Stores basic events in localStorage queue (future backend sync)
--------------------------*/
function track(eventName, params = {}) {
  const payload = {
    event: eventName,
    ...params,
    ts: Date.now(),
    path: location.pathname + location.search
  };

  // GA4 (if you add it later)
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  } else {
    // keep it visible during setup
    console.log("[track]", payload);
  }

  // Queue for future backend sync
  try {
    const key = "aham_events_queue";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(payload);
    localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
  } catch {}
}

function toggleMobileNav(){
  const nav = $("#navlinks");
  if(nav) nav.classList.toggle("open");
}

function mountCommon(){
  const ham = $("#hamburger");
  if(ham) ham.addEventListener("click", toggleMobileNav);

  $all("[data-whatsapp]").forEach(el => {
    el.addEventListener("click", () => {
      track("whatsapp_click", { where: "header_or_cta" });
      window.open(WHATSAPP, "_blank");
    });
  });

  $all("[data-instagram]").forEach(el => {
    el.addEventListener("click", () => {
      track("instagram_click", { where: "header_or_cta" });
      window.open(INSTAGRAM, "_blank");
    });
  });

  track("page_view", { title: document.title });
}

/* -------------------------
   Products helpers
--------------------------*/
function getAllProducts(){
  return Array.isArray(window.AHAM_PRODUCTS) ? window.AHAM_PRODUCTS : [];
}

function getProductById(id){
  return getAllProducts().find(p => p.id === id);
}

function saveRecentlyViewed(productId){
  try {
    const key = "aham_recent";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    const next = [productId, ...arr.filter(x => x !== productId)].slice(0, 6);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

function getRecentlyViewed(){
  try {
    const key = "aham_recent";
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

/* -------------------------
   Render product cards (with images)
--------------------------*/
function productCardHTML(p){
  const img = (p.images && p.images[0]) ? p.images[0] : "assets/products/placeholder.jpg";
  const price = p.price_label || (p.price_inr ? `₹${moneyINR(p.price_inr)}` : "Ask on WhatsApp");

  return `
    <a class="tile product" href="product.html?id=${encodeURIComponent(p.id)}" data-pid="${p.id}">
      <div class="product-imgwrap">
        <img class="product-img" src="${img}" alt="${p.title}" loading="lazy"
             onerror="this.onerror=null;this.src='assets/products/placeholder.jpg';"/>
      </div>
      <div class="body">
        <div class="title">${p.title}</div>
        <div class="meta">${p.subtitle || "Chanderi Saree"}</div>
        <div class="row">
          <div class="price">${price}</div>
          <div class="btn primary" style="padding:8px 12px; border-radius:999px;">View</div>
        </div>
      </div>
    </a>
  `;
}

function renderProducts(targetId, products, limit){
  const el = document.getElementById(targetId);
  if(!el) return;

  const list = Array.isArray(products) ? products : [];
  const items = typeof limit === "number" ? list.slice(0, limit) : list;

  el.innerHTML = items.map(productCardHTML).join("");

  // tracking: click on product
  el.querySelectorAll("[data-pid]").forEach(a => {
    a.addEventListener("click", () => {
      track("product_click", { product_id: a.getAttribute("data-pid") });
    });
  });
}

/* -------------------------
   Collections page filtering + sorting
--------------------------*/
function parsePrice(p){
  return typeof p.price_inr === "number" ? p.price_inr : 99999999;
}

function setupCollections(){
  const grid = $("#collectionGrid");
  if(!grid) return;

  const all = getAllProducts();
  let currentTag = "all";
  let query = "";
  let sort = "featured";

  const chips = $all("[data-chip]");
  const search = $("#searchInput");
  const sortSelect = $("#sortSelect");
  const countEl = $("#resultCount");

  const apply = () => {
    let list = all.slice();

    if(currentTag !== "all"){
      list = list.filter(p => (p.tags || []).includes(currentTag));
    }

    if(query){
      const q = query.toLowerCase();
      list = list.filter(p =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.subtitle || "").toLowerCase().includes(q) ||
        (p.fabric || "").toLowerCase().includes(q)
      );
    }

    if(sort === "priceLow") list.sort((a,b) => parsePrice(a)-parsePrice(b));
    if(sort === "priceHigh") list.sort((a,b) => parsePrice(b)-parsePrice(a));
    if(sort === "new") list.sort((a,b) => ((b.tags||[]).includes("new")?1:0) - ((a.tags||[]).includes("new")?1:0));

    renderProducts("collectionGrid", list);

    if(countEl) countEl.textContent = String(list.length);
    track("catalog_view", { tag: currentTag, q: query || "", sort });
  };

  chips.forEach(btn => {
    btn.addEventListener("click", () => {
      currentTag = btn.getAttribute("data-chip") || "all";
      chips.forEach(b => b.classList.remove("chip-active"));
      btn.classList.add("chip-active");
      apply();
    });
  });

  if(search){
    search.addEventListener("input", () => {
      query = search.value.trim();
      apply();
    });
  }

  if(sortSelect){
    sortSelect.addEventListener("change", () => {
      sort = sortSelect.value;
      apply();
    });
  }

  // default state
  const allChip = chips.find(c => c.getAttribute("data-chip") === "all");
  if(allChip) allChip.classList.add("chip-active");
  apply();
}

/* -------------------------
   Product page gallery + lightbox
--------------------------*/
function setupProductPage(){
  const holder = $("#productTitle");
  const mainImg = $("#mainImage");
  if(!holder || !mainImg) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const p = getProductById(id) || getAllProducts()[0];

  if(!p) return;

  // set content
  $("#crumbTitle").textContent = p.title || "Product";
  $("#productKicker").textContent = "AhamStree • Chanderi";
  $("#productTitle").textContent = p.title || "Chanderi Saree";
  $("#productSubtitle").textContent = p.subtitle || "Chanderi Saree";
  $("#productPrice").textContent = p.price_label || (p.price_inr ? `₹${moneyINR(p.price_inr)}` : "Ask on WhatsApp");
  $("#metaFabric").textContent = p.fabric || "Chanderi";
  $("#metaOccasion").textContent = p.occasion || "Festive";
  $("#metaWeave").textContent = p.weave || "Handwoven";
  $("#metaCare").textContent = p.care || "Dry Clean";
  $("#productDesc").textContent = p.description || "Message us on WhatsApp for availability and styling help.";

  document.title = `${p.title} — AhamStree`;

  // tracking + recently viewed
  saveRecentlyViewed(p.id);
  track("product_view", { product_id: p.id, title: p.title });

  // whatsapp order with prefilled message
  const orderBtn = $("#whatsappOrderBtn");
  if(orderBtn){
    orderBtn.addEventListener("click", () => {
      const msg = encodeURIComponent(
        `Hi AhamStree, I'm interested in:\n${p.title}\nID: ${p.id}\nPrice: ${p.price_label || ""}\nPlease share availability and more photos.`
      );
      track("whatsapp_click", { where: "product_page", product_id: p.id });
      window.open(`${WHATSAPP}?text=${msg}`, "_blank");
    });
  }

  // gallery
  const images = Array.isArray(p.images) && p.images.length ? p.images : ["assets/products/placeholder.jpg"];
  let idx = 0;

  const thumbs = $("#thumbs");
  thumbs.innerHTML = images.map((src, i) => `
    <button class="thumb ${i===0?"active":""}" type="button" aria-label="View image ${i+1}">
      <img src="${src}" alt="${p.title} thumbnail ${i+1}" loading="lazy"
           onerror="this.onerror=null;this.src='assets/products/placeholder.jpg';"/>
    </button>
  `).join("");

  function setImage(i){
    idx = (i + images.length) % images.length;
    mainImg.src = images[idx];
    mainImg.onerror = () => { mainImg.src = "assets/products/placeholder.jpg"; };
    $all(".thumb").forEach((t, k) => t.classList.toggle("active", k === idx));
    track("product_image_change", { product_id: p.id, index: idx });
  }

  setImage(0);

  $all(".thumb").forEach((btn, i) => {
    btn.addEventListener("click", () => setImage(i));
  });

  // Lightbox
  const lightbox = $("#lightbox");
  const lbImg = $("#lightboxImg");
  const lbClose = $("#lightboxClose");
  const lbPrev = $("#lightboxPrev");
  const lbNext = $("#lightboxNext");
  const lbBackdrop = $("#lightboxBackdrop");
  const zoomBtn = $("#zoomBtn");

  function openLightbox(){
    lbImg.src = images[idx];
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    track("image_zoom_open", { product_id: p.id, index: idx });
  }

  function closeLightbox(){
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    track("image_zoom_close", { product_id: p.id, index: idx });
  }

  function nav(delta){
    setImage(idx + delta);
    lbImg.src = images[idx];
  }

  mainImg.addEventListener("click", openLightbox);
  if(zoomBtn) zoomBtn.addEventListener("click", openLightbox);
  if(lbClose) lbClose.addEventListener("click", closeLightbox);
  if(lbBackdrop) lbBackdrop.addEventListener("click", closeLightbox);
  if(lbPrev) lbPrev.addEventListener("click", () => nav(-1));
  if(lbNext) lbNext.addEventListener("click", () => nav(1));

  document.addEventListener("keydown", (e) => {
    if(!lightbox.classList.contains("open")) return;
    if(e.key === "Escape") closeLightbox();
    if(e.key === "ArrowLeft") nav(-1);
    if(e.key === "ArrowRight") nav(1);
  });

  // Recently viewed render (excluding current)
  const recentIds = getRecentlyViewed().filter(x => x !== p.id);
  const recentProducts = recentIds.map(getProductById).filter(Boolean);
  renderProducts("recentlyViewed", recentProducts);
}

/* -------------------------
   Contact form -> WhatsApp + reset (from earlier)
--------------------------*/
function setupContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const name = (fd.get("name") || "").toString().trim();
    const phone = (fd.get("phone") || "").toString().trim();
    const email = (fd.get("email") || "").toString().trim();
    const message = (fd.get("message") || "").toString().trim();

    const lines = [
      "New enquiry from website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `Message: ${message}`,
      "",
      "Please confirm availability / price."
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join("\n"));
    track("contact_submit", { method: "whatsapp_prefill" });

    window.open(`${WHATSAPP}?text=${text}`, "_blank");
    form.reset();
  });
}

/* -------------------------
   Boot
--------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  mountCommon();

  // Home page featured (if exists)
  if ($("#featuredProducts")) {
    renderProducts("featuredProducts", getAllProducts(), 8);
  }

  // Collections page
  setupCollections();

  // Product page
  setupProductPage();

  // Contact page
  setupContactForm();
});
