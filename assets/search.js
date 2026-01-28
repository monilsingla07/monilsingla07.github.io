// assets/search.js - simple client-side search using Supabase
import { ENV } from "./env.local.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

import { renderHeader, renderFooter } from "./assets/ui.js";
import { showCookieConsent } from "./assets/cookie-consent.js";
import { loadAnalytics } from "./assets/analytics.js";

document.getElementById("header").innerHTML = renderHeader("products");
document.getElementById("footer").innerHTML = renderFooter();
showCookieConsent(loadAnalytics);

const input = document.getElementById("search-input");
const status = document.getElementById("search-status");
const results = document.getElementById("search-results");
let timer = null;

input.addEventListener("input", (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    doSearch(e.target.value.trim());
  }, 300);
});

async function doSearch(q) {
  if (!q) {
    status.textContent = "";
    results.innerHTML = "";
    return;
  }
  status.textContent = "Searching…";
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(50);
    if (error) throw error;
    status.textContent = `${data.length} results`;
    results.innerHTML = data.map(p => `
      <a class="card" href="product.html?id=${p.id}" style="padding:10px;">
        <img src="${p.image_url || 'assets/icon-192.png'}" alt="${(p.title||'')}" style="height:140px;object-fit:cover;" />
        <div class="p">
          <div style="font-weight:900;">${escapeHtml(p.title)}</div>
          <div class="small" style="margin-top:6px;">₹${p.price_inr}</div>
        </div>
      </a>
    `).join("");
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }
}

function escapeHtml(s = "") {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
