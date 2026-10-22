// print-labels.js: renders QR tags (payload = raw serial only, so a USB
// keyboard-emulation scanner types exactly the serial) for thermal printing.
const LAYOUTS = {
  "50x30": "50mm 30mm",
  "50x50": "50mm 50mm",
  "a4": "A4",
};
const FN_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/admin-manage-inventory";

const container = document.getElementById("labels");
const select = document.getElementById("layoutSelect");
const countEl = document.getElementById("count");
const pageStyle = document.createElement("style");
document.head.appendChild(pageStyle);

let serials = [];
let layout = "50x30";
const info = new Map(); // serial -> { title, price }

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
  return "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function renderLabels(list, lay) {
  layout = LAYOUTS[lay] ? lay : "50x30";
  serials = list;
  select.value = layout;
  container.className = "labels layout-" + layout;
  pageStyle.textContent = "@page { size: " + LAYOUTS[layout] + "; margin: 0; }";
  container.textContent = "";
  for (const serial of list) {
    const el = document.createElement("div");
    el.className = "label";
    el.dataset.serial = serial;
    const canvas = document.createElement("canvas");
    const text = document.createElement("div");
    text.className = "text";
    const s = document.createElement("div");
    s.className = "serial";
    s.textContent = serial;
    const t = document.createElement("div");
    t.className = "title";
    const p = document.createElement("div");
    p.className = "price";
    const d = info.get(serial);
    if (d) {
      t.textContent = d.title || "";
      t.title = d.title || "";
      p.textContent = d.price != null ? money(d.price) : "";
    }
    text.append(s, t, p);
    el.append(canvas, text);
    container.appendChild(el);
    if (window.QRCode) {
      window.QRCode.toCanvas(canvas, serial, { margin: 0, width: 160, errorCorrectionLevel: "M" }, () => {});
    }
  }
  countEl.textContent = list.length + (list.length === 1 ? " label" : " labels");
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
        if (prod) info.set(serial, { title: prod.title, price: prod.price_inr });
      } catch (_) { /* cache miss: label shows serial only */ }
    }));
    if (info.size) renderLabels(serials, layout);
  } catch (_) { /* no auth / offline: ignore */ }
}

select.addEventListener("change", () => renderLabels(serials, select.value));
document.getElementById("printBtn").addEventListener("click", () => window.print());

renderLabels(readSerials(), new URLSearchParams(location.search).get("layout"));
enrich();
