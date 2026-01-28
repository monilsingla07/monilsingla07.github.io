// assets/ui.js
import { cartCount } from "./cart.js";

export function renderHeader(active = "") {
  const count = cartCount();
  return `
    <header>
      <div class="container row" style="justify-content:space-between;">
        <div>
          <div style="font-weight:900;">ahamstree</div>
          <div class="small">Sarees & ethnic wear</div>
        </div>
        <nav>
          <a href="index.html"${active==="home" ? ' style="font-weight:800;"' : ""}>Home</a>
          <a href="products.html"${active==="products" ? ' style="font-weight:800;"' : ""}>Products</a>
          <a href="cart.html"${active==="cart" ? ' style="font-weight:800;"' : ""}>Cart (${count})</a>
          <a href="login.html"${active==="login" ? ' style="font-weight:800;"' : ""}>Account</a>
        </nav>
      </div>
    </header>
  `;
}

export function renderFooter() {
  return `
    <footer>
      <div class="container">
        <div class="small">© ${new Date().getFullYear()} ahamstree.com • About • Shipping • Contact</div>
      </div>
    </footer>
  `;
}

