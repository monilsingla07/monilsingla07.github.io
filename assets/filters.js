// assets/filters.js
import { supabase } from "./supabase.js";

/**
 * Load products with filters
 */
export async function loadFilteredProducts(filters = {}) {
  // NOTE: match the schema used by products.html / product.html
  let query = supabase
    .from('products')
    .select('id,title,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at,product_images(image_url, sort_order)')
    .eq('is_active', true);

  // Price range filter
  if (filters.minPrice) {
    query = query.gte('price_inr', filters.minPrice);
  }
  if (filters.maxPrice) {
    query = query.lte('price_inr', filters.maxPrice);
  }


  // Availability filter
  if (filters.inStockOnly) {
    // inventory_qty > 0 means in stock
    query = query.gt('inventory_qty', 0);
  }

  // Sorting
  switch (filters.sortBy) {
    case 'price_low':
      query = query.order('price_inr', { ascending: true });
      break;
    case 'price_high':
      query = query.order('price_inr', { ascending: false });
      break;
    case 'name':
      query = query.order('title', { ascending: true });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data, error } = await query;
  return { data: data || [], error };
}

/**
 * Render filter drawer
 */
export function renderFilterDrawer() {
  return `
    <div class="filter-drawer-overlay" id="filterOverlay"></div>
    <div class="filter-drawer" id="filterDrawer">
      <div class="filter-drawer-head">
        <div class="filter-drawer-title">Filters</div>
        <button class="icon-btn" id="closeFilters" type="button">×</button>
      </div>

      <div class="filter-drawer-body">
        <!-- Price Range -->
        <div class="filter-block">
          <div class="filter-title">Price Range</div>
          <div class="price-row">
            <input type="number" id="minPrice" class="input" placeholder="Min" />
            <input type="number" id="maxPrice" class="input" placeholder="Max" />
          </div>
        </div>

        <!-- Availability -->
        <div class="filter-block">
          <div class="filter-title">Availability</div>
          <label class="filter-option">
            <input type="checkbox" id="inStockOnly" />
            <span>In Stock Only</span>
          </label>
        </div>
      </div>

      <div class="filter-drawer-foot">
        <button class="btn secondary" id="clearFilters" style="flex: 1;">Clear</button>
        <button class="btn" id="applyFilters" style="flex: 1;">Apply</button>
      </div>
    </div>
  `;
}

/**
 * Initialize filter functionality
 */
export function initFilters(onApplyCallback) {
  const overlay = document.getElementById('filterOverlay');
  const drawer = document.getElementById('filterDrawer');
  const closeBtn = document.getElementById('closeFilters');
  const clearBtn = document.getElementById('clearFilters');
  const applyBtn = document.getElementById('applyFilters');
  const openBtn = document.getElementById('openFilters');

  function openDrawer() {
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function getFilters() {
    return {
      minPrice: parseInt(document.getElementById('minPrice').value) || null,
      maxPrice: parseInt(document.getElementById('maxPrice').value) || null,
      inStockOnly: document.getElementById('inStockOnly').checked,
      sortBy: document.getElementById('sortSelect')?.value || 'newest'
    };
  }

  function clearFilters() {
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('inStockOnly').checked = false;
  }

  // Event listeners
  if (openBtn) openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearFilters();
      if (onApplyCallback) {
        onApplyCallback(getFilters());
      }
      closeDrawer();
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (onApplyCallback) {
        onApplyCallback(getFilters());
      }
      closeDrawer();
    });
  }

  return { openDrawer, closeDrawer, getFilters, clearFilters };
}
