// assets/search.js
import { supabase } from "./supabase.js";

/**
 * Search for products
 */
export async function searchProducts(query) {
  if (!query || query.trim().length < 2) {
    return { data: [], error: null };
  }

  const searchTerm = query.trim().toLowerCase();
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,fabric.ilike.%${searchTerm}%`)
    .eq('in_stock', true)
    .limit(20);

  return { data: data || [], error };
}

/**
 * Render search results
 */
export function renderSearchResults(products) {
  if (!products || products.length === 0) {
    return `
      <div style="text-align: center; padding: 40px 20px;">
        <p style="font-size: 18px; color: var(--text-light);">No products found</p>
        <p style="margin-top: 10px;">Try different keywords or browse our collections</p>
        <a href="products.html" class="btn" style="margin-top: 20px;">View All Products</a>
      </div>
    `;
  }

  return products.map(product => `
    <a href="product.html?id=${product.id}" class="card product-card">
      <img src="${product.images?.[0] || 'assets/images/placeholder.jpg'}" 
           alt="${product.name}"
           loading="lazy">
      <div class="p">
        <div class="product-title">${product.name}</div>
        <div class="product-price">₹${product.price.toLocaleString('en-IN')}</div>
      </div>
    </a>
  `).join('');
}
