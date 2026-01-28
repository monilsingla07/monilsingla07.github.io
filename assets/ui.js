// assets/ui.js (updated UI helpers + accessibility tweaks)
import { cartCount } from "./cart.js";

export function renderHeader(active = "") {
  const count = cartCount();

  return `
    <a class="skip-link" href="#content" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;">Skip to content</a>

    <!-- Top announcement bar -->
    <div class="topbar" role="region" aria-label="Announcement">
      <div class="container topbar-inner">
        <div class="topbar-left">Free shipping in India above ₹999 • Easy returns</div>
        <div class="topbar-right">
          <a href="about.html">About</a>
          <a href="shipping.html">Shipping</a>
          <a href="returns.html">Returns</a>
        </div>
      </div>
    </div>

    <!-- Main header -->
    <header class="header" role="banner">
      <div class="container header-inner">
        <!-- Left: Navigation -->
        <nav class="nav" role="navigation" aria-label="Main navigation">
          <a href="products.html" class="${active === "products" ? "active" : ""}" aria-current="${active === "products" ? "page" : "false"}">Sarees</a>
          <a href="products.html#new" class="" aria-current="false">New Arrivals</a>
          <a href="collections.html" class="" aria-current="false">Collections</a>
          <a href="sale.html" class="" aria-current="false">Sale</a>
          <a href="blogs.html" class="" aria-current="false">Blogs</a>
        </nav>

        <!-- Center: Logo -->
        <a class="brand" href="index.html" aria-label="Ahamstree Home">
          <img src="assets/logo.svg" alt="Ahamstree" onerror="this.style.display='none'; this.parentElement.querySelector('.brand-text').style.display='block';">
          <span class="brand-text" style="display:none;">ahamstree</span>
        </a>

        <!-- Right: Utilities -->
        <div class="utils">
          <a class="util-link" href="search.html" title="Search">Search</a>
          <a class="util-link" href="login.html" title="Account">Account</a>
          <a class="util-link ${active === "cart" ? "active" : ""}" href="cart.html" title="Cart">Cart (${count})</a>
        </div>
      </div>
    </header>

    <!-- Secondary category bar -->
    <div class="subnav" role="navigation" aria-label="Product categories">
      <div class="container subnav-inner">
        <a href="products.html#silk">Silk</a>
        <a href="products.html#cotton">Cotton</a>
        <a href="products.html#banarasi">Banarasi</a>
        <a href="products.html#kanjivaram">Kanjivaram</a>
        <a href="products.html#organza">Organza</a>
        <a href="products.html#party">Party Wear</a>
      </div>
    </div>
  `;
}

export function renderFooter() {
  return `
    <footer class="footer" role="contentinfo">
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
          <a href="stores.html">Find a Store</a>
        </div>

      </div>

      <div class="container footer-bottom">
        <div class="social">
          <a href="#" aria-label="Instagram">Instagram</a>
          <a href="#" aria-label="Facebook">Facebook</a>
          <a href="#" aria-label="Pinterest">Pinterest</a>
          <a href="#" aria-label="YouTube">YouTube</a>
          <a href="#" aria-label="WhatsApp">WhatsApp</a>
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
