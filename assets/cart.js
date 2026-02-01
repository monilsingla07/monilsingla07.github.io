// assets/cart.js
const KEY = "ahamstree_cart_v1";

export function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? []; }
  catch { return []; }
}

export function setCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(product, qty = 1) {
  const cart = getCart();

  // Prefer sale price if present, else regular price
  const unitPrice =
    product.sale_price_inr != null && product.sale_price_inr !== ""
      ? Number(product.sale_price_inr)
      : Number(product.price_inr);

  // Guard: if price is missing/invalid, store 0 but also keep debugging info
  const safePrice = Number.isFinite(unitPrice) ? unitPrice : 0;

  const found = cart.find(i => i.product_id === product.id);

  const next = found
    ? cart.map(i => i.product_id === product.id ? { ...i, qty: i.qty + qty } : i)
    : [...cart, {
        product_id: product.id,
        title: product.title,
        price_inr: safePrice,            // what checkout UI uses
        image_url: product.image_url || "",
        qty
      }];

  setCart(next);
  return next;
}


export function removeFromCart(product_id) {
  const next = getCart().filter(i => i.product_id !== product_id);
  setCart(next);
  return next;
}

export function updateQty(product_id, qty) {
  const q = Math.max(1, Math.min(99, Number(qty || 1)));
  const next = getCart().map(i => i.product_id === product_id ? { ...i, qty: q } : i);
  setCart(next);
  return next;
}

export function clearCart() {
  setCart([]);
}

export function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

