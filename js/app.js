const WHATSAPP = "https://wa.me/919582297550";
const INSTAGRAM = "https://www.instagram.com/ahamstree/";

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

function toggleMobileNav(){
  const nav = $("#navlinks");
  nav.classList.toggle("open");
}

function mountCommon(){
  // hamburger
  const ham = $("#hamburger");
  if(ham) ham.addEventListener("click", toggleMobileNav);

  // whatsapp buttons
  $all("[data-whatsapp]").forEach(el => {
    el.addEventListener("click", () => window.open(WHATSAPP, "_blank"));
  });

  // instagram
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
          <div class="btn primary" style="padding:8px 12px; border-radius:999px;">
            View
          </div>
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
      <div class="kicker">AhamStree • Ethnic Elegance</div>
      <h1 style="margin:12px 0 6px; color:var(--wine-900);">${p.title}</h1>
      <div style="color:var(--muted); margin-bottom:10px;">${p.subtitle}</div>
      <div style="font-weight:900; font-size:20px; margin:8px 0 14px;">${p.price}</div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn primary" href="${WHATSAPP}" target="_blank" rel="noreferrer">Order on WhatsApp</a>
        <a class="btn" href="collections.html">Back to Collections</a>
      </div>

      <div style="margin-top:14px; color:var(--muted); line-height:1.6; font-size:14px;">
        Premium fabric, classic drape, and a refined finish. Share your preferred color/occasion on WhatsApp to confirm availability.
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
      "New enquiry from website:",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `Message: ${message}`,
      "",
      "Please confirm availability / price."
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join("\n"));

    // Open WhatsApp chat to you with prefilled message
    const url = `https://wa.me/919582297550?text=${text}`;
    window.open(url, "_blank");

    // Clear the form after submit
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

