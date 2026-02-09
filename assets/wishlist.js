// assets/wishlist.js
import { supabase } from "./supabase.js";

/**
 * Add product to wishlist
 */
export async function addToWishlist(productId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Guest user - store in localStorage
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    if (!wishlist.includes(productId)) {
      wishlist.push(productId);
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
      return { success: true, message: 'Added to wishlist' };
    }
    return { success: false, message: 'Already in wishlist' };
  } else {
    // Logged in user - store in database
    const { error } = await supabase.from('wishlists').insert({
      user_id: user.id,
      product_id: productId
    });

    if (error) {
      if (error.code === '23505') { // Duplicate key
        return { success: false, message: 'Already in wishlist' };
      }
      return { success: false, message: 'Error adding to wishlist' };
    }
    return { success: true, message: 'Added to wishlist' };
  }
}

/**
 * Remove from wishlist
 */
export async function removeFromWishlist(productId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const updated = wishlist.filter(id => id !== productId);
    localStorage.setItem('wishlist', JSON.stringify(updated));
    return { success: true };
  } else {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    return { success: !error };
  }
}

/**
 * Check if product is in wishlist
 */
export async function isInWishlist(productId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    return wishlist.includes(productId);
  } else {
    const { data } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .single();

    return !!data;
  }
}

/**
 * Get all wishlist items
 */
export async function getWishlist() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const ids = JSON.parse(localStorage.getItem('wishlist') || '[]');
    if (ids.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', ids);

    return { data: data || [], error };
  } else {
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        product_id,
        products (*)
      `)
      .eq('user_id', user.id);

    const products = data ? data.map(item => item.products) : [];
    return { data: products, error };
  }
}

/**
 * Get wishlist count
 */
export async function getWishlistCount() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    return wishlist.length;
  } else {
    const { count } = await supabase
      .from('wishlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return count || 0;
  }
}
