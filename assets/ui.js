// assets/ui.js
import { cartCount } from "./cart.js";
import { supabase } from "./supabase.js";


// Keeps body content from sliding under the fixed header
let _headerOffsetInitDone = false;
function updateHeaderOffset(){
  const wrap = document.querySelector(".site-header-wrap");
  if (!wrap) return;
  const h = Math.ceil(wrap.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--header-offset", h + "px");
}
function initHeaderOffset(){
  // Always run (important if the header HTML is re-rendered, e.g. cart page)
  const run = () => {
    updateHeaderOffset();
    // run again after layout settles (fonts/images)
    requestAnimationFrame(updateHeaderOffset);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  // Add the resize listener only once
  if (_headerOffsetInitDone) return;
  _headerOffsetInitDone = true;
  window.addEventListener("resize", updateHeaderOffset);
}




export function renderHeader(active = "") {
  const count = cartCount();

  return `
    <div class="site-header-wrap">
    <!-- Top announcement bar (Taneira-like) -->
    <div class="topbar">
      <div class="container topbar-inner">
        <div class="topbar-left">Free shipping in India • Easy returns</div>
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
        <!-- Mobile header (Nalli-like) -->
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
            <img src="assets/images/ahamstree-logo.png" alt="Ahamstree">
          </a>

          <div class="header-mobile-right">
            <a id="accountLinkMobile" class="icon-link" href="login.html" aria-label="Account">
              ${iconUser()}
            </a>
            <a class="icon-link" href="wishlist.html" aria-label="Wishlist">
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
                <div class="mobile-drawer-title">Menu</div>
                <button class="icon-btn mobile-drawer-close" type="button" aria-label="Close menu">
                  ${iconClose()}
                </button>
              </div>

              <nav class="mobile-drawer-links">
                <a href="products.html">Handloom Sarees</a>
                <a href="new-arrivals.html">New Arrivals</a>
                <a href="collections.html">Collections</a>
                <a href="sale.html">Sale</a>
                <a href="blogs.html">Blogs</a>
              </nav>

              <div class="mobile-drawer-section">
                <div class="mobile-drawer-section-title">Shop by</div>
                <a href="products.html#silk">Silk</a>
                <a href="products.html#cotton">Cotton</a>
                <a href="products.html#cotton">Silk-Cotton</a>
              </div>

              <div class="mobile-drawer-section">
                <div class="mobile-drawer-section-title">Help</div>
                <a href="about.html">About</a>
                <a href="shipping.html">Shipping</a>
                <a href="returns.html">Returns</a>
                <a href="contact.html">Contact</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Left: Navigation -->
        <nav class="nav nav-desktop">
          <a href="index.html" class="site-logo" aria-label="Ahamstree home">
            <img src="assets/images/ahamstree-logo.png" alt="Ahamstree">
          </a>

          <a href="products.html" class="${active === "products" ? "active" : ""}">Handloom Sarees</a>
          <a href="new-arrivals.html" class="">New Arrivals</a>
          <a href="collections.html" class="">Collections</a>
          <a href="sale.html" class="">Sale</a>
          <a href="blogs.html" class="">Blogs</a>
        </nav>

            <!-- Right: Utilities -->
        <div class="utils utils-desktop">
          <a class="util-link" href="search.html" title="Search">Search</a>
          <a id="accountLink" class="util-link" href="login.html" title="Account">Login / Sign up</a>

          <a class="util-link ${active === "cart" ? "active" : ""}" href="cart.html" title="Cart">Cart (${count})</a>
        </div>
      </div>
    </header>

    <!-- Secondary category bar (optional, very Taneira-like feel) -->
    <div class="subnav">
      <div class="container subnav-inner">
        <a href="products.html#silk">Silk</a>
        <a href="products.html#cotton">Cotton</a>
        <a href="products.html#cotton">Silk-Cotton</a>
      </div>
    </div>
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
          <a href="help.html">Help / FAQs</a>
          <a href="track.html">Track Order</a>
        </div>

        <div>
          <div class="footer-title">Our Policies</div>
          <a href="terms.html">Terms of Use</a>
          <a href="privacy.html">Privacy Policy</a>
          <a href="cookies.html">Cookie Policy</a>
        </div>

        <div>
          <div class="footer-title">About Ahamstree</div>
          <a href="about.html">Our Story</a>
          <a href="contact.html">Contact</a>
          
        </div>

      </div>

      <div class="container footer-bottom">
        <div class="social-links">
  <a href="https://www.instagram.com/ahamstree/" target="_blank" rel="noopener"
     class="instagram" aria-label="Instagram">
    <img src="assets/images/icons/instagram.png" alt="Instagram">
  </a>

  <a href="https://www.facebook.com/" target="_blank" rel="noopener" class="facebook" aria-label="Facebook">
    <img src="assets/images/icons/facebook.png" alt="Facebook">
  </a>

  <a href="https://www.pinterest.com/" target="_blank" rel="noopener" class="pinterest" aria-label="Pinterest">
    <img src="assets/images/icons/pinterest.png" alt="Pinterest">
  </a>

  <a href="https://www.youtube.com/" target="_blank" rel="noopener" class="youtube" aria-label="YouTube">
    <img src="assets/images/icons/youtube.png" alt="YouTube">
  </a>

  <a href="https://wa.me/919582297550" target="_blank"
     class="whatsapp" aria-label="WhatsApp">
    <img src="assets/images/icons/whatsapp.png" alt="WhatsApp">
  </a>
</div>


        <div class="payments small">
          Visa • MasterCard • Rupay • UPI
        </div>

        <div class="copyright small">
          © ${new Date().getFullYear()} ahamstree.com • All rights reserved
        </div>
      </div>
    </footer>
  `;
}

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

  // Prevent double-binding for the same DOM instance.
  // (We can't use a global flag because some pages re-render the header.)
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

  // Close when a menu link is clicked
  drawer.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", close);
  });

  // Close on backdrop click
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) close();
  });

  // Close on ESC
  // Add a single ESC listener for the whole page (avoids duplicates when header re-renders)
  if (!_escListenerSet) {
    _escListenerSet = true;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobileDrawerIfOpen();
    });
  }
}

function iconHamburger() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconSearch() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="2"/>
      <path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconUser() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2"/>
    </svg>
  `;
}

function iconHeart() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 21s-7-4.4-9.4-8.8C.8 8.8 3.1 6 6 6c1.8 0 3.2 1 4 2.1C10.8 7 12.2 6 14 6c2.9 0 5.2 2.8 3.4 6.2C19 16.6 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
}

function iconBag() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 8h12l1 13H5L6 8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function iconClose() {
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

export async function hydrateHeaderAuth() {
  // Set up mobile menu interactions once (header exists on all pages)
  initMobileMenu();
  initHeaderOffset();

  const aDesktop = document.getElementById("accountLink");
  const aMobile = document.getElementById("accountLinkMobile");

  if (!aDesktop && !aMobile) return;

  const { data } = await supabase.auth.getSession();
  const loggedIn = !!data?.session?.user;

  if (aDesktop) {
    aDesktop.textContent = loggedIn ? "Account" : "Login / Sign up";
    aDesktop.href = loggedIn ? "account.html" : "login.html";
  }

  if (aMobile) {
    aMobile.href = loggedIn ? "account.html" : "login.html";
  }


  // Keep it updated automatically after login/logout without page refresh
  if (!_authHeaderListenerSet) {
    _authHeaderListenerSet = true;
    supabase.auth.onAuthStateChange(() => {
      hydrateHeaderAuth();
    });
  }
}

