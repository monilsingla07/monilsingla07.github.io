const WHATSAPP = "https://wa.me/919582297550";
const INSTAGRAM = "https://www.instagram.com/ahamstree/";

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

function moneyINR(n){
  try { return new Intl.NumberFormat("en-IN").format(n); }
  catch { return String(n); }
}

/* -------- Tracking (works now; future backend-ready) --------
   - If GA4 gtag exists, uses it
   - Always queues events into localStorage (aham_events_queue)
*/
function track(eventName, params = {}){
  const payload = {
    event: eventName,
    ...params,
    ts: Date.now(),
    path: location.pathname + location.search,
    title: document.title
  };

  if (typeof window.gtag === "function"){
    window.gtag("event", eventName, params);
  } else {
    console.log("[track]", payload);
  }

  try{
    const key = "aham_events_queue";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(payload);
    localStorage.setItem(key, JSON.stringify(arr.slice(-250)));
  }catch{}
}

function getAllProducts(){
  return Array.isArray(window.AHAM_PRODUCTS) ? window.AHAM_PRODUCTS : [];
}
function getProductById(id){
  return getAllProducts().find(p => p.id === id);
}

/* Auto-generate image paths for 5 images/product */
function getProductImages(p){
  if (p && Array.isArray(p.images) && p.images.length) return p.images;
  const count = (p && typeof p.image_count === "number") ? p.image_count : 0;
  if (p && p.id && count > 0){
    return Array.from({length: count}, (_, i) => `assets/products/${p.id}/${i+1}.jpg`);
  }
  return ["assets/products/placeholder.jpg"];
}

/* Recently viewed (local now, backend later) */
function saveRecentlyViewed(productId){
  try{
    const key="aham_recent";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    const next = [productId, ...arr.filter(x=>x!==productId)].slice(0, 6);
    localStorage.setItem(key, JSON.stringify(next));
  }catch{}
}
function getRecentlyViewed(){
  try{ return JSON.parse(localStorage.getItem("aham_recent") || "[]"); }
  catch{ return []; }
}

/* -------- Common header actions -------- */
function toggleMobileNav(){
  const nav = $("#navlinks");
  if(nav) nav.classList.toggle("open");
}

function mountCommon(){
  const ham = $("#hamburger");
  if(ham) ham.addEventListener("click", toggleMobileNav);

  $all("[data-whatsapp]").forEach(el=>{
    el.addEventListener("click", ()=>{
      track("whatsapp_click", { where: "header_or_cta" });
      window.open(WHATSAPP, "_blank");
    });
  });

  $all("[data-instagram]").forEach(el=>{
    el.addEventListener("click", ()=>{
      track("instagram_click", { where: "header_or_cta" });
      window.open(INSTAGRAM, "_blank");
    });
  });

  track("page_view");
}

/* -------- Product cards (image-first) -------- */
function productCardHTML(p){
  const imgs = getProductImages(p);
  const img = imgs[0] || "assets/products/placeholder.jpg";
  const price = typeof p.price_inr === "number" ? `₹${moneyINR(p.price_inr)}` : "Ask on WhatsApp";
  const tag = (p.tags||[]).includes("new") ? `<span class="tag">New</span>` : "";

  return `
    <a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}" data-pid="${p.id}">
      <div class="product-imgwrap">
        <img src="${img}" alt="${p.title}" loading="lazy"
             onerror="this.onerror=null;this.src='assets/products/placeholder.jpg';"/>
      </div>
      <div class="product-body">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div class="product-title">${p.title}</div>
          ${tag}
        </div>
        <div class="product-sub">${p.subtitle || "Chanderi Saree"}</div>
        <div class="product-row">
          <div class="price">${price}</div>
          <span class="small">View</span>
        </div>
      </div>
    </a>
  `;
}

function renderProducts(targetId, products){
  const el = document.getElementById(targetId);
  if(!el) return;
  const list = Array.isArray(products) ? products : [];
  el.innerHTML = list.map(productCardHTML).join("");

  el.querySelectorAll("[data-pid]").forEach(a=>{
    a.addEventListener("click", ()=>{
      track("product_click", { product_id: a.getAttribute("data-pid") });
    });
  });
}

/* -------- Collections: chips + drawer + search + sort -------- */
function parsePrice(p){ return typeof p.price_inr === "number" ? p.price_inr : 99999999; }

function setupCollections(){
  const grid = $("#collectionGrid");
  if(!grid) return;

  const all = getAllProducts();
  let current = { tag:"all", q:"", sort:"featured" };

  const chips = $all("[data-chip]");
  const search = $("#searchInput");
  const sortSel = $("#sortSelect");
  const countEl = $("#resultCount");

  // Drawer (mobile)
  const drawer = $("#filterDrawer");
  const openBtn = $("#openFilters");
  const closeBtn = $("#closeFilters");
  const backdrop = $("#drawerBackdrop");

  const fabricChecks = $all("[data-filter-fabric]");
  const occasionChecks = $all("[data-filter-occasion]");

  function closeDrawer(){
    if(drawer) drawer.classList.remove("open");
  }
  function openDrawer(){
    if(drawer) drawer.classList.add("open");
  }

  if(openBtn) openBtn.addEventListener("click", openDrawer);
  if(closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if(backdrop) backdrop.addEventListener("click", closeDrawer);

  function getDrawerFilters(){
    const fabrics = fabricChecks.filter(c=>c.checked).map(c=>c.value);
    const occasions = occasionChecks.filter(c=>c.checked).map(c=>c.value);
    return { fabrics, occasions };
  }

  function apply(){
    let list = all.slice();

    // chip tag
    if(current.tag !== "all"){
      list = list.filter(p => (p.tags||[]).includes(current.tag));
    }

    // search
    if(current.q){
      const q = current.q.toLowerCase();
      list = list.filter(p =>
        (p.title||"").toLowerCase().includes(q) ||
        (p.subtitle||"").toLowerCase().includes(q) ||
        (p.fabric||"").toLowerCase().includes(q)
      );
    }

    // drawer filters
    const df = getDrawerFilters();
    if(df.fabrics.length){
      list = list.filter(p => df.fabrics.some(f => (p.fabric||"").toLowerCase().includes(f)));
    }
    if(df.occasions.length){
      list = list.filter(p => df.occasions.some(o => (p.occasion||"").toLowerCase().includes(o)));
    }

    // sort
    if(current.sort === "priceLow") list.sort((a,b)=>parsePrice(a)-parsePrice(b));
    if(current.sort === "priceHigh") list.sort((a,b)=>parsePrice(b)-parsePrice(a));
    if(current.sort === "new") list.sort((a,b)=>((b.tags||[]).includes("new")?1:0)-((a.tags||[]).includes("new")?1:0));

    renderProducts("collectionGrid", list);
    if(countEl) countEl.textContent = String(list.length);

    track("catalog_view", { tag: current.tag, q: current.q, sort: current.sort, fabrics: df.fabrics.join(","), occasions: df.occasions.join(",") });
  }

  chips.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      current.tag = btn.getAttribute("data-chip") || "all";
      chips.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      apply();
    });
  });

  if(search){
    search.addEventListener("input", ()=>{
      current.q = search.value.trim();
      apply();
    });
  }

  if(sortSel){
    sortSel.addEventListener("change", ()=>{
      current.sort = sortSel.value;
      apply();
    });
  }

  [...fabricChecks, ...occasionChecks].forEach(c=>{
    c.addEventListener("change", apply);
  });

  // default
  const allChip = chips.find(c=>c.getAttribute("data-chip")==="all");
  if(allChip) allChip.classList.add("active");
  apply();
}

/* -------- Product page: gallery + zoom/lightbox + recently viewed -------- */
function setupProductPage(){
  const main = $("#mainImage");
  if(!main) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const p = getProductById(id) || getAllProducts()[0];
  if(!p) return;

  document.title = `${p.title} — AhamStree`;
  $("#crumbTitle") && ($("#crumbTitle").textContent = p.title);

  $("#pTitle") && ($("#pTitle").textContent = p.title);
  $("#pSub") && ($("#pSub").textContent = p.subtitle || "Chanderi Saree");
  $("#pPrice") && ($("#pPrice").textContent = typeof p.price_inr === "number" ? `₹${moneyINR(p.price_inr)}` : "Ask on WhatsApp");
  $("#mFabric") && ($("#mFabric").textContent = p.fabric || "Chanderi");
  $("#mOccasion") && ($("#mOccasion").textContent = p.occasion || "Festive");
  $("#mWeave") && ($("#mWeave").textContent = p.weave || "Handwoven");
  $("#mCare") && ($("#mCare").textContent = p.care || "Dry Clean");
  $("#pDesc") && ($("#pDesc").textContent = p.description || "Message us on WhatsApp for availability and styling help.");

  // track + recent
  saveRecentlyViewed(p.id);
  track("product_view", { product_id: p.id });

  // WhatsApp order prefill
  const orderBtn = $("#orderBtn");
  if(orderBtn){
    orderBtn.addEventListener("click", ()=>{
      const msg = encodeURIComponent(
        `Hi AhamStree, I'm interested in:\n${p.title}\nID: ${p.id}\nPlease share availability and details.`
      );
      track("whatsapp_click", { where:"product_page", product_id:p.id });
      window.open(`${WHATSAPP}?text=${msg}`, "_blank");
    });
  }

  const images = getProductImages(p);
  let idx = 0;

  function setImage(i){
    idx = (i + images.length) % images.length;
    main.src = images[idx];
    main.onerror = ()=>{ main.src = "assets/products/placeholder.jpg"; };
    $all(".thumb").forEach((t,k)=>t.classList.toggle("active", k===idx));
    track("product_image_change", { product_id:p.id, index: idx });
  }

  // thumbs
  const thumbs = $("#thumbs");
  if(thumbs){
    thumbs.innerHTML = images.map((src,i)=>`
      <button class="thumb ${i===0?"active":""}" type="button" aria-label="Image ${i+1}">
        <img src="${src}" alt="${p.title} thumbnail ${i+1}" loading="lazy"
             onerror="this.onerror=null;this.src='assets/products/placeholder.jpg';"/>
      </button>
    `).join("");

    $all(".thumb").forEach((b,i)=>b.addEventListener("click", ()=>setImage(i)));
  }

  setImage(0);

  // lightbox
  const lb = $("#lightbox");
  const lbImg = $("#lbImg");
  const lbClose = $("#lbClose");
  const lbPrev = $("#lbPrev");
  const lbNext = $("#lbNext");
  const lbBackdrop = $("#lbBackdrop");
  const zoomBtn = $("#zoomBtn");

  function openLB(){
    if(!lb || !lbImg) return;
    lbImg.src = images[idx];
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
    track("image_zoom_open", { product_id:p.id, index:idx });
  }
  function closeLB(){
    if(!lb) return;
    lb.classList.remove("open");
    document.body.style.overflow = "";
    track("image_zoom_close", { product_id:p.id, index:idx });
  }
  function nav(d){
    setImage(idx + d);
    if(lbImg) lbImg.src = images[idx];
  }

  main.addEventListener("click", openLB);
  zoomBtn && zoomBtn.addEventListener("click", openLB);
  lbClose && lbClose.addEventListener("click", closeLB);
  lbBackdrop && lbBackdrop.addEventListener("click", closeLB);
  lbPrev && lbPrev.addEventListener("click", ()=>nav(-1));
  lbNext && lbNext.addEventListener("click", ()=>nav(1));

  document.addEventListener("keydown", (e)=>{
    if(!lb || !lb.classList.contains("open")) return;
    if(e.key==="Escape") closeLB();
    if(e.key==="ArrowLeft") nav(-1);
    if(e.key==="ArrowRight") nav(1);
  });

  // recently viewed
  const recentIds = getRecentlyViewed().filter(x=>x!==p.id);
  const recent = recentIds.map(getProductById).filter(Boolean).slice(0,4);
  renderProducts("recentGrid", recent);
}

/* -------- Contact: WhatsApp prefill + reset -------- */
function setupContactForm(){
  const form = $("#contactForm");
  if(!form) return;

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get("name")||"").toString().trim();
    const phone = (fd.get("phone")||"").toString().trim();
    const email = (fd.get("email")||"").toString().trim();
    const message = (fd.get("message")||"").toString().trim();

    const lines = [
      "New enquiry from AhamStree website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `Message: ${message}`
    ].filter(Boolean);

    track("contact_submit", { method:"whatsapp_prefill" });

    const text = encodeURIComponent(lines.join("\n"));
    window.open(`${WHATSAPP}?text=${text}`, "_blank");
    form.reset();
  });
}

/* -------- Boot -------- */
document.addEventListener("DOMContentLoaded", ()=>{
  mountCommon();

  // Home featured
  if($("#featuredGrid")){
    renderProducts("featuredGrid", getAllProducts().slice(0, 8));
  }

  // Collections
  setupCollections();

  // Product page
  setupProductPage();

  // Contact page
  setupContactForm();
});
