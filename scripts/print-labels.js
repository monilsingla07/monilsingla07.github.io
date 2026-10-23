// print-labels.js: renders QR tags (payload = raw serial only, so a USB
// keyboard-emulation scanner types exactly the serial) for thermal printing.
const LAYOUTS = {
  "50x50": "50mm 50mm",
  "50x30": "50mm 30mm",
  "a4": "A4",
};
const DEFAULT_LAYOUT = "50x50";
const PROVENANCE = "Handwoven in Chanderi, India";
const SITE_URL = "www.ahamstree.com";
const FN_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/admin-manage-inventory";

const container = document.getElementById("labels");
const select = document.getElementById("layoutSelect");
const countEl = document.getElementById("count");
const pageStyle = document.createElement("style");
document.head.appendChild(pageStyle);

let serials = [];
let layout = DEFAULT_LAYOUT;
const info = new Map(); // serial -> { title, price, sareeType, care }

function normalize(s) { return String(s || "").trim().toUpperCase(); }

function readSerials() {
  const params = new URLSearchParams(location.search);
  let list = (params.get("serials") || "").split(",");
  if (!list.some((s) => s.trim())) {
    try {
      const arr = JSON.parse(sessionStorage.getItem("inventorySerials") || "[]");
      list = Array.isArray(arr) ? arr : [];
    } catch (_) { list = []; }
  }
  return list.map(normalize).filter(Boolean);
}

function money(v) {
  return "₹ " + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function div(cls, text) {
  const d = document.createElement("div");
  d.className = cls;
  if (text !== undefined && text !== null) d.textContent = text;
  return d;
}

function qrDataUrl(serial) {
  // qrcode-generator: typeNumber=0 (auto), error correction 'M'.
  // cellSize=6 → ~150-200px PNG, prints crisp at ~24mm on thermal printers.
  if (typeof window.qrcode !== "function") return null;
  const qr = window.qrcode(0, "M");
  qr.addData(serial);
  qr.make();
  return qr.createDataURL(6, 0);
}

export function renderLabels(list, lay) {
  layout = LAYOUTS[lay] ? lay : DEFAULT_LAYOUT;
  serials = list;
  select.value = layout;
  container.className = "labels layout-" + layout;
  pageStyle.textContent = "@page { size: " + LAYOUTS[layout] + "; margin: 0; }";
  container.textContent = "";
  const qrMissing = typeof window.qrcode !== "function";
  for (const serial of list) {
    const el = document.createElement("div");
    el.className = "label";
    el.dataset.serial = serial;
    const img = document.createElement("img");
    img.className = "qr";
    img.alt = serial;
    const url = qrDataUrl(serial);
    if (url) img.src = url;
    const d = info.get(serial) || {};
    const price = d.price != null ? money(d.price) : "";

    if (layout === "50x50") {
      // Rich label. Optional lines (saree type, care) are skipped entirely when absent.
      el.append(div("brand-hi", "अहम् स्त्री"), div("brand-en", "AhamStree"), div("hr"), img, div("serial", serial), div("hr"));
      if (d.sareeType) el.append(div("saree-type", d.sareeType));
      el.append(div("price", price));
      el.append(div("care", [d.care ? "Care: " + d.care : "", PROVENANCE].filter(Boolean).join(" | ")), div("url", SITE_URL));
    } else {
      // Compact (50x30 / A4): QR + serial + English brand + price + URL.
      const text = div("text");
      text.append(div("brand-en", "AhamStree"), div("serial", serial), div("price", price), div("url", SITE_URL));
      el.append(img, text);
    }
    container.appendChild(el);
  }
  countEl.textContent = list.length + (list.length === 1 ? " label" : " labels");
  const warn = document.getElementById("qrWarn");
  if (qrMissing) {
    if (!warn) {
      const w = document.createElement("div");
      w.id = "qrWarn";
      w.className = "no-print";
      w.style.cssText = "background:#c0392b;color:#fff;padding:10px 16px;font-weight:600;";
      w.textContent = "QR library failed to load — labels will print without QR codes. Refresh the page.";
      document.body.prepend(w);
    }
  } else if (warn) {
    warn.remove();
  }
}

// Best effort: needs the admin session; any failure leaves serial-only labels.
async function enrich() {
  if (!serials.length) return;
  try {
    const { supabase, SUPABASE_ANON_KEY } = await import("../assets/supabase.js");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await Promise.all(serials.map(async (serial) => {
      try {
        const res = await fetch(FN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: "get-by-serial", serial }),
        });
        if (!res.ok) return;
        const { piece } = await res.json();
        const prod = piece && piece.products;
        if (prod) {
          const eff = prod.sale_price_inr ?? prod.price_inr;
          info.set(serial, {
            title: prod.title,
            price: eff,
            sareeType: prod.saree_types?.name || "",
            care: prod.care_instructions?.text || "",
          });
        }
      } catch (_) { /* cache miss: label shows serial only */ }
    }));
    if (info.size) renderLabels(serials, layout);
  } catch (_) { /* no auth / offline: ignore */ }
}

select.addEventListener("change", () => renderLabels(serials, select.value));
document.getElementById("printBtn").addEventListener("click", () => window.print());

renderLabels(readSerials(), new URLSearchParams(location.search).get("layout"));
enrich();
