// assets/admin.js - admin UI (client-side). Requires assets/env.local.js to exist.
import { ENV } from "./env.local.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

import { renderHeader, renderFooter } from "./assets/ui.js";
import { showCookieConsent } from "./assets/cookie-consent.js";
import { loadAnalytics } from "./assets/analytics.js";

document.getElementById("header").innerHTML = renderHeader("home");
document.getElementById("footer").innerHTML = renderFooter();
showCookieConsent(loadAnalytics);

const FALLBACK_ADMINS = []; // add admin emails locally if you prefer

const loginBox = document.getElementById("admin-login");
const panel = document.getElementById("admin-panel");
const sendBtn = document.getElementById("admin-send");
const statusEl = document.getElementById("admin-status");
const emailInput = document.getElementById("admin-email");
const signoutBtn = document.getElementById("signout");

async function sendMagicLink(email) {
  statusEl.textContent = "Sending magic link…";
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) statusEl.textContent = "Error: " + error.message;
  else statusEl.textContent = "Magic link sent — check your email.";
}

sendBtn.onclick = () => {
  const email = emailInput.value.trim();
  if (!email) return statusEl.textContent = "Please enter an email.";
  sendMagicLink(email);
};

signoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  showLoggedOut();
};

async function init() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (session) {
    const user = session.user;
    const allowed = await isAdminUser(user);
    if (allowed) showAdmin(user);
    else {
      showLoggedOut();
      alert("This account is not authorized as admin.");
    }
  } else {
    showLoggedOut();
  }

  supabase.auth.onAuthStateChange((event, sessionData) => {
    if (sessionData?.session) {
      const user = sessionData.session.user;
      isAdminUser(user).then(allowed => {
        if (allowed) showAdmin(user);
        else {
          supabase.auth.signOut();
          alert("Not authorized.");
        }
      });
    }
  });
}

async function isAdminUser(user) {
  if (!user?.email) return false;
  try {
    const { data, error } = await supabase
      .from("admins")
      .select("email")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return true;
  } catch (err) {
    if (FALLBACK_ADMINS.includes(user.email)) return true;
  }
  return false;
}

function showLoggedOut() {
  loginBox.style.display = "block";
  panel.style.display = "none";
}

function showAdmin(user) {
  loginBox.style.display = "none";
  panel.style.display = "block";
  loadProducts();
}

const productsGrid = document.getElementById("products-grid");
const productForm = document.getElementById("product-form");
const formStatus = document.getElementById("form-status");
const deleteBtn = document.getElementById("delete-product");

async function loadProducts() {
  productsGrid.innerHTML = "Loading…";
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("id", { ascending: false });
  if (error) {
    productsGrid.innerHTML = "Error loading products: " + error.message;
    return;
  }
  if (!data || !data.length) {
    productsGrid.innerHTML = `<div class="card empty">No products found.</div>`;
    return;
  }
  productsGrid.innerHTML = data.map(p => `
    <div class="card" style="padding:12px;">
      <div style="font-weight:900;">${escapeHtml(p.title)}</div>
      <div class="small">₹${p.price_inr} • ${p.inventory_qty} in stock</div>
      <div style="height:8px;"></div>
      <div class="small" style="opacity:.9;">${escapeHtml(p.description || "").slice(0,120)}</div>
      <div style="height:8px;"></div>
      <div class="row" style="justify-content:flex-end;">
        <button class="btn" data-id="${p.id}" data-action="edit">Edit</button>
      </div>
    </div>
  `).join("");
  Array.from(productsGrid.querySelectorAll("button[data-action]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      editProduct(id);
    });
  });
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function editProduct(id) {
  formStatus.textContent = "Loading…";
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    formStatus.textContent = "Error loading product.";
    return;
  }
  const form = productForm;
  form.id.value = data.id;
  form.title.value = data.title || "";
  form.price_inr.value = data.price_inr ?? "";
  form.inventory_qty.value = data.inventory_qty ?? "";
  form.image_url.value = data.image_url || "";
  form.description.value = data.description || "";
  formStatus.textContent = "";
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formStatus.textContent = "Saving…";
  const form = e.target;
  const id = form.id.value;
  const payload = {
    title: form.title.value,
    price_inr: Number(form.price_inr.value || 0),
    inventory_qty: Number(form.inventory_qty.value || 0),
    image_url: form.image_url.value,
    description: form.description.value
  };
  try {
    if (id) {
      const { error } = await supabase.from("products").update(payload).eq("id", id);
      if (error) throw error;
      formStatus.textContent = "Updated.";
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      formStatus.textContent = "Created.";
    }
    productForm.reset();
    loadProducts();
  } catch (err) {
    formStatus.textContent = "Error: " + err.message;
  }
});

deleteBtn.addEventListener("click", async () => {
  const id = productForm.id.value;
  if (!id) return formStatus.textContent = "No product selected.";
  if (!confirm("Delete this product?")) return;
  formStatus.textContent = "Deleting…";
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) formStatus.textContent = "Error: " + error.message;
  else {
    formStatus.textContent = "Deleted.";
    productForm.reset();
    loadProducts();
  }
});

init();
