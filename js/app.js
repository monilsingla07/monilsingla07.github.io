const WHATSAPP = "https://wa.me/919582297550";
const INSTAGRAM = "https://www.instagram.com/ahamstree/";

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

function toggleMobileNav(){
  const nav = $("#navlinks");
  if(nav) nav.classList.toggle("open");
}

function mountCommon(){
  const ham = $("#hamburger");
  if(ham) ham.addEventListener("click", toggleMobileNav);

  $all("[data-whatsapp]").forEach(el => {
    el.addEventListener("click", () => window.open(WHATSAPP, "_blank"));
  });

  $all("[data-instagram]").forEach(el => {
    el.addEventListener("click", () => window.open(INSTAGRAM, "_blank"));
  });
}

function renderProducts(targetId, limit=8){
  const el = document.getElementById(targetId);
  if(!el || !window.AHAM_PRODUCTS) return;

  const items = window.AHAM_PRODUCTS.slice(0, limit);
  el.innerHTML = items.map(p => `
    <a class="tile product" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="img" aria-label="${p.title} image placeholder"></div>
      <div class="body">
        <div class="title">${p.title}</div>
        <div class="meta">${p.subtitle}</div>
        <div class="row">
          <div class="price">${p.price}</div>
          <div class="btn light" style="padding:8px 12px;">View</div>
        </div>
      </div>
    </a>
  `).join("");
}

function renderProductDetails(){
  const holder = $("#productDetails");
  if(!holder || !window.AHAM_PRODUCTS) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const p = window.AHAM_PRODUCTS.find(x => x.id === id) || window.AHAM_PRODUCTS[0];

  holder.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="img" style="aspect-ratio: 4/5;"></div>
    </div>
    <div class="card" style="padding:18px;">
      <div class="kicker">AhamStree • Chanderi Sarees</div>
      <h1 style="margin:12px 0 6px; color:var(--brand-1);">${p.title}</h1>
      <div style="color:var(--muted); margin-bottom:10px;">${p.subtitle}</div>
      <div style="font-weight:900; font-size:20px; margin:8px 0 14px;">${p.price}</div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn primary" href="${WHATSAPP}" target="_blank" rel="noreferrer">Order on WhatsApp</a>
        <a class="btn light" href="collections.html">Back to Collections</a>
      </div>

      <div style="margin-top:14px; color:var(--muted); line-height:1.6; font-size:14px;">
        Share your preferred color, occasion, and budget on WhatsApp to confirm availability.
      </div>
    </div>
  `;
}

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
      "New enquiry from AhamStree website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `Message: ${message}`
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/919582297550?text=${text}`, "_blank");

    // clear fields
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  mountCommon();
  renderProducts("featuredProducts", 8);
  renderProducts("collectionGrid", 12);
  renderProductDetails();
  setupContactForm();
});
