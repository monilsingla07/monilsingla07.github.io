// assets/wishlist.js
import { supabase } from "./supabase.js";

/**
 * Wishlist storage
 * ---------------
 * Guest users: localStorage
 * Logged in users: Supabase table
 *
 * IMPORTANT: Table name
 * ---------------------
 * In your codebase, two table names were used:
 *   - "wishlists" (old)
 *   - "wishlist_items" (used in product.html)
 *
 * Pick ONE table name in Supabase and keep it consistent.
 * Change ONLY this constant if your table name is different.
 */
const WISHLIST_TABLE = "wishlist_items"; // <-- change to "wishlists" if that is your actual table

const LOCAL_KEY = "ahamstree_wishlist_v1";

function asId(v) {
  // Always treat IDs as strings (UUIDs are strings)
  return String(v || "").trim();
}

function getLocalIds() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.map(asId).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setLocalIds(ids) {
  const clean = (ids || []).map(asId).filter(Boolean);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(new Set(clean))));
}

function normalizeProducts(rows = []) {
  return (rows ?? []).map((p) => {
    const imgs = (p.product_images ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { ...p, image_url: imgs[0]?.image_url ?? "" };
  });
}

async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/**
 * Add product to wishlist
 */
export async function addToWishlist(productId) {
  const pid = asId(productId);
  if (!pid) return { success: false, message: "Invalid product." };

  const user = await getUser();

  // Guest user - localStorage
  if (!user) {
    const ids = getLocalIds();
    if (ids.includes(pid)) return { success: false, message: "Already in wishlist" };
    ids.push(pid);
    setLocalIds(ids);
    return { success: true, message: "Added to wishlist" };
  }

  // Logged in user - database table
  const { error } = await supabase.from(WISHLIST_TABLE).insert({
    user_id: user.id,
    product_id: pid,
  });

  if (error) {
    // 23505 = unique_violation (duplicate)
    if (error.code === "23505") return { success: false, message: "Already in wishlist" };
    return { success: false, message: error.message || "Error adding to wishlist" };
  }

  return { success: true, message: "Added to wishlist" };
}

/**
 * Remove from wishlist
 */
export async function removeFromWishlist(productId) {
  const pid = asId(productId);
  if (!pid) return { success: false };

  const user = await getUser();

  // Guest user - localStorage
  if (!user) {
    const ids = getLocalIds().filter((x) => x !== pid);
    setLocalIds(ids);
    return { success: true };
  }

  const { error } = await supabase
    .from(WISHLIST_TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", pid);

  return { success: !error };
}

/**
 * Check if product is in wishlist
 */
export async function isInWishlist(productId) {
  const pid = asId(productId);
  if (!pid) return false;

  const user = await getUser();

  // Guest user - localStorage
  if (!user) {
    return getLocalIds().includes(pid);
  }

  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", pid)
    .maybeSingle();

  if (error) return false;
  return !!data?.id;
}

/**
 * Get all wishlist products
 */
export async function getWishlist() {
  const user = await getUser();

  // Guest user
  if (!user) {
    const ids = getLocalIds();
    if (ids.length === 0) return { data: [], error: null };

    const { data, error } = await supabase
      .from("products")
      .select(
        "id,title,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at, product_images(image_url, sort_order)"
      )
      .in("id", ids)
      .eq("is_active", true);

    return { data: normalizeProducts(data || []), error };
  }

  // Logged in user: get IDs then fetch products
  const { data: rows, error: rowErr } = await supabase
    .from(WISHLIST_TABLE)
    .select("product_id")
    .eq("user_id", user.id);

  if (rowErr) return { data: [], error: rowErr };

  const ids = (rows || []).map((r) => asId(r.product_id)).filter(Boolean);
  if (ids.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,title,price_inr,sale_price_inr,inventory_qty,reserved_qty,is_active,created_at, product_images(image_url, sort_order)"
    )
    .in("id", ids)
    .eq("is_active", true);

  return { data: normalizeProducts(data || []), error };
}

/**
 * Get wishlist count
 */
export async function getWishlistCount() {
  const user = await getUser();

  // Guest
  if (!user) return getLocalIds().length;

  const { count } = await supabase
    .from(WISHLIST_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return count || 0;
}
