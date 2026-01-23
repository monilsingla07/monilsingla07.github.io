import { loadGA4, track, addRecentlyViewed, getRecentlyViewed } from "./analytics.js";

const WHATSAPP = "https://wa.me/919582297550";
const INSTAGRAM = "https://www.instagram.com/ahamstree/";

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

function moneyINR(n){
  const x = Number(n || 0);
  return "₹ " + x.toLocaleString("en-IN");
}

function safeImg(product, idx){
  const list = (product && product.images) ? product.images : [];
  const v = list[idx] || list[0];
  if(v) return v;
  const ph = window.AHAM_PLACEHOLDERS || [];
  return ph[(Math.random()*ph.length)|0] || "";
}

function toggleMobileNav(){
  const nav = $("#navlinks");
  if(nav) nav.classList.toggle("open");
}

function mountCommon(){
  const ham = $("#hamburger");
  if(ham) ham.addEventListener("click", toggleMobileNav);

  $all("[data-whatsapp]").forEach(el => el.addEventListener("click", () => {
    track("click_whatsapp", { page: location.pathname });
    window.open(WHATSAPP, "_blank");
  }));

  $all("[data-instagram]").forEach(el => el.addEventListener("click", () => {
    track("click_instagram", { page: location.pathname });
    window.open(INSTAGRAM, "_blank");
  }));

  // footer year
  const y = $("#year");
  if(y) y.textContent = new Date().getFullYear();
}

function renderProductCard(p){
  const img = safeImg(p, 0);
  return `
    <a class="card product" href="product.html?id=${encodeURIComponent(p.id)}" data-product-link="${p.id}">
      <div class="img">
        <img src="${img}" alt="${p.title}" onerror="this.src='assets/placeholders/p1.jpg'">
      </div>
      <div class="body">
        <div class="title">${p.title}</div>
        <div class="meta">${p.subtitle}</div>
        <div class="row">
          <div class="price">${moneyINR(p.price)}</div>
          <div class="btn primary" style="padding:8px 12px;">View</div>
        </div>
      </div>
    </a>
  `;
}

function attachCardTracking(){
  $all("[data-product-link]").forEach(a => {
    a.addEventListener("click", () => {
      const id = a.getAttribute("data-product-link");
      track("select_product", { product_id: id });
    });
  });
}

function renderGrid(targetId, products){
  const el = document.getElementById(targetId);
  if(!el) return;
  el.innerHTML = products.map(renderProductCard).join("");
  attachCardTracking();
}

/* ===== Collections filtering (simple, extendable) ===== */
function getFiltersState(){
  const params = new URLSearchParams(location.search);
  return {
    fabric: params.get("fabric") || "All",
    occasion: params.get("occasion") || "All",
    sort: params.get("sort") || "Featured",
    q: params.get("q") || ""
  };
}

function setQueryParams(next){
  const params = new URLSearchParams(location.search);
  Object.entries(next).forEach(([k,v]) => {
    if(!v || v === "All" || v === "Featured") params.delete(k);
    else params.set(k, v);
  });
  location.search = params.toString();
}

function applyFilters(products, st){
  let out = [...products];

  if(st.q){
    const q = st.q.toLowerCase();
    out = out.filter(p => (p.title+p.subtitle+p.fabric+p.finish+p.color).toLowerCase().includes(q));
  }

  if(st.fabric !== "All"){
    out = out.filter(p => (p.fabric || "").toLowerCase() === st.fabric.toLowerCase());
  }

  if(st.occasion !== "All"){
    out = out.filter(p => (p.occasion || "").toLowerCase() === st.occasion.toLowerCase());
  }

  if(st.sort === "Price: Low to High") out.sort((a,b)=>a.price-b.price);
  if(st.sort === "Price: High to Low") out.sort((a,b)=>b.price-a.price);
  if(st.sort === "New Arrivals") out = out; // placeholder (when backend exists)

  return out;
}

function mountCollections(){
  const grid = $("#collectionGrid");
  if(!grid) return;

  const st = getFiltersState();
  const all = window.AHAM_PRODUCTS || [];
  const filtered = applyFilters(all, st);

  // render chips UI state
  $all("[data-filter-fabric]").forEach(ch => {
    if(ch.getAttribute("data-filter-fabric") === st.fabric) ch.classList.add("active");
  });
  $all("[data-filter-occasion]").forEach(ch => {
    if(ch.getAttribute("data-filter-occasion") === st.occasion) ch.classList.add("active");
  });

  const sortSel = $("#sortSelect");
  if(sortSel) sortSel.value = st.sort;

  const qInput = $("#qInput");
  if(qInput) qInput.value = st.q;

  renderGrid("collectionGrid", filtered);
  const count = $("#resultCount");
  if(count) count.textContent = `${filtered.length} products`;

  // bind interactions
  $all("[data-filter-fabric]").forEach(ch => ch.addEventListener("click", () => {
    setQueryParams({ fabric: ch.getAttribute("data-filter-fabric") });
  }));
  $all("[data-filter-occasion]").forEach(ch => ch.addEventListener("click", () => {
    setQueryParams({ occasion: ch.getAttribute("data-filter-occasion") });
  }));

  if(sortSel) sortSel.addEventListener("change", () => setQueryParams({ sort: sortSel.value }));
  const qForm = $("#searchForm");
  if(qForm) qForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setQueryParams({ q: qInput.value.trim() });
  });

  track("view_item_list", { list_name: "collections", count: filtered.length });
}

/* ===== Product page gallery + lightbox ===== */
function openLightbox(src, title=""){
  const lb = $("#lightbox");
  const img = $("#lightboxImg");
  const t = $("#lightboxTitle");
  if(!lb || !img || !t) return;
  t.textContent = title || "Preview";
  img.src = src;
  lb.classList.add("open");
  track("open_image", { src });
}
function closeLightbox(){
  const lb = $("#lightbox");
  if(lb) lb.classList.remove("open");
}

function mountProduct(){
  const holder = $("#productDetails");
  if(!holder) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const all = window.AHAM_PRODUCTS || [];
  const p = all.find(x => x.id === id) || all[0];
  if(!p) return;

  addRecentlyViewed(p.id);
  track("view_item", { product_id: p.id, product_name: p.title, price: p.price });

  // build thumbs
  const imgs = (p.images && p.images.length ? p.images : [safeImg(p,0)]).map((src,i)=>({
    src, i
  }));

  const main = imgs[0].src;

  holder.innerHTML = `
    <div class="card gallery">
      <div class="mainImage" id="mainImage">
        <img id="mainImgEl" src="${main}" alt="${p.title}" onerror="this.src='assets/placeholders/p1.jpg'">
      </div>
      <div class="thumbs">
        ${imgs.map(x => `
          <button type="button" class="thumbBtn" data-src="${x.src}">
            <img src="${x.src}" alt="Thumbnail" onerror="this.src='assets/placeholders/p2.jpg'">
          </button>
        `).join("")}
      </div>
      <div class="small" style="margin-top:10px; color:var(--muted);">
        Tap image to enlarge. Multiple views available.
      </div>
    </div>

    <div class="card details">
      <div class="breadcrumb">Home / Chanderi Sarees / ${p.fabric}</div>
      <h1>${p.title}</h1>
      <div style="color:var(--muted);">${p.subtitle}</div>

      <div class="badges">
        <div class="badge2">${p.weave}</div>
        <div class="badge2">${p.fabric}</div>
        <div class="badge2">${p.finish}</div>
        <div class="badge2">${p.occasion}</div>
      </div>

      <div class="priceBig">${moneyINR(p.price)}</div>

      <div class="specs">
        <strong>Details</strong><br/>
        Color: ${p.color}<br/>
        Fabric: ${p.fabric}<br/>
        Weave: ${p.weave}<br/>
        Finish: ${p.finish}<br/>
        Occasion: ${p.occasion}<br/><br/>
        <strong>Care</strong><br/>
        Dry clean recommended. Store folded in a cool, dry place.
      </div>

      <div class="actions2">
        <a class="btn primary" id="waEnquire" href="#">Enquire on WhatsApp</a>
        <a class="btn" href="collections.html">Back to Collections</a>
      </div>

      <div class="small" style="margin-top:12px; color:var(--muted);">
        In future you can add user accounts + track views via Firebase/Supabase. This site already emits track events.
      </div>
    </div>
  `;

  // thumbs
  $all(".thumbBtn").forEach(btn => btn.addEventListener("click", () => {
    const src = btn.getAttribute("data-src");
    const mainEl = $("#mainImgEl");
    if(mainEl) mainEl.src = src;
    track("select_image", { product_id: p.id, src });
  }));

  // lightbox
  const mainBox = $("#mainImage");
  if(mainBox) mainBox.addEventListener("click", () => {
    const src = $("#mainImgEl")?.getAttribute("src");
    if(src) openLightbox(src, p.title);
  });

  // WhatsApp enquiry prefill
  const wa = $("#waEnquire");
  if(wa){
    wa.addEventListener("click", (e) => {
      e.preventDefault();
      const msg = encodeURIComponent(
        `Hi AhamStree,\nI’m interested in:\n${p.title}\nPrice: ${moneyINR(p.price)}\nProduct ID: ${p.id}\n\nPlease share available colors & delivery timeline.`
      );
      track("enquire_whatsapp", { product_id: p.id });
      window.open(`${WHATSAPP}?text=${msg}`, "_blank");
    });
  }

  // Recently viewed (optional section if present)
  const rv = $("#recentlyViewed");
  if(rv){
    const ids = getRecentlyViewed().filter(x => x !== p.id).slice(0, 4);
    const items = ids.map(pid => all.find(x => x.id === pid)).filter(Boolean);
    rv.innerHTML = items.length ? items.map(renderProductCard).join("") : `<div class="small" style="color:var(--muted);">No recently viewed items yet.</div>`;
    attachCardTracking();
  }
}

/* ===== Contact form: opens WhatsApp with details + resets ===== */
function setupContactForm(){
  const form = $("#contactForm");
  if(!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const name = (fd.get("name")||"").toString().trim();
    const phone = (fd.get("phone")||"").toString().trim();
    const email = (fd.get("email")||"").toString().trim();
    const message = (fd.get("message")||"").toString().trim();

    const text = encodeURIComponent([
      "New enquiry from AhamStree website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `Message: ${message}`
    ].filter(Boolean).join("\n"));

    track("lead_submit", { name_present: !!name, phone_present: !!phone });

    window.open(`${WHATSAPP}?text=${text}`, "_blank");
    form.reset();
  });
}

/* ===== Index sections ===== */
function mountHome(){
  if($("#featuredProducts")) renderGrid("featuredProducts", (window.AHAM_PRODUCTS||[]).slice(0,8));
  if($("#newArrivals")) renderGrid("newArrivals", (window.AHAM_PRODUCTS||[]).slice(0,4));
  if($("#bestSellers")) renderGrid("bestSellers", (window.AHAM_PRODUCTS||[]).slice(2,6));
  track("page_view", { page: "home" });
}

document.addEventListener("DOMContentLoaded", () => {
  loadGA4();
  mountCommon();

  // Lightbox close
  const lb = $("#lightbox");
  const close = $("#lightboxClose");
  if(close) close.addEventListener("click", closeLightbox);
  if(lb) lb.addEventListener("click", (e) => {
    if(e.target === lb) closeLightbox();
  });

  mountHome();
  mountCollections();
  mountProduct();
  setupContactForm();
});
