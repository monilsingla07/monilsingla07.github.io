// assets/ui.js
import { cartCount } from "./cart.js";
import { supabase } from "./supabase.js";

// ── Header offset (keeps content below fixed header) ──
let _headerOffsetInitDone = false;
function updateHeaderOffset(){
  const wrap = document.querySelector(".site-header-wrap");
  if (!wrap) return;
  const h = Math.ceil(wrap.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--header-offset", h + "px");
}
function initHeaderOffset(){
  const run = () => {
    updateHeaderOffset();
    requestAnimationFrame(updateHeaderOffset);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
  if (_headerOffsetInitDone) return;
  _headerOffsetInitDone = true;
  window.addEventListener("resize", updateHeaderOffset);
}

// ── SVG Icons ──
function iconHamburger() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
  </svg>`;
}

function iconSearch() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
  </svg>`;
}

function iconUser() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>`;
}

function iconHeart() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>`;
}

function iconBag() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>`;
}

function iconClose() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;
}

// Social SVG icons
function iconInstagram() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>`;
}

function iconFacebook() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>`;
}

function iconPinterest() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.24-5.24 1.24-5.24s-.32-.63-.32-1.57c0-1.47.85-2.57 1.91-2.57.9 0 1.34.68 1.34 1.49 0 .91-.58 2.27-.88 3.53-.25 1.05.52 1.91 1.56 1.91 1.87 0 3.13-2.4 3.13-5.25 0-2.17-1.47-3.69-3.57-3.69-2.43 0-3.86 1.82-3.86 3.71 0 .73.28 1.52.63 1.95.07.08.08.16.06.24-.06.27-.21.85-.24.97-.04.15-.13.19-.29.11-1.08-.5-1.75-2.09-1.75-3.37 0-2.74 1.99-5.26 5.74-5.26 3.01 0 5.35 2.14 5.35 5.02 0 3-1.89 5.41-4.52 5.41-.88 0-1.71-.46-2-.99l-.54 2.03c-.2.75-.72 1.7-1.07 2.27.8.25 1.65.38 2.52.38 5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
  </svg>`;
}

function iconYoutube() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
  </svg>`;
}

function iconWhatsApp() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>`;
}


export function renderHeader(active = "") {
  const count = cartCount();

  return `
    <div class="site-header-wrap">

    <!-- Top bar -->
    <div class="topbar">
      <div class="container topbar-inner">
        <div class="topbar-left">✦ Free shipping across India &nbsp;•&nbsp; Easy 7-day returns ✦</div>
        <div class="topbar-right">
          <a href="about.html">About</a>
          <a href="shipping.html">Shipping</a>
          <a href="returns.html">Returns</a>
        </div>
      </div>
    </div>

    <!-- Main header -->
    <header class="header">
      <div class="container header-inner">

        <!-- Mobile header -->
        <div class="header-mobile" aria-label="Mobile header">
          <div class="header-mobile-left">
            <button class="icon-btn mobile-menu-btn" type="button" aria-label="Open menu">
              ${iconHamburger()}
            </button>
            <a class="icon-link" href="search.html" aria-label="Search">
              ${iconSearch()}
            </a>
          </div>

          <a href="index.html" class="mobile-logo" aria-label="Ahamstree home">
            <img src="assets/images/ahamstree-logo.png" alt="Ahamstree" decoding="async">
          </a>

          <div class="header-mobile-right">
            <a id="accountLinkMobile" class="icon-link" href="login.html" aria-label="Account">
              ${iconUser()}
            </a>
            <a id="wishlistLinkMobile" class="icon-link" href="wishlist.html" aria-label="Wishlist">
              ${iconHeart()}
            </a>
            <a class="icon-link" href="cart.html" aria-label="Cart">
              <span class="icon-badge" aria-label="Cart items">${count}</span>
              ${iconBag()}
            </a>
          </div>

          <!-- Off-canvas drawer -->
          <div class="mobile-drawer" id="mobileDrawer" aria-hidden="true">
            <div class="mobile-drawer-panel" role="dialog" aria-modal="true" aria-label="Menu">
              <div class="mobile-drawer-head">
                <div class="mobile-drawer-title">AhamStree</div>
                <button class="icon-btn mobile-drawer-close" type="button" aria-label="Close menu">
                  ${iconClose()}
                </button>
              </div>

              <nav class="mobile-drawer-links">
                <a href="products.html?type=saree">Handloom Sarees</a>
                <a href="products.html?type=suit">Handloom Suits</a>
                <a href="new-arrivals.html">New Arrivals</a>
                <a href="collections.html">Collections</a>
                <a href="sale.html">Sale</a>
                <a href="blogs.html">Blogs</a>
              </nav>

              <div class="mobile-drawer-section">
                <div class="mobile-drawer-section-title">Help & Info</div>
                <a href="about.html">About Us</a>
                <a href="shipping.html">Shipping</a>
                <a href="returns.html">Returns</a>
                <a href="contact.html">Contact</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop: Left nav -->
        <nav class="nav nav-desktop">
          <a href="index.html" class="site-logo" aria-label="Ahamstree home">
            <img src="assets/images/ahamstree-logo.png" alt="Ahamstree" decoding="async">
          </a>
          <a href="products.html?type=saree" class="${(active === "products" || active === "sarees") ? "active" : ""}">Handloom Sarees</a>
          <a href="products.html?type=suit" class="${active === "suits" ? "active" : ""}">Handloom Suits</a>
          <a href="new-arrivals.html">New Arrivals</a>
          <a href="collections.html">Collections</a>
          <a href="sale.html">Sale</a>
          <a href="blogs.html">Blogs</a>
        </nav>

        <!-- Desktop: Right utilities -->
        <div class="utils utils-desktop">
          <a class="util-link" href="search.html" title="Search">Search</a>
          <a id="accountLink" class="util-link" href="login.html" title="Account">Login / Sign up</a>
          <a id="wishlistLink" class="util-link ${active === "wishlist" ? "active" : ""}" href="wishlist.html" title="Wishlist">Wishlist</a>
          <a class="util-link ${active === "cart" ? "active" : ""}" href="cart.html" title="Cart">Cart (${count})</a>
        </div>

      </div>
    </header>

    </div>
  `;
}


export function renderFooter() {
  return `
    <footer class="footer">
      <div class="container footer-grid">

        <div>
          <div class="footer-title">Quick Links</div>
          <a href="products.html">Sarees</a>
          <a href="collections.html">Collections</a>
          <a href="sale.html">Sale</a>
          <a href="blogs.html">Blogs</a>
        </div>

        <div>
          <div class="footer-title">Need Help</div>
          <a href="shipping.html">Shipping Policy</a>
          <a href="returns.html">Returns & Cancellations</a>
          <a href="help.html">FAQs</a>
          <a href="track.html">Track Order</a>
        </div>

        <div>
          <div class="footer-title">Policies</div>
          <a href="terms.html">Terms of Use</a>
          <a href="privacy.html">Privacy Policy</a>
          <a href="cookies.html">Cookie Policy</a>
        </div>

        <div>
          <div class="footer-title">About AhamStree</div>
          <a href="about.html">Our Story</a>
          <a href="contact.html">Contact Us</a>
        </div>

      </div>

      <div class="container footer-bottom">

        <div class="social-links">
          <a href="https://www.instagram.com/ahamstree/" target="_blank" rel="noopener noreferrer" class="instagram" aria-label="Instagram" title="Instagram">
            ${iconInstagram()}
          </a>
          <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" class="facebook" aria-label="Facebook" title="Facebook">
            ${iconFacebook()}
          </a>
          <a href="https://www.pinterest.com/" target="_blank" rel="noopener noreferrer" class="pinterest" aria-label="Pinterest" title="Pinterest">
            ${iconPinterest()}
          </a>
          <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" class="youtube" aria-label="YouTube" title="YouTube">
            ${iconYoutube()}
          </a>
          <a href="https://wa.me/919582297550" target="_blank" rel="noopener noreferrer" class="whatsapp" aria-label="WhatsApp" title="WhatsApp">
            ${iconWhatsApp()}
          </a>
        </div>

        <div class="payments">
          <span class="pay-chip">Visa</span>
          <span class="pay-chip">Mastercard</span>
          <span class="pay-chip">RuPay</span>
          <span class="pay-chip">UPI</span>
          <span class="pay-chip">Razorpay</span>
        </div>

        <div class="copyright small">
          © ${new Date().getFullYear()} ahamstree.com &nbsp;•&nbsp; Handcrafted with ♥ in India
        </div>

      </div>
    </footer>
  `;
}


// ── Mobile menu ──
let _authHeaderListenerSet = false;
let _escListenerSet = false;

function closeMobileDrawerIfOpen() {
  const drawer = document.getElementById("mobileDrawer");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

function initMobileMenu() {
  const drawer = document.getElementById("mobileDrawer");
  const openBtn = document.querySelector(".mobile-menu-btn");
  const closeBtn = document.querySelector(".mobile-drawer-close");
  if (!drawer || !openBtn || !closeBtn) return;
  if (drawer.dataset.menuInit === "1") return;
  drawer.dataset.menuInit = "1";

  function open() {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }
  function close() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
  drawer.addEventListener("click", (e) => { if (e.target === drawer) close(); });

  if (!_escListenerSet) {
    _escListenerSet = true;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobileDrawerIfOpen();
    });
  }
}


export async function hydrateHeaderAuth() {
  initMobileMenu();
  initHeaderOffset();

  const aDesktop = document.getElementById("accountLink");
  const aMobile  = document.getElementById("accountLinkMobile");
  const wDesktop = document.getElementById("wishlistLink");
  const wMobile  = document.getElementById("wishlistLinkMobile");

  if (!aDesktop && !aMobile) return;

  const { data } = await supabase.auth.getSession();
  const loggedIn = !!data?.session?.user;

  if (aDesktop) {
    aDesktop.textContent = loggedIn ? "Account" : "Login / Sign up";
    aDesktop.href = loggedIn ? "account.html" : "login.html";
  }
  if (aMobile) aMobile.href = loggedIn ? "account.html" : "login.html";

  const wishlistHref = loggedIn ? "account.html?view=wishlist" : "wishlist.html";
  if (wDesktop) wDesktop.href = wishlistHref;
  if (wMobile)  wMobile.href  = wishlistHref;

  if (!_authHeaderListenerSet) {
    _authHeaderListenerSet = true;
    supabase.auth.onAuthStateChange(() => hydrateHeaderAuth());
  }
}
