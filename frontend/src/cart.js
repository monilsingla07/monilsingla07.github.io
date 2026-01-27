const KEY = "ahamstree_cart_v1";

export function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function setCart(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(x => x.product_id === item.product_id);
  if (existing) existing.qty += item.qty;
  else cart.push(item);
  setCart(cart);
}

export function removeFromCart(product_id) {
  setCart(getCart().filter(x => x.product_id !== product_id));
}

export function clearCart() {
  setCart([]);
}

