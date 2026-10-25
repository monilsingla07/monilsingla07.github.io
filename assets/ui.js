// assets/ui.js
import { cartCount } from "./cart.js";
import { supabase } from "./supabase.js";
import { mountWelcomePopup } from "./welcome-popup.js";
import { mountSignInPopup, openSignInModal } from "./signin-popup.js";
import { openSearchOverlay } from "./search-overlay.js";
import { escapeHtml, escapeAttr, safeUrl } from "./safe.js";
import { grantSignupCashIfEligible, claimOrdersByPhoneIfNeeded } from "./profile-seed.js";
import { mergeGuestWishlistIntoAccount } from "./wishlist.js";
import { trackPageview } from "./visit-tracker.js";
import { toast } from "./toast.js";
import { icon } from "./icons.js";
import { buildBreadcrumbSchema } from "./seo.js";

// ── Polite live region (UX-037) ──
// One shared role=status node for screen-reader announcements; existing
// visual toasts are untouched. window.announce(msg) writes into it and
// clears it after 3s so the same message can be announced again later.
let _announceTimer = null;
function ensureLiveRegion(){
  let el = document.getElementById("aria-live");
  if (!el && document.body) {
    el = document.createElement("div");
    el.id = "aria-live";
    el.className = "vh";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    document.body.appendChild(el);
  }
  return el;
}
window.announce = function announce(msg){
  const el = ensureLiveRegion();
  if (!el) return;
  clearTimeout(_announceTimer);
  el.textContent = "";
  // Re-set on the next tick so repeated identical messages are re-read.
  setTimeout(() => { el.textContent = String(msg ?? ""); }, 30);
  _announceTimer = setTimeout(() => { el.textContent = ""; }, 3000);
};

// ── Toast + confirm dialog ──
// Implemented in toast.js (UX-046); re-exported here so existing imports keep
// working. showToast(msg, { actionLabel, onAction, duration }) is the plain
// icon-less toast (optional action such as "Undo"); toast({ message, kind })
// is the typed version. Both announce through window.announce.
export { toast, confirmDialog } from "./toast.js";
export function showToast(msg, { actionLabel = "", onAction = null, duration = 5000 } = {}) {
  return toast({ message: msg, kind: "info", duration, actionLabel, onAction, icon: false });
}

// showCartToast({ title, image, count }) - add-to-cart confirmation (UX-025).
// Thumbnail + title with "View cart" / "Continue shopping"; dismisses itself
// after `duration`. Announces once through window.announce (no navigation).
export function showCartToast({ title = "", image = "", count = 0, duration = 5000 } = {}) {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  host.querySelectorAll(".toast-cart").forEach((n) => n.remove());
  const el = document.createElement("div");
  el.className = "toast toast-cart";
  const src = safeUrl(image, { type: "src" });
  if (src) {
    const img = document.createElement("img");
    img.className = "toast-cart-thumb";
    img.alt = "";
    img.src = src;
    el.appendChild(img);
  }
  const body = document.createElement("div");
  body.className = "toast-cart-body";
  const head = document.createElement("div");
  head.className = "toast-cart-head";
  head.innerHTML = icon("check", { size: 16 }) + " Added to cart";
  const t = document.createElement("div");
  t.className = "toast-cart-title";
  t.textContent = String(title || "");
  const actions = document.createElement("div");
  actions.className = "toast-cart-actions";
  const view = document.createElement("a");
  view.className = "toast-cart-btn";
  view.href = "cart.html";
  view.textContent = "View cart";
  const cont = document.createElement("button");
  cont.type = "button";
  cont.className = "toast-cart-btn ghost";
  cont.textContent = "Continue shopping";
  let timer = null;
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  cont.addEventListener("click", dismiss);
  actions.append(view, cont);
  body.append(head, t, actions);
  el.appendChild(body);
  host.appendChild(el);
  window.announce?.("Added " + (title || "item") + " to cart. " + count + (count === 1 ? " item" : " items") + " in cart.");
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

// Admin pages share renderHeader() but have no <main id="main"> landmark;
// drop the skip link there rather than leave it pointing nowhere.
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("main")) document.querySelector(".skip-link")?.remove();
});

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

function iconCoin() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M9.4 15.6c.5.7 1.5 1.1 2.6 1.1 1.7 0 2.9-.8 2.9-2.1 0-1.3-1.3-1.7-2.9-2.1-1.6-.4-2.9-.8-2.9-2.1 0-1.3 1.2-2.1 2.9-2.1 1.1 0 2.1.4 2.6 1.1"/>
    <path d="M12 6.3v1.1M12 16.6v1.1"/>
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
  // Stashed so hydrateNavDropdowns() can mark the right item as current —
  // it runs from hydrateHeaderAuth(), which isn't given the page marker.
  _activeNavMarker = active;

  return `
    <a class="skip-link" href="#main">Skip to main content</a>
    <div id="aria-live" role="status" aria-live="polite" aria-atomic="true" class="vh"></div>
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
            <a id="searchLinkMobile" class="icon-link" href="search.html" aria-label="Search">
              ${iconSearch()}
            </a>
          </div>

          <a href="index.html" class="mobile-logo" aria-label="Ahamstree home">
            <img src="assets/images/ahamstree-logo.png" alt="AhamStree (अहम् स्त्री)" width="639" height="204" decoding="async">
          </a>

          <div class="header-mobile-right">
            <a id="cashLinkMobile" class="cash-link" href="account.html?view=wallet" aria-label="AhamStree Cash balance" hidden>
              ${iconCoin()}<span id="cashAmountMobile">₹0</span>
            </a>
            <a id="accountLinkMobile" class="icon-link" href="login.html" aria-label="Account">
              ${iconUser()}
            </a>
            <a id="wishlistLinkMobile" class="icon-link" href="wishlist.html" aria-label="Wishlist">
              ${iconHeart()}
            </a>
            <a class="icon-link" href="cart.html" aria-label="Cart">
              <span class="icon-badge" id="cartBadgeMobile" aria-label="Cart items">${count}</span>
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

              <!-- Same fallback rule as the desktop nav above: plain links
                   until hydrateNavDropdowns() swaps in the admin-managed
                   tree, so no caret ever opens an empty submenu. -->
              <nav class="mobile-drawer-links">
                <a href="products.html?type=saree">Sarees</a>
                <a href="products.html?type=suit">Suits</a>
                <a href="new-arrivals.html">New Arrivals</a>
                <a href="collections.html">Collections</a>
                <a href="sale.html">Sale</a>
              </nav>

              <!-- Secondary account links (UX-016): the header wishlist heart is
                   hidden on phones, and Orders/Track had no mobile entry point. -->
              <div class="mobile-drawer-section mobile-drawer-account" aria-label="Your account">
                <a id="drawerAccountLink" href="login.html">Sign in</a>
                <a href="wishlist.html">Wishlist</a>
                <a href="orders.html">My Orders</a>
                <a href="track.html">Track Order</a>
              </div>

              <div class="mobile-drawer-section" id="adminSectionMobile" hidden>
                <a id="adminLinkMobile" href="admin.html">Admin dashboard</a>
              </div>

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
          <img src="assets/images/ahamstree-logo.png" alt="Ahamstree" width="639" height="204" decoding="async">
        </a>

        <!-- Desktop: Right utilities -->
        <div class="utils utils-desktop">
          <a id="adminLink" class="util-link admin-link" href="admin.html" title="Admin dashboard" hidden>Admin</a>
          <a id="searchLink" class="util-link" href="search.html" title="Search">Search</a>
          <a id="cashLink" class="util-link cash-link" href="account.html?view=wallet" title="AhamStree Cash balance" hidden>
            ${iconCoin()}<span id="cashAmountDesktop">₹0</span>
          </a>
          <a id="accountLink" class="util-link" href="login.html" title="Account">Login / Sign up</a>
          <a id="wishlistLink" class="util-link ${active === "wishlist" ? "active" : ""}" href="wishlist.html" title="Wishlist">Wishlist</a>
          <a class="util-link ${active === "cart" ? "active" : ""}" href="cart.html" title="Cart">Cart (<span id="cartCountDesktop">${count}</span>)</a>
        </div>

      </div>

      <!-- Desktop: nav row, full width, on its own line below the logo (Chidiyaa-style
           two-row header instead of everything crammed into one row) -->
      <div class="header-nav-row">
        <div class="container">
          <!-- Fallback nav, replaced by hydrateNavDropdowns() with the
               admin-managed nav_items tree. Deliberately plain links with
               no .has-submenu wrapper: an unhydrated .nav-submenu would
               open an empty hover box if the fetch is slow or fails. -->
          <nav class="nav nav-desktop">
            <a href="products.html?type=saree" class="${(active === "products" || active === "sarees") ? "active" : ""}">Sarees</a>
            <a href="products.html?type=suit" class="${active === "suits" ? "active" : ""}">Suits</a>
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

        <div class="payments" role="group" aria-label="Accepted payment methods">
          <span class="pay-chip">UPI</span>
          <span class="pay-chip">Visa</span>
          <span class="pay-chip">Mastercard</span>
          <span class="pay-chip">RuPay</span>
          <span class="pay-chip">Net banking</span>
          <span class="pay-note">Secured by Razorpay</span>
        </div>

        <div class="copyright small">
          © ${new Date().getFullYear()} ahamstree.com &nbsp;•&nbsp; Handcrafted with ${icon("heart", { size: 14, cls: "icon-inline" })} in India
        </div>

        <p class="footer-legal small">Registered: K1601, JMD Garden, Sector 33, Gurugram, Haryana 122001 &nbsp;•&nbsp; GSTIN: 06AYMPG2685D1ZF</p>

      </div>
    </footer>
  `;
}


// ── Breadcrumbs (UX-066) ──
// One breadcrumb for every page. items = [{ label, href }]; the last item is
// the current page and renders as plain text (aria-current="page") even if it
// has an href. Includes an inline BreadcrumbList JSON-LD block (id
// "ld-breadcrumb" — the same id seo.js's injectJsonLd() uses, so a page that
// also calls injectJsonLd("ld-breadcrumb", …) updates this block in place
// instead of duplicating it). Pass { jsonLd: false } to omit it.
export function renderBreadcrumbs(items = [], { jsonLd = true } = {}) {
  const list = (items || []).filter((i) => i && i.label);
  if (!list.length) return "";
  const last = list.length - 1;
  const lis = list.map((it, i) => {
    const body = (i === last || !it.href)
      ? `<span aria-current="page">${escapeHtml(it.label)}</span>`
      : `<a href="${escapeAttr(safeUrl(it.href, { type: "href" }))}">${escapeHtml(it.label)}</a>`;
    const sep = i < last ? `<span class="bc-sep" aria-hidden="true">${icon("chevron-right", { size: 12 })}</span>` : "";
    return `<li>${body}${sep}</li>`;
  }).join("");

  let ld = "";
  if (jsonLd) {
    const here = location.pathname + location.search;
    const schema = buildBreadcrumbSchema(list.map((it, i) => ({
      name: it.label,
      path: (i === last || !it.href) ? here : it.href,
    })));
    if (schema) {
      const json = JSON.stringify(schema).replace(/<\/script/gi, "<\\/script");
      ld = `<script type="application/ld+json" id="ld-breadcrumb">${json}</script>`;
    }
  }
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol class="bc-list">${lis}</ol>${ld}</nav>`;
}

// ── Admin breadcrumb + quick-switch ──────────────────────────────────────
// Every admin-*.html page is one level below admin.html (the Dashboard),
// so a plain trail is only ever "Dashboard > This Page" — on its own that
// still means going back to Dashboard every time to reach a different
// section. ADMIN_NAV mirrors admin.html's own quick-link groupings so the
// "Jump to…" dropdown always matches what's on the Dashboard.
export const ADMIN_NAV = [
  { group: "Orders & fulfillment", items: [
    { href: "admin-orders.html", label: "All Orders" },
    { href: "admin-returns.html", label: "Returns" },
    { href: "admin-payments.html", label: "Payments & Refunds" },
    { href: "admin-create-order.html", label: "Create Order" },
  ] },
  { group: "Catalog & promotions", items: [
    { href: "admin-products.html", label: "Product Catalogue" },
    { href: "admin-inventory.html", label: "Inventory" },
    { href: "admin-reviews.html", label: "Reviews" },
    { href: "admin-print-agent.html", label: "Print Queue" },
    { href: "admin-pos.html", label: "POS" },
    { href: "admin-coupons.html", label: "Coupon Manager" },
    { href: "admin-issue-coupon.html", label: "Issue Coupon" },
    { href: "admin-wallet.html", label: "AhamStree Cash" },
  ] },
  { group: "Finance", items: [
    { href: "admin-expenses.html", label: "Expenses & Invoices" },
  ] },
  { group: "Site content", items: [
    { href: "admin-hero-testimonials.html", label: "Hero & Testimonials" },
    { href: "admin-popup.html", label: "Popup Manager" },
    { href: "admin-reels.html", label: "Reel Manager" },
    { href: "admin-policies.html", label: "Policy Pages" },
    { href: "admin-blog.html", label: "Blog Manager" },
  ] },
  { group: "Store & customers", items: [
    { href: "admin-settings.html", label: "Site Settings" },
    { href: "admin-users.html", label: "Registered Users" },
    { href: "admin-visitors.html", label: "Visitors" },
  ] },
];

// currentLabel: the current page's own label (as it appears in ADMIN_NAV),
// or omit it on admin.html itself. Call hydrateAdminBreadcrumb() once after
// inserting this markup so the dropdown opens/closes correctly.
export function renderAdminBreadcrumb(currentLabel = "") {
  const trail = [{ label: "Dashboard", href: "admin.html" }];
  if (currentLabel) trail.push({ label: currentLabel });

  const groupsHtml = ADMIN_NAV.map((g) => `
    <div class="admin-qs-group">
      <div class="admin-qs-group-title">${escapeHtml(g.group)}</div>
      ${g.items.map((it) => `<a href="${escapeAttr(it.href)}"${it.label === currentLabel ? ' class="current" aria-current="page"' : ""}>${escapeHtml(it.label)}</a>`).join("")}
    </div>
  `).join("");

  return `
    <div class="admin-bc-bar">
      ${renderBreadcrumbs(trail, { jsonLd: false })}
      <details class="admin-qs" id="adminQuickSwitch">
        <summary class="admin-qs-trigger">Jump to… ${icon("chevron-down", { size: 12 })}</summary>
        <div class="admin-qs-menu">${groupsHtml}</div>
      </details>
    </div>
  `;
}

export function hydrateAdminBreadcrumb() {
  const details = document.getElementById("adminQuickSwitch");
  if (!details || details.dataset.hydrated === "1") return;
  details.dataset.hydrated = "1";
  document.addEventListener("click", (e) => {
    if (details.open && !details.contains(e.target)) details.removeAttribute("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && details.open) { details.removeAttribute("open"); details.querySelector("summary").focus(); }
  });
}

// ── Mobile menu ──
let _authHeaderListenerSet = false;
let _escListenerSet = false;

// Set by initMobileMenu() to its real close() — which restores focus and
// removes the Tab-trap listener, neither of which this bare fallback can do
// since it has no access to that closure's state. The Escape-key handler
// below needs a way to close the drawer properly even though it's declared
// at module scope, outside initMobileMenu().
let _drawerClose = null;

function closeMobileDrawerIfOpen() {
  if (_drawerClose) { _drawerClose(); return; }
  // Fallback in case this ever fires before initMobileMenu() has run —
  // matches the old behavior (no focus restore, since there's nothing to
  // restore to yet).
  const drawer = document.getElementById("mobileDrawer");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

// Elements a keyboard user can land on, in DOM/tab order — used to trap Tab
// inside the open drawer panel instead of letting it wander onto the (still
// visually hidden behind the overlay) page content underneath.
function getFocusable(container) {
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ).filter(el => el.offsetParent !== null || el === document.activeElement);
}

function initMobileMenu() {
  const drawer = document.getElementById("mobileDrawer");
  const panel = drawer?.querySelector(".mobile-drawer-panel");
  const openBtn = document.querySelector(".mobile-menu-btn");
  const closeBtn = document.querySelector(".mobile-drawer-close");
  if (!drawer || !panel || !openBtn || !closeBtn) return;
  if (drawer.dataset.menuInit === "1") return;
  drawer.dataset.menuInit = "1";

 let savedScrollY = 0;
 let lastFocused = null;

function trapTab(e) {
  if (e.key !== "Tab") return;
  const focusable = getFocusable(panel);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function open() {
  savedScrollY = window.scrollY;
  lastFocused = document.activeElement;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = "100%";
  // Move focus into the dialog (its own close button, per the standard
  // dialog pattern) rather than leaving it on the trigger button behind an
  // overlay it can no longer see.
  closeBtn.focus();
  panel.addEventListener("keydown", trapTab);
}
function close() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, savedScrollY); // restore position
  panel.removeEventListener("keydown", trapTab);
  // Return focus to whatever had it before opening (normally the hamburger
  // button) instead of leaving it lost on the now-hidden close button.
  (lastFocused && document.contains(lastFocused) ? lastFocused : openBtn).focus();
}

  _drawerClose = close;

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
let _activeNavMarker = "";

// Tablet-width submenu toggles (UX-055). The buttons are only displayed
// between 821px and 1100px (see styles.css); on wider screens the hover and
// focus-within behaviour is unchanged. One delegated handler, bound once.
let _navToggleBound = false;
function closeNavSubmenus(except) {
  document.querySelectorAll(".nav-item.open").forEach((item) => {
    if (item === except) return;
    item.classList.remove("open");
    item.querySelector(".nav-sub-toggle")?.setAttribute("aria-expanded", "false");
  });
}
function initNavToggles() {
  if (_navToggleBound) return;
  _navToggleBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".nav-sub-toggle");
    if (!btn) {
      if (!e.target.closest?.(".nav-item")) closeNavSubmenus(null);
      return;
    }
    const item = btn.closest(".nav-item");
    if (!item) return;
    const open = !item.classList.contains("open");
    closeNavSubmenus(item);
    item.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const openItem = document.querySelector(".nav-item.open");
    if (!openItem) return;
    const btn = openItem.querySelector(".nav-sub-toggle");
    closeNavSubmenus(null);
    btn?.focus();
  });
}

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

// Site is a classic multi-page app (every navigation is a full reload), so
// without caching this Supabase query re-runs on EVERY single page view.
// The menu changes rarely (admin action), so it's safe to reuse a recent
// result from sessionStorage instead of re-querying on every pageview —
// cuts one network round trip + DB query per navigation. TTL keeps it fresh
// enough that an admin change shows up within minutes.
const NAV_CACHE_KEY = "ahamstree_nav_v2";
const NAV_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

// nav_items rows describe WHAT to link to, not the URL itself, so an admin
// never types a query string by hand and a future link type only needs a
// case here. Anything unrecognised falls back to "#" rather than emitting a
// broken or unsafe href.
function navHref(item) {
  const val = item.link_value || "";
  switch (item.link_type) {
    case "category":
      return `products.html?type=${encodeURIComponent(val)}`;
    case "weave":
      return item.link_category
        ? `products.html?type=${encodeURIComponent(item.link_category)}&weave=${encodeURIComponent(val)}`
        : `products.html?weave=${encodeURIComponent(val)}`;
    case "fabric":
      return item.link_category
        ? `products.html?type=${encodeURIComponent(item.link_category)}&fabric=${encodeURIComponent(val)}`
        : `products.html?fabric=${encodeURIComponent(val)}`;
    case "collection":
      return `products.html?collection=${encodeURIComponent(val)}`;
    case "page":
      // Site-relative page name only — never an absolute or protocol URL.
      return /^[a-z0-9._-]+\.html(\?.*)?$/i.test(val) ? val : "#";
    case "url":
      // safeUrl, not safeHref — the caller escapes this for the attribute,
      // and safeHref would escape it a second time, turning "&max=3000"
      // into "&amp;max=3000" and breaking the query string.
      return safeUrl(val, { type: "href" });
    default:
      return "#";
  }
}

// Which nav item should read as "current" for a given page marker. Keeps the
// old behaviour where products/sarees both highlight Sarees.
function navIsActive(item, active) {
  if (!active) return false;
  if (item.link_type === "category") {
    if (item.link_value === "saree") return active === "products" || active === "sarees";
    if (item.link_value === "suit") return active === "suits";
  }
  if (item.link_type === "page" && item.link_value) {
    return item.link_value.replace(/\.html.*$/i, "") === active;
  }
  return false;
}

function buildNavHtml(tree, active) {
  const desktop = tree.map(top => {
    const href = escapeAttr(navHref(top));
    const cls = navIsActive(top, active) ? ' class="active"' : "";
    const label = escapeHtml(top.label);
    if (!top.children.length) return `<a href="${href}"${cls}>${label}</a>`;
    const sub = top.children
      .map(c => `<a href="${escapeAttr(navHref(c))}">${escapeHtml(c.label)}</a>`)
      .join("");
    return `
      <div class="nav-item has-submenu">
        <a href="${href}"${cls}>${label}</a>
        <button class="nav-sub-toggle" type="button" aria-expanded="false" aria-label="Show ${escapeAttr(top.label)} links">${iconChevron()}</button>
        <div class="nav-submenu">${sub}</div>
      </div>`;
  }).join("");

  const mobile = tree.map(top => {
    const href = escapeAttr(navHref(top));
    const label = escapeHtml(top.label);
    if (!top.children.length) return `<a href="${href}">${label}</a>`;
    const sub = top.children
      .map(c => `<a href="${escapeAttr(navHref(c))}">${escapeHtml(c.label)}</a>`)
      .join("");
    return `
      <div class="mobile-drawer-item">
        <a href="${href}">${label}</a>
        <button class="mobile-drawer-caret" type="button" aria-label="Show ${escapeAttr(top.label)} links" aria-expanded="false">${iconChevron()}</button>
        <div class="mobile-drawer-submenu">${sub}</div>
      </div>`;
  }).join("");

  return { desktop, mobile };
}

function applyNavHtml(html) {
  if (!html || !html.desktop) return;
  document.querySelectorAll("nav.nav-desktop").forEach(el => { el.innerHTML = html.desktop; });
  document.querySelectorAll(".mobile-drawer-links").forEach(el => { el.innerHTML = html.mobile; });
  initNavCarets();
  initNavToggles();
}

function readNavCache(active) {
  try {
    const raw = sessionStorage.getItem(NAV_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (Date.now() - parsed.ts) > NAV_CACHE_TTL_MS) return null;
    // The tree is cached, not the HTML — the "active" highlight differs per
    // page, so the markup has to be rebuilt even on a cache hit.
    return parsed.tree ? buildNavHtml(parsed.tree, active) : null;
  } catch (_) {
    return null; // storage unavailable (private mode, etc.) — fall through to network
  }
}

function writeNavCache(tree) {
  try {
    sessionStorage.setItem(NAV_CACHE_KEY, JSON.stringify({ ts: Date.now(), tree }));
  } catch (_) {
    // storage full/unavailable — non-fatal, just means next pageview re-fetches
  }
}

async function hydrateNavDropdowns(active) {
  if (_navDropdownsHydrated) return;
  _navDropdownsHydrated = true;
  try {
    const cached = readNavCache(active);
    if (cached) {
      applyNavHtml(cached);
      return;
    }

    const { data, error } = await supabase
      .from("nav_items")
      .select("id,parent_id,label,link_type,link_value,link_category,sort_order")
      .order("sort_order");

    // No rows (or a failed fetch) leaves the hardcoded fallback markup in
    // renderHeader() exactly as it is — the header is never left empty.
    if (error || !data || data.length === 0) return;

    const tops = data.filter(r => !r.parent_id);
    if (!tops.length) return;
    const tree = tops.map(t => ({
      ...t,
      children: data
        .filter(c => c.parent_id === t.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }));

    applyNavHtml(buildNavHtml(tree, active));
    writeNavCache(tree);
  } catch (_) {
    // silent — the fallback nav rendered by renderHeader() still works
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

// Same reasoning as the nav-dropdown cache above: this Edge Function call
// otherwise re-fires on every pageview across the whole multi-page site.
// Settings only change via an admin action, so a short-lived sessionStorage
// cache is safe and saves a network round trip on every navigation.
const SETTINGS_CACHE_KEY = "ahamstree_site_settings_v1";
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function applySiteSettings(settings) {
  if (!settings || !settings.topbar_announcement) return;
  const text = String(settings.topbar_announcement);
  const topbarEl = document.getElementById("topbarAnnouncement");
  if (topbarEl) topbarEl.textContent = text;
  const trustEl = document.getElementById("trustStripShipping");
  if (trustEl) trustEl.textContent = text;
}

function readSettingsCache() {
  try {
    const raw = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (Date.now() - parsed.ts) > SETTINGS_CACHE_TTL_MS) return null;
    return parsed.settings || null;
  } catch (_) {
    return null;
  }
}

function writeSettingsCache(settings) {
  try {
    sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ ts: Date.now(), settings }));
  } catch (_) {
    // non-fatal
  }
}

async function hydrateSiteSettings() {
  if (_siteSettingsHydrated) return;
  _siteSettingsHydrated = true;
  try {
    const cached = readSettingsCache();
    if (cached) {
      applySiteSettings(cached);
      return;
    }

    const res = await fetch(SITE_SETTINGS_URL);
    if (!res.ok) return;
    const { settings } = await res.json();
    if (!settings || !settings.topbar_announcement) return;
    writeSettingsCache(settings);
    applySiteSettings(settings);
  } catch (_) {
    // silent — static fallback text already in the markup stays as-is
  }
}

// ── AhamStree Cash balance (header pill, both mobile + desktop) ──
// Same short-lived sessionStorage cache pattern as the nav/settings data
// above — the balance rarely changes mid-session, so this avoids a wallet
// query on every single-page-app-style page navigation on this classic
// multi-page site.
const CASH_CACHE_KEY = "ahamstree_cash_balance_v1";
const CASH_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min
const CASH_WALLET_SEEN_KEY = "ahamstree_cash_wallet_seen";

// Landing on the wallet page by any means (the header pill, a bookmark, the
// back button) counts as "seen" — stops the header pill's pulse from then
// on, same as clicking the pill itself does (see applyCashBalance below).
try {
  if (/\/account\.html$/.test(location.pathname) && new URLSearchParams(location.search).get("view") === "wallet") {
    localStorage.setItem(CASH_WALLET_SEEN_KEY, "1");
  }
} catch (_) {}

function readCashCache(userId) {
  try {
    const raw = sessionStorage.getItem(CASH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId || (Date.now() - parsed.ts) > CASH_CACHE_TTL_MS) return null;
    return parsed.balance;
  } catch (_) {
    return null;
  }
}

function writeCashCache(userId, balance) {
  try {
    sessionStorage.setItem(CASH_CACHE_KEY, JSON.stringify({ ts: Date.now(), userId, balance }));
  } catch (_) {
    // non-fatal — next pageview just re-queries
  }
}

function applyCashBalance(balance) {
  const amtText = "₹" + Number(balance || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const mobileLink  = document.getElementById("cashLinkMobile");
  const desktopLink = document.getElementById("cashLink");
  const mobileAmt   = document.getElementById("cashAmountMobile");
  const desktopAmt  = document.getElementById("cashAmountDesktop");
  if (mobileAmt)  mobileAmt.textContent = amtText;
  if (desktopAmt) desktopAmt.textContent = amtText;

  let alreadySeen = false;
  try { alreadySeen = localStorage.getItem(CASH_WALLET_SEEN_KEY) === "1"; } catch (_) {}
  const shouldPulse = !alreadySeen && Number(balance || 0) > 0;

  [mobileLink, desktopLink].forEach((el) => {
    if (!el) return;
    el.hidden = false;
    el.classList.toggle("pulse", shouldPulse);
    if (el.dataset.cashClickBound !== "1") {
      el.dataset.cashClickBound = "1";
      el.addEventListener("click", () => {
        try { localStorage.setItem(CASH_WALLET_SEEN_KEY, "1"); } catch (_) {}
      });
    }
  });
}

function hideCashLinks() {
  const mobileLink  = document.getElementById("cashLinkMobile");
  const desktopLink = document.getElementById("cashLink");
  if (mobileLink)  mobileLink.hidden = true;
  if (desktopLink) desktopLink.hidden = true;
}

async function hydrateCashBalance(userId) {
  const mobileLink  = document.getElementById("cashLinkMobile");
  const desktopLink = document.getElementById("cashLink");
  if (!mobileLink && !desktopLink) return;

  const cached = readCashCache(userId);
  if (cached !== null) {
    applyCashBalance(cached);
    return;
  }

  try {
    const { data, error } = await supabase
      .from("wallet_accounts")
      .select("balance_inr")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return; // fail silent — the header pill just stays hidden
    const balance = data?.balance_inr || 0;
    writeCashCache(userId, balance);
    applyCashBalance(balance);
  } catch (_) {
    // non-fatal — header pill just stays hidden
  }
}

async function showAdminLinkIfAdmin(email) {
  const adminDesktop = document.getElementById("adminLink");
  const adminMobileSection = document.getElementById("adminSectionMobile");
  if (!adminDesktop && !adminMobileSection) return;

  let isAdmin = false;
  if (email) {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("email")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      isAdmin = !error && !!data;
    } catch (_) {
      isAdmin = false; // fail closed — never show the link on an uncertain check
    }
  }

  if (adminDesktop) adminDesktop.hidden = !isAdmin;
  if (adminMobileSection) adminMobileSection.hidden = !isAdmin;
}

// ── Cart badge (header) ──
// renderHeader() bakes the count into the HTML string once, at whatever
// moment the header happens to render — it was never refreshed again after
// that, so adding/removing/changing quantity on the SAME page (no full
// reload) left the header's number stale until the visitor next navigated.
// cart.js's setCart() (the single choke point every cart mutation goes
// through) dispatches "ahamstree:cart-updated" on every change; this listens
// for it once and patches both header locations directly, no re-render of
// the whole header needed. Also re-run from hydrateHeaderAuth() itself so a
// login/logout event (which re-runs that function) can't leave a stale
// count behind either, even though auth doesn't touch the cart itself.
// Mobile drawer account entry (UX-016): "Hi, {firstName}" when signed in,
// "Sign in" otherwise. Display only; no auth behaviour changes.
async function hydrateDrawerAccount(user) {
  const el = document.getElementById("drawerAccountLink");
  if (!el) return;
  if (!user) {
    el.textContent = "Sign in";
    el.href = "login.html";
    return;
  }
  el.href = "account.html";
  el.textContent = "Account";
  const first = (n) => String(n || "").trim().split(/s+/)[0];
  const meta = user.user_metadata || {};
  let name = first(meta.full_name || meta.name);
  if (!name) {
    try {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      name = first(prof?.full_name);
    } catch (_) {}
  }
  if (name) el.textContent = "Hi, " + name;
}

let _cartBadgeListenerSet = false;

function refreshCartBadge() {
  const count = cartCount();
  const mobileBadge = document.getElementById("cartBadgeMobile");
  const desktopCount = document.getElementById("cartCountDesktop");
  if (mobileBadge) mobileBadge.textContent = count;
  if (desktopCount) desktopCount.textContent = count;
}

// ── Floating WhatsApp help CTA (UX-049) ──
// The homepage hard-codes its own copy; this adds the same control to the
// PDP, cart, checkout and payment-result pages. Same number as the footer and
// success-page links. Plain wa.me link with a per-page pre-filled message.
const HELP_WA_NUMBER = "919582297550";
const HELP_PAGES = new Set(["product", "cart", "checkout", "success"]);

function helpMessage(page) {
  const here = location.origin + location.pathname + location.search;
  if (page === "product") return "Hi AhamStree team, I have a question about this saree: " + here;
  if (page === "cart") return "Hi AhamStree team, I need help with my cart.";
  if (page === "checkout") return "Hi AhamStree team, I need help with checkout.";
  // success.html: the visible panel decides the wording.
  const shown = (id) => { const el = document.getElementById(id); return !!el && el.style.display !== "none"; };
  const params = new URLSearchParams(location.search);
  const ref = String(params.get("order_id") || "").slice(0, 40);
  const refTxt = ref ? " (order " + ref + ")" : "";
  if (shown("failedState")) return "Hi AhamStree team, my payment did not go through" + refTxt + ". I need help with my order.";
  if (shown("pendingState")) return "Hi AhamStree team, my payment is still processing" + refTxt + ". I need help with my order.";
  if (shown("cancelledState")) return "Hi AhamStree team, I cancelled the payment" + refTxt + " and need help with my order.";
  if (shown("paidState")) return "Hi AhamStree team, I have a question about my order" + refTxt + ".";
  return "Hi AhamStree team, I need help with my order" + refTxt + ".";
}

function mountHelpCta() {
  if (document.querySelector(".floating-cta")) return;
  const page = (location.pathname.split("/").pop() || "").replace(/.html$/i, "");
  if (!HELP_PAGES.has(page)) return;
  const a = document.createElement("a");
  a.className = "floating-cta";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", "Need help? Chat on WhatsApp");
  a.innerHTML = '<span class="floating-cta-icon" aria-hidden="true">' + iconWhatsApp() + '</span><span class="floating-cta-label">Need help?</span>';
  const setHref = () => { a.href = "https://wa.me/" + HELP_WA_NUMBER + "?text=" + encodeURIComponent(helpMessage(page)); };
  setHref();
  // Re-read at activation time: success.html swaps panels after verification.
  ["pointerdown", "focus", "click"].forEach((ev) => a.addEventListener(ev, setHref));
  document.body.appendChild(a);
}

// checkout.html is header-less and only imports this module for announce(),
// so mount on DOM-ready here instead of from hydrateHeaderAuth().
if (typeof document !== "undefined") {
  const mountSafe = () => { try { mountHelpCta(); } catch (_) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountSafe, { once: true });
  else mountSafe();
}

export async function hydrateHeaderAuth() {
  initMobileMenu();
  initHeaderOffset();

  refreshCartBadge();
  if (!_cartBadgeListenerSet) {
    _cartBadgeListenerSet = true;
    window.addEventListener("ahamstree:cart-updated", refreshCartBadge);
    // Cross-tab: cart.js writes straight to localStorage, which only ever
    // fires "storage" in OTHER tabs — so if the cart is changed in tab A,
    // tab B's header badge needs this to catch up (mirrors the same-purpose
    // listener cart.html already has for its own item list).
    window.addEventListener("storage", (e) => {
      if (e.key === "ahamstree_cart_v1") refreshCartBadge();
    });
  }

  // Site-wide welcome popup — every page calls hydrateHeaderAuth() already,
  // so this is the one place that mounts it without touching every page.
  // Wrapped defensively so a popup problem can never break header hydration.
  try { mountWelcomePopup(); } catch (_) {}

  // Sign-in nudge popup — same wiring, but only ever shows to logged-out
  // visitors (mountSignInPopup checks the session itself). Also skipped
  // on its own, defensively.
  try { mountSignInPopup(); } catch (_) {}

  // Pageview tracking for Admin → Visitor Analytics. See visit-tracker.js
  // for why this lives here instead of on every page individually.
  try { trackPageview(); } catch (_) {}

  hydrateNavDropdowns(_activeNavMarker);
  hydrateSiteSettings();
  initScrollReveal();

  const { data } = await supabase.auth.getSession();
  const loggedIn = !!data?.session?.user;

  // AhamStree Cash — grant the one-time welcome bonus. hydrateHeaderAuth()
  // runs on every page and re-fires on every auth state change (see the
  // onAuthStateChange subscription below), so this one call site covers
  // every sign-in path site-wide (WhatsApp OTP or Google, via login.html or
  // the sign-in popup) without duplicating the call into each of them.
  // grantSignupCashIfEligible is itself idempotent server-side, so calling
  // it again on every page load / every auth event is harmless.
  if (loggedIn) grantSignupCashIfEligible(data.session);

  // Same reasoning as above: link any POS / guest web orders placed under
  // this account's own verified phone number. See claimOrdersByPhoneIfNeeded
  // for why every login (not just signup) is the right call site.
  if (loggedIn) claimOrdersByPhoneIfNeeded(data.session);

  // Same reasoning as above: pull in anything the visitor wishlisted as a
  // guest, on whichever page/auth event first sees them logged in.
  if (loggedIn) mergeGuestWishlistIntoAccount();

  // AhamStree Cash header pill — only ever shown to logged-in visitors.
  if (loggedIn) hydrateCashBalance(data.session.user.id);
  else hideCashLinks();

  const aDesktop = document.getElementById("accountLink");
  const aMobile  = document.getElementById("accountLinkMobile");
  const wDesktop = document.getElementById("wishlistLink");
  const wMobile  = document.getElementById("wishlistLinkMobile");

  if (!aDesktop && !aMobile) return;

  if (aDesktop) {
    aDesktop.textContent = loggedIn ? "Account" : "Login / Sign up";
    aDesktop.href = loggedIn ? "account.html" : "login.html";
  }
  if (aMobile) aMobile.href = loggedIn ? "account.html" : "login.html";

  // Open the sign-in modal in place instead of navigating to login.html —
  // href stays pointed at login.html regardless (middle-click/open-in-new-
  // tab, JS-disabled, right-click "copy link" all keep working), this only
  // intercepts a plain left-click. Bound once per element via a dataset
  // flag since hydrateHeaderAuth() re-runs on every auth state change.
  // Only intercepts while logged OUT — once logged in the link's href/text
  // above already point at account.html and should navigate normally.
  [aDesktop, aMobile].forEach((el) => {
    if (!el || el.dataset.loginModalBound === "1") return;
    el.dataset.loginModalBound = "1";
    el.addEventListener("click", (e) => {
      if (el.getAttribute("href") === "login.html" && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        openSignInModal();
      }
    });
  });

  // Search — was a full-page navigation to search.html with nothing on it
  // until you typed; now opens an in-place dropdown with live results
  // (search.html itself still exists, reachable via the overlay's "View
  // all results" link, direct URL, or Enter in the overlay's input).
  // Always intercepts regardless of login state (unlike the account link
  // above) and is only ever rendered once per page, but bound the same
  // guarded way for consistency.
  const searchDesktop = document.getElementById("searchLink");
  const searchMobile  = document.getElementById("searchLinkMobile");
  [searchDesktop, searchMobile].forEach((el) => {
    if (!el || el.dataset.searchOverlayBound === "1") return;
    el.dataset.searchOverlayBound = "1";
    el.addEventListener("click", (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        openSearchOverlay();
      }
    });
  });

  hydrateDrawerAccount(loggedIn ? data.session.user : null);

  const wishlistHref = loggedIn ? "account.html?view=wishlist" : "wishlist.html";
  if (wDesktop) wDesktop.href = wishlistHref;
  if (wMobile)  wMobile.href  = wishlistHref;

  // Admin link — previously the only way into /admin.html was typing the
  // URL by hand. Same admin_users lookup admin.html itself already does on
  // load (a single indexed-email-column row, cheap enough to run on every
  // page without caching) — this is purely a UX convenience for showing/
  // hiding the link, NOT a security boundary; every admin-* page still does
  // its own real check before showing anything sensitive.
  showAdminLinkIfAdmin(loggedIn ? data.session.user.email : null);

  if (!_authHeaderListenerSet) {
    _authHeaderListenerSet = true;
    supabase.auth.onAuthStateChange(() => hydrateHeaderAuth());
  }
}


// ── Cookie consent banner (UX-057) ──
// Non-blocking bar. Choice lives in localStorage.cookieConsent ("accept" |
// "decline"). Google Analytics is only loaded after "accept", via
// window.loadAnalytics() from assets/analytics.js (also auto-run there on later
// visits). The markup is pre-rendered into each page's static HTML by
// scripts/build-shell.mjs (<!--shell:cookie-->); renderCookieBanner() wires it,
// and creates it if a page (e.g. header-less checkout) doesn't have it.
export function cookieBannerHtml() {
  return `<div id="cookieConsent" class="cookie-banner" role="region" aria-label="Cookie consent" hidden>
  <div class="cookie-banner__text">
    We use cookies for analytics so we can improve the site. See our
    <a href="/cookies.html">cookie policy</a>.
  </div>
  <div class="cookie-banner__actions">
    <button type="button" class="btn secondary" data-consent="decline">Decline</button>
    <button type="button" class="btn" data-consent="accept">Accept</button>
  </div>
</div>`;
}

function readCookieConsent() {
  try { return localStorage.getItem("cookieConsent"); } catch (_) { return null; }
}

export function renderCookieBanner() {
  if (typeof document === "undefined" || !document.body) return;
  if (/^(admin|print-)/.test(location.pathname.split("/").pop() || "")) return;
  let el = document.getElementById("cookieConsent");
  const consent = readCookieConsent();
  if (consent === "accept" || consent === "decline") {
    if (el) el.hidden = true;
    return;
  }
  if (!el) {
    document.body.insertAdjacentHTML("beforeend", cookieBannerHtml());
    el = document.getElementById("cookieConsent");
  }
  if (!el.dataset.wired) {
    el.dataset.wired = "1";
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-consent]");
      if (!btn) return;
      const choice = btn.dataset.consent === "accept" ? "accept" : "decline";
      try { localStorage.setItem("cookieConsent", choice); } catch (_) {}
      el.hidden = true;
      document.dispatchEvent(new CustomEvent("cookieconsentchange", { detail: choice }));
      if (choice === "accept") { try { window.loadAnalytics?.(); } catch (_) {} }
      window.announce?.(choice === "accept" ? "Analytics cookies accepted." : "Analytics cookies declined.");
    });
  }
  el.hidden = false;
}
window.renderCookieBanner = renderCookieBanner;

if (typeof document !== "undefined" && document.body !== undefined) {
  const mountCookie = () => { try { renderCookieBanner(); } catch (_) {} };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountCookie, { once: true });
  else mountCookie();
}
