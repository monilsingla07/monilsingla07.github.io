// assets/ui.js
import { cartCount } from "./cart.js";
import { supabase } from "./supabase.js";
import { mountWelcomePopup } from "./welcome-popup.js";
import { escapeHtml } from "./safe.js";

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

function iconChevron() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`;
}

// Social SVG icons
function iconInstagram() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>`;
}

// NOTE: Facebook/Pinterest/YouTube icons were removed from here (and from
// the footer below) — the site had no real pages on any of those three
// platforms, so the icons linked out to generic platform homepages instead
// of anywhere real. Only re-add an icon once there's an actual brand page
// to link it to.

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
        <div class="topbar-left" id="topbarAnnouncement">Complimentary shipping across India</div>
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
                <div class="mobile-drawer-item">
                  <a href="products.html?type=saree">Sarees</a>
                  <button class="mobile-drawer-caret" type="button" data-cat="saree" aria-label="Show saree categories" aria-expanded="false" hidden>${iconChevron()}</button>
                  <div class="mobile-drawer-submenu" data-cat-sub="saree"></div>
                </div>
                <div class="mobile-drawer-item">
                  <a href="products.html?type=suit">Suits</a>
                  <button class="mobile-drawer-caret" type="button" data-cat="suit" aria-label="Show suit categories" aria-expanded="false" hidden>${iconChevron()}</button>
                  <div class="mobile-drawer-submenu" data-cat-sub="suit"></div>
                </div>
                <a href="new-arrivals.html">New Arrivals</a>
                <a href="collections.html">Collections</a>
                <a href="sale.html">Sale</a>
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

        <!-- Desktop: left spacer (balances the utils column so the logo sits dead-center,
             matching the two-row header pattern — logo+utils row, nav on its own row below) -->
        <div class="header-spacer" aria-hidden="true"></div>

        <!-- Desktop: Center logo -->
        <a href="index.html" class="site-logo-center" aria-label="Ahamstree home">
          <img src="assets/images/ahamstree-logo.png" alt="Ahamstree" decoding="async">
        </a>

        <!-- Desktop: Right utilities -->
        <div class="utils utils-desktop">
          <a class="util-link" href="search.html" title="Search">Search</a>
          <a id="accountLink" class="util-link" href="login.html" title="Account">Login / Sign up</a>
          <a id="wishlistLink" class="util-link ${active === "wishlist" ? "active" : ""}" href="wishlist.html" title="Wishlist">Wishlist</a>
          <a class="util-link ${active === "cart" ? "active" : ""}" href="cart.html" title="Cart">Cart (${count})</a>
        </div>

      </div>

      <!-- Desktop: nav row, full width, on its own line below the logo (Chidiyaa-style
           two-row header instead of everything crammed into one row) -->
      <div class="header-nav-row">
        <div class="container">
          <nav class="nav nav-desktop">
            <div class="nav-item has-submenu">
              <a href="products.html?type=saree" class="${(active === "products" || active === "sarees") ? "active" : ""}">Sarees</a>
              <div class="nav-submenu" data-cat="saree"></div>
            </div>
            <div class="nav-item has-submenu">
              <a href="products.html?type=suit" class="${active === "suits" ? "active" : ""}">Suits</a>
              <div class="nav-submenu" data-cat="suit"></div>
            </div>
            <a href="new-arrivals.html">New Arrivals</a>
            <a href="collections.html">Collections</a>
            <a href="sale.html">Sale</a>
          </nav>
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

        <div class="footer-monogram" style="grid-column:1/-1;">
          <div class="wordmark">AhamStree</div>
          <div class="tagline">Eternally Elegant</div>
        </div>

        <div>
          <div class="footer-title">Quick Links</div>
          <a href="products.html">Sarees</a>
          <a href="collections.html">Collections</a>
          <a href="sale.html">Sale</a>
        </div>

        <div>
          <div class="footer-title">Need Help</div>
          <a href="shipping.html">Shipping Policy</a>
          <a href="returns.html">Returns &amp; Cancellations</a>
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

 let savedScrollY = 0;

function open() {
  savedScrollY = window.scrollY;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = "100%";
}
function close() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, savedScrollY); // restore position
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


// ── Nav category dropdowns (Sarees → weave lines, Suits → weave lines) ──
// Every page calls hydrateHeaderAuth() already, so this is the one place
// that populates the header's category submenus without touching every
// page. Wrapped defensively — if this fails, the plain category links
// still work exactly as before (no dropdown, no breakage).
let _navDropdownsHydrated = false;

function initNavCarets() {
  document.querySelectorAll(".mobile-drawer-caret").forEach((btn) => {
    if (btn.dataset.caretInit === "1") return;
    btn.dataset.caretInit = "1";
    btn.addEventListener("click", () => {
      const item = btn.closest(".mobile-drawer-item");
      const sub = item && item.querySelector(".mobile-drawer-submenu");
      if (!sub) return;
      const open = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      sub.style.maxHeight = open ? sub.scrollHeight + "px" : null;
    });
  });
}

async function hydrateNavDropdowns() {
  if (_navDropdownsHydrated) return;
  _navDropdownsHydrated = true;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("category, weave_line:weave_lines!inner(id,name,slug,sort_order,is_active)")
      .eq("is_active", true)
      .eq("weave_line.is_active", true);

    if (error || !data || data.length === 0) return;

    const groups = {};
    for (const row of data) {
      const cat = row.category || "saree";
      const wl = row.weave_line;
      if (!wl) continue;
      if (!groups[cat]) groups[cat] = new Map();
      if (!groups[cat].has(wl.slug)) groups[cat].set(wl.slug, wl);
    }

    for (const cat of ["saree", "suit"]) {
      if (!groups[cat] || groups[cat].size === 0) continue;
      const rows = Array.from(groups[cat].values()).sort((a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name))
      );
      const linksHtml = rows.map(w =>
        `<a href="products.html?type=${encodeURIComponent(cat)}&weave=${encodeURIComponent(w.slug)}">${escapeHtml(w.name)}</a>`
      ).join("");

      document.querySelectorAll(`.nav-submenu[data-cat="${cat}"]`).forEach(el => { el.innerHTML = linksHtml; });
      document.querySelectorAll(`.mobile-drawer-submenu[data-cat-sub="${cat}"]`).forEach(el => { el.innerHTML = linksHtml; });
      document.querySelectorAll(`.mobile-drawer-caret[data-cat="${cat}"]`).forEach(el => { el.hidden = false; });
    }

    initNavCarets();
  } catch (_) {
    // silent — the plain "Handloom Sarees" / "Handloom Suits" links still work
  }
}

// Scroll-reveal (motion/polish pass): fades + slides each .section into
// view as the visitor scrolls to it, instead of everything just sitting
// there static. Marks elements with .reveal-init (opacity:0, see
// styles.css) only when JS actually runs and motion is allowed — with JS
// disabled, or prefers-reduced-motion set, .reveal-init is never added at
// all, so the page renders fully visible with zero animation, no
// flash-of-hidden-content risk either way. Every page already calls
// hydrateHeaderAuth() once, so wiring it in there covers the whole site
// without touching each page's own script.
function initScrollReveal() {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll(".section");
    if (!targets.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    targets.forEach((el) => {
      el.classList.add("reveal-init");
      io.observe(el);
    });
  } catch (_) {
    // Never let a motion nicety break the page — worst case, no reveal animation.
  }
}

// ── Site settings (admin-managed, Admin → Site Settings) ──
// Patches the topbar announcement text (and the matching homepage
// trust-strip line, when present) after the page's initial static render,
// same pattern as the auth-state patch below. Previously this text was
// hardcoded in two places (this file's topbar markup, and index.html's
// trust strip) with zero admin control. Fails silently on any error — the
// static fallback text baked into the markup above is what stays visible.
const SITE_SETTINGS_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/get-site-settings";
let _siteSettingsHydrated = false;

async function hydrateSiteSettings() {
  if (_siteSettingsHydrated) return;
  _siteSettingsHydrated = true;
  try {
    const res = await fetch(SITE_SETTINGS_URL);
    if (!res.ok) return;
    const { settings } = await res.json();
    if (!settings || !settings.topbar_announcement) return;

    const text = String(settings.topbar_announcement);
    const topbarEl = document.getElementById("topbarAnnouncement");
    if (topbarEl) topbarEl.textContent = text;

    // Homepage trust strip's middle item shows the identical announcement —
    // kept in sync from the same setting rather than a second hardcoded copy.
    const trustEl = document.getElementById("trustStripShipping");
    if (trustEl) trustEl.textContent = text;
  } catch (_) {
    // silent — static fallback text already in the markup stays as-is
  }
}

export async function hydrateHeaderAuth() {
  initMobileMenu();
  initHeaderOffset();

  // Site-wide welcome popup — every page calls hydrateHeaderAuth() already,
  // so this is the one place that mounts it without touching every page.
  // Wrapped defensively so a popup problem can never break header hydration.
  try { mountWelcomePopup(); } catch (_) {}

  hydrateNavDropdowns();
  hydrateSiteSettings();
  initScrollReveal();

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
