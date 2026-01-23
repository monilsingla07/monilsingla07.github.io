function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

const WHATSAPP_LINK = () => `https://wa.me/${window.AHAM_CONFIG.whatsappNumber}`;
const IG_LINK = () => window.AHAM_CONFIG.instagram;

function safeImg(url){
  // returns an <img> url; fallback handled via onerror in markup
  return url || window.AHAM_PLACEHOLDER;
}

function toggleMobileNav(){
  const nav = $("#navlinks");
  if(nav) nav.classList.toggle("open");
}

function mountCommon(){
  const ham = $("#hamburger");
  if(ham) ham.addEventListener("click", toggleMobileNav);

  // buttons
  $all("[data-whatsapp]").forEach(el => {
    el.addEventListener("click", () => {
      window.AhamTrack?.track("whatsapp_click", { from: location.pathname });
      window.open(WHATSAPP_LINK(), "_blank");
    });
  });

  $all("[data-instagram]").forEach(el => {
    el.addEventListener("click", () => window.open(IG_LINK(), "_blank"));
  });

  // year
  const year = $("#year");
  if(year) year.textContent = new Date().getFullYear();

  // basic page view tracking
  window.AhamTrack?.track("page_view", { path: location.pathname, q: location.search });
}

function renderProductGrid(targetId, list){
  const el = document.getElementById(targetId);
  if(!el) return;

  el.innerHTML = (list || []).map(p => {
    const cover = safeImg((p.images && p.images.length) ? p.images[0] : window.AHAM_PLACEHOLDER);
    return `
      <a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}" data-pid="${p.id}">
        <div class="product-img">
          <img src="${cover}" alt="${p.title}" loading="lazy"
               onerror="this.src='${window.AHAM_PLACEHOLDER}'">
        </div>
        <div class="product-body">
          <div class="product-title">${p.title}</div>
          <div class="product-sub">${p.subtitle}</div>
          <div class="product-row">
            <div class="product-price">${p.price}</div>
            <div class="btn white" style="padding:8px 12px;">View</div>
          </div>
        </div>
      </a>
    `;
  }).join("");

  // track clicks
  $all(`#${targetId} a[data-pid]`).forEach(a => {
    a.addEventListener("click", () => {
      window.AhamTrack?.track("product_click", { id: a.getAttribute("data-pid") });
    });
  });
}

/* ===== Collections filtering (simple chips) ===== */
function setupCollections(){
  const gridId = "collectionGrid";
  const chips = $all("[data-filter]");
  const sort = $("#sortSelect");

  if(!document.getElementById(gridId)) return;

  let activeTag = "All";
  let activeSort = "Featured";

  function apply(){
    let items = [...window.AHAM_PRODUCTS];

    if(activeTag !== "All"){
      items = items.filter(p => (p.tags || []).includes(activeTag));
    }

    if(activeSort === "PriceLow"){
      items.sort((a,b)=> parseInt(a.price.replace(/[^\d]/g,"")) - parseInt(b.price.replace(/[^\d]/g,"")));
    }
    if(activeSort === "PriceHigh"){
      items.sort((a,b)=> parseInt(b.price.replace(/[^\d]/g,"")) - parseInt(a.price.replace(/[^\d]/g,"")));
    }

    renderProductGrid(gridId, items);
    window.AhamTrack?.track("collections_change", { tag: activeTag, sort: activeSort });
  }

  chips.forEach(ch => {
    ch.addEventListener("click", () => {
      chips.forEach(x => x.classList.remove("active"));
      ch.classList.add("active");
      activeTag = ch.getAttribute("data-filter");
      apply();
    });
  });

  if(sort){
    sort.addEventListener("change", () => {
      activeSort = sort.value;
      apply();
    });
  }

  apply();
}

/* ===== PDP: multi-image gallery + lightbox ===== */
let LB = { open:false, images:[], index:0, title:"" };

function openLightbox(){
  const lb = $("#lightbox");
  const img = $("#lbImg");
  const cap = $("#lbCaption");
  if(!lb || !img) return;

  LB.open = true;
  lb.classList.add("open");

  const url = safeImg(LB.images[LB.index]);
  img.src = url;
  img.onerror = () => img.src = window.AHAM_PLACEHOLDER;
  if(cap) cap.textContent = `${LB.title} • ${LB.index+1}/${LB.images.length}`;
}

function closeLightbox(){
  const lb = $("#lightbox");
  if(!lb) return;
  LB.open = false;
  lb.classList.remove("open");
}

function lbNext(dir){
  if(!LB.images.length) return;
  LB.index = (LB.index + dir + LB.images.length) % LB.images.length;
  openLightbox();
}

function setupPDP(){
  const holder = $("#pdp");
  if(!holder) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const p = window.AHAM_PRODUCTS.find(x => x.id === id) || window.AHAM_PRODUCTS[0];

  window.AhamTrack?.track("product_view", { id: p.id });

  const images = (p.images && p.images.length) ? p.images : [window.AHAM_PLACEHOLDER];
  const main = safeImg(images[0]);

  holder.innerHTML = `
    <div class="pdp-grid">
      <div class="gallery">
        <div class="gallery-main" id="mainImageWrap" title="Click to enlarge">
          <img id="mainImage" src="${main}" alt="${p.title}"
               onerror="this.src='${window.AHAM_PLACEHOLDER}'">
        </div>
        <div class="thumbs" id="thumbs">
          ${images.map((u,idx)=>`
            <div class="thumb ${idx===0 ? "active":""}" data-idx="${idx}">
              <img src="${safeImg(u)}" alt="${p.title} thumbnail ${idx+1}"
                   loading="lazy" onerror="this.src='${window.AHAM_PLACEHOLDER}'">
            </div>
          `).join("")}
        </div>
      </div>

      <div class="card pdp-info">
        <div class="kicker">Chanderi Sarees • AhamStree</div>
        <h1>${p.title}</h1>
        <div class="pdp-muted">${p.subtitle}</div>
        <div class="pdp-price">${p.price}</div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn primary" id="orderWhatsApp" href="${WHATSAPP_LINK()}?text=${encodeURIComponent(`Hi! I'm interested in ${p.title} (${p.price}). Please share availability.`)}" target="_blank" rel="noreferrer">
            Order on WhatsApp
          </a>
          <a class="btn white" href="collections.html">Back to Collections</a>
        </div>

        <div class="badges">
          ${(p.tags||[]).map(t=>`<span class="badge">${t}</span>`).join("")}
        </div>

        <div class="pdp-muted" style="margin-top:12px;">
          Handpicked Chanderi saree with a refined drape. Share your preferred color and occasion on WhatsApp for recommendations.
        </div>
      </div>
    </div>

    <div class="lightbox" id="lightbox" aria-hidden="true">
      <div class="lightbox-inner">
        <button class="lb-close" id="lbClose" aria-label="Close">✕</button>
        <button class="lb-btn lb-prev" id="lbPrev" aria-label="Previous">‹</button>
        <img class="lightbox-img" id="lbImg" alt="Enlarged image">
        <button class="lb-btn lb-next" id="lbNext" aria-label="Next">›</button>
        <div class="lb-caption" id="lbCaption"></div>
      </div>
    </div>
  `;

  // thumbs click -> swap main
  const mainImg = $("#mainImage");
  const thumbs = $all("#thumbs .thumb");
  thumbs.forEach(th => {
    th.addEventListener("click", () => {
      thumbs.forEach(x => x.classList.remove("active"));
      th.classList.add("active");
      const idx = parseInt(th.getAttribute("data-idx"), 10);
      mainImg.src = safeImg(images[idx]);
      mainImg.onerror = () => mainImg.src = window.AHAM_PLACEHOLDER;
      window.AhamTrack?.track("pdp_image_change", { id: p.id, index: idx });
    });
  });

  // lightbox setup
  LB.images = images;
  LB.index = 0;
  LB.title = p.title;

  $("#mainImageWrap").addEventListener("click", () => {
    // sync index with active thumb
    const active = $("#thumbs .thumb.active");
    LB.index = active ? parseInt(active.getAttribute("data-idx"),10) : 0;
    openLightbox();
  });

  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbPrev").addEventListener("click", () => lbNext(-1));
  $("#lbNext").addEventListener("click", () => lbNext(1));

  // close when clicking background
  $("#lightbox").addEventListener("click", (e) => {
    if(e.target.id === "lightbox") closeLightbox();
  });

  // keyboard
  document.addEventListener("keydown", (e) => {
    if(!LB.open) return;
    if(e.key === "Escape") closeLightbox();
    if(e.key === "ArrowLeft") lbNext(-1);
    if(e.key === "ArrowRight") lbNext(1);
  });

  // track whatsapp
  const wa = $("#orderWhatsApp");
  wa.addEventListener("click", () => {
    window.AhamTrack?.track("whatsapp_order_click", { id: p.id });
  });
}

/* ===== Contact form -> WhatsApp + reset ===== */
function setupContactForm(){
  const form = $("#contactForm");
  if(!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const name = (fd.get("name") || "").toString().trim();
    const phone = (fd.get("phone") || "").toString().trim();
    const email = (fd.get("email") || "").toString().trim();
    const msg = (fd.get("message") || "").toString().trim();

    const lines = [
      "New enquiry from AhamStree website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `Message: ${msg}`,
    ].filter(Boolean);

    const url = `${WHATSAPP_LINK()}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.AhamTrack?.track("contact_submit", { name, phone, hasEmail: !!email });

    window.open(url, "_blank");
    form.reset(); // ✅ clears after submit
  });
}

document.addEventListener("DOMContentLoaded", () => {
  mountCommon();

  // home
  if($("#featuredProducts")){
    renderProductGrid("featuredProducts", window.AHAM_PRODUCTS.slice(0, 8));
  }

  // collections
  setupCollections();

  // product
  setupPDP();

  // contact
  setupContactForm();
});
