import { renderHeader, renderFooter, hydrateHeaderAuth, renderAdminBreadcrumb, hydrateAdminBreadcrumb } from "../assets/ui.js";
import { supabase, SUPABASE_ANON_KEY } from "../assets/supabase.js";
import { escapeHtml, escapeAttr, safeSrc } from "../assets/safe.js";
import { enqueueInvoice } from "../assets/print-queue.js";
import { createPrintEngine } from "../assets/print-engine.js";

document.getElementById("header").innerHTML = renderHeader("admin");
document.getElementById("footer").innerHTML = renderFooter();
hydrateHeaderAuth();
document.getElementById("adminBreadcrumb").innerHTML = renderAdminBreadcrumb("POS");
hydrateAdminBreadcrumb();

const BASE = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/";
const INV_FN = BASE + "admin-manage-inventory";
const POS_FN = BASE + "pos-checkout";
const USERS_FN = BASE + "admin-users";

const $ = (id) => document.getElementById(id);
const money = (v) => "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

class HttpError extends Error {
  constructor(status, body) { super((body && body.error) || "HTTP " + status); this.status = status; this.body = body || {}; }
}

async function authedFetch(url, body) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, json);
  return json;
}

// ───────────── state ─────────────
let bill = [];            // [{id, serial, title, price, thumb, bad}]
let customer = null;      // looked-up account {user_id, name, phone, address}
let done = null;          // {order_id, invoice_url, total} after a successful charge
let charging = false;
let scanning = false;

let toastTimer;
function toast(msg, kind = "", ms = 4500) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ───────────── exhibition billing printer ─────────────
// Scoped to "invoice" jobs only — this tablet never claims a QR-label job
// meant for the home print station (admin-print-agent.html), even though
// both read the same print_jobs table. See assets/print-engine.js.
const printEngine = createPrintEngine({
  kinds: ["invoice"],
  getPaperWidth: () => { try { return parseInt(localStorage.getItem("ahamstreePaperWidth"), 10) || 384; } catch (_) { return 384; } },
  onState: (st) => {
    $("posPrinterName").textContent = st.deviceName || "no device";
    const pill = $("posPrinterPill");
    const pst = st.status === "connected" || st.status === "printing" ? "connected" : st.status === "reconnecting" ? "reconnecting" : "disconnected";
    pill.dataset.state = pst;
    pill.textContent = pst === "connected" ? "Connected" : pst === "reconnecting" ? "Reconnecting…" : "Disconnected";
    const btn = $("posPrinterBtn");
    if (pst === "connected") { btn.textContent = "Disconnect printer"; btn.disabled = false; }
    else if (pst === "reconnecting") { btn.textContent = "Reconnecting…"; btn.disabled = true; }
    else { btn.textContent = st.hasDefault ? "Reconnect printer" : "Connect printer"; btn.disabled = false; }
  },
  onToast: (msg, ms) => toast(msg, "", ms),
});

function wirePrinterWidget() {
  $("posPrinterBtn").addEventListener("click", async () => {
    try {
      if (printEngine.isConnected()) { printEngine.disconnect(); return; }
      if (localStorage.getItem("defaultPrinter")) await printEngine.reconnectDefault();
      else await printEngine.connectBluetooth();
    } catch (e) {
      if (e.name !== "NotFoundError") toast(e.message || String(e), "err", 7000);
    }
  });
}

function flashLast(text, ok) {
  const el = $("lastSerial");
  el.textContent = text;
  el.classList.remove("ok", "err");
  void el.offsetWidth; // restart animation
  el.classList.add(ok ? "ok" : "err");
}

function shake() {
  const s = $("scanStrip");
  s.classList.remove("shake");
  void s.offsetWidth;
  s.classList.add("shake");
}

// ───────────── totals ─────────────
const subtotal = () => bill.reduce((a, l) => a + l.price, 0);
function discountAmt() {
  const sub = subtotal();
  const v = Number($("discValue").value) || 0;
  if (v <= 0) return 0;
  const d = $("discType").value === "percent" ? Math.round(sub * Math.min(v, 100) / 100) : v;
  return Math.min(d, sub);
}
const total = () => Math.max(0, subtotal() - discountAmt());

function render() {
  const body = $("billBody");
  if (!bill.length) {
    body.innerHTML = '<div class="bill-empty">No items yet — scan a QR label to start.</div>';
  } else {
    body.innerHTML = bill.map((l) => {
      const src = safeSrc(l.thumb || "");
      const img = src && /^https?:/i.test(src)
        ? '<img class="thumb" alt="" src="' + escapeAttr(src) + '">'
        : '<div class="thumb-empty"></div>';
      return '<div class="bill-line' + (l.bad ? " bad" : "") + '" data-serial="' + escapeAttr(l.serial) + '">' +
        img +
        '<div><div>' + escapeHtml(l.title) + '</div><div class="mono">' + escapeHtml(l.serial) + "</div>" +
        (l.bad ? '<div class="line-err">' + escapeHtml(l.bad) + "</div>" : "") + "</div>" +
        "<div>" + money(l.price) + "</div>" +
        '<button class="rm" type="button" aria-label="Remove ' + escapeAttr(l.serial) + '" data-rm="' + escapeAttr(l.serial) + '"' +
        (done ? " disabled" : "") + ">✕</button></div>";
    }).join("");
  }
  $("subtotalAmt").textContent = money(subtotal());
  $("discAmt").textContent = "−" + money(discountAmt());
  $("totalAmt").textContent = done ? money(done.total) : money(total());
  const post = !!done;
  $("btnCharge").style.display = post ? "none" : "";
  $("btnPrint").style.display = post ? "" : "none";
  $("btnNew").style.display = post ? "" : "none";
  $("btnCharge").disabled = !bill.length || charging;
  $("btnCharge").textContent = charging ? "Charging…" : "Charge (F9)";
  $("btnPrint").disabled = !(done && done.invoice_url);
  $("btnPrint").title = done && !done.invoice_url ? "Receipt could not be generated; open it from Orders." : "";
}

// ───────────── scanning ─────────────
function focusScan() { $("scan-input").focus(); }

async function handleScan(raw) {
  const serial = String(raw || "").trim().toUpperCase();
  if (!serial || scanning) return;
  if (done) { toast("Sale complete — press New sale to start another.", "err"); return; }
  if (bill.some((l) => l.serial === serial)) {
    flashLast(serial, false);
    shake();
    toast(serial + " is already in this bill", "err");
    return;
  }
  scanning = true;
  try {
    const { piece } = await authedFetch(INV_FN, { action: "get-by-serial", serial });
    const real = String(piece.serial || serial).toUpperCase();
    if (bill.some((l) => l.serial === real)) {
      flashLast(real, false); shake(); toast(real + " is already in this bill", "err"); return;
    }
    if (piece.status !== "in_stock") {
      flashLast(real, false);
      if (piece.status === "sold") {
        const when = piece.sold_at ? new Date(piece.sold_at).toLocaleDateString("en-IN") : "earlier";
        toast("Already sold on " + when + " via " + (piece.sold_via || "unknown"), "err");
      } else {
        toast(real + " is not available (" + piece.status + ")", "err");
      }
      return;
    }
    const prod = piece.products || {};
    const price = prod.sale_price_inr ?? prod.price_inr ?? 0;
    const imgs = (prod.product_images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const thumb = piece.photo_url || imgs[0]?.image_url || "";
    bill.push({ id: piece.id, serial: real, title: prod.title || "Item", price: Number(price) || 0, thumb, bad: "" });
    flashLast(real, true);
    render();
  } catch (e) {
    flashLast(serial, false);
    if (e.status === 404) toast("Not found: " + serial, "err");
    else toast("Scan failed: " + (e.message || e), "err");
  } finally {
    scanning = false;
  }
}

// ───────────── customer ─────────────
const custMode = () => document.querySelector('input[name="custMode"]:checked').value;
const payMethod = () => document.querySelector('input[name="payMethod"]:checked').value;

function syncCustUi() {
  const m = custMode();
  $("custFields").style.display = m === "anon" ? "none" : "grid";
  $("btnLookup").style.display = m === "lookup" ? "" : "none";
  $("custName").style.display = m === "walkin" ? "" : "none";
  $("custFound").style.display = m === "lookup" && customer ? "" : "none";
  // A phone is only on hand once a lookup has matched someone or the
  // cashier is keying in a walk-in — that's the only time there's a real
  // number to ask consent for.
  $("custOptInRow").style.display = (m === "walkin" || (m === "lookup" && customer)) ? "flex" : "none";
}

function resetCustomerLookup(msg = "") {
  customer = null;
  $("custFound").innerHTML = "";
  $("custMsg").textContent = msg;
  syncCustUi();
}

async function lookupCustomer() {
  const phone = $("custPhone").value.replace(/\D/g, "");
  if (phone.length !== 10) { $("custMsg").textContent = "Enter a 10-digit phone number."; return; }
  $("custMsg").textContent = "Searching…";
  try {
    const r = await authedFetch(USERS_FN, { action: "list", search: phone, per_page: 5 });
    const u = (r.users || []).find((x) => String(x.phone || "").replace(/\D/g, "").endsWith(phone));
    if (!u) { resetCustomerLookup("No account with this number — use Walk-in."); return; }
    customer = {
      user_id: u.id,
      name: u.full_name || "",
      phone,
      address: [u.city, u.state].filter(Boolean).join(", "),
    };
    $("custFound").innerHTML = "<strong>" + escapeHtml(customer.name || "(no name)") + "</strong>" +
      (customer.address ? "<br>" + escapeHtml(customer.address) : "") + "<br>" + escapeHtml(phone);
    $("custMsg").textContent = "";
    syncCustUi();
  } catch (e) {
    resetCustomerLookup("Lookup failed: " + (e.message || e));
  }
}

function customerPayload() {
  const m = custMode();
  const marketing_opt_in = $("custOptIn").checked;
  if (m === "lookup" && customer) return { user_id: customer.user_id, phone: customer.phone, name: customer.name, address: customer.address, marketing_opt_in };
  if (m === "walkin") {
    const phone = $("custPhone").value.replace(/\D/g, "");
    const name = $("custName").value.trim();
    // marketing_opt_in has nothing to attach to without a phone — omit it
    // rather than send a consent flag pos-checkout would just discard.
    if (phone || name) return phone ? { phone, name, marketing_opt_in } : { phone, name };
  }
  return null;
}

// ───────────── charge ─────────────
async function charge() {
  if (done || charging || !bill.length) return;
  if (custMode() === "lookup" && !customer) { toast("Find the customer first, or choose Walk-in / Anonymous.", "err"); return; }
  const d = Number($("discValue").value) || 0;
  const payload = {
    serials: bill.map((l) => l.serial),
    customer: customerPayload(),
    payment_method: payMethod(),
    discount: d > 0 ? { type: $("discType").value, value: d } : null,
  };
  bill.forEach((l) => (l.bad = ""));
  charging = true; render();
  try {
    const r = await authedFetch(POS_FN, payload);
    done = { order_id: r.order_id, invoice_url: r.invoice_url || null, total: r.total_inr ?? total() };
    toast("Sale complete — order #" + r.order_id, "ok", 7000);
    // Also send the invoice to the shop printer (browser invoice button stays as a fallback).
    enqueueInvoice(r.order_id)
      .then(() => toast("Sale complete — order #" + r.order_id + ". Invoice queued. Printing now.", "ok", 6000))
      .catch((e) => toast("Sale complete, but could not queue invoice: " + (e.message || e), "err", 7000));
  } catch (e) {
    const details = Array.isArray(e.body?.details) ? e.body.details : [];
    if (e.status === 409 && e.body?.error === "pieces_not_in_stock") {
      details.forEach((x) => {
        const l = bill.find((b) => b.serial === String(x.serial || "").toUpperCase());
        if (l) l.bad = x.order_id ? "Already sold on order #" + x.order_id : "Not in stock (" + (x.status || "unavailable") + ")";
      });
      toast("Some items are no longer in stock — remove them to continue.", "err", 7000);
    } else if (e.status === 404 && e.body?.error === "serials_not_found") {
      details.forEach((x) => {
        const l = bill.find((b) => b.serial === String(typeof x === "string" ? x : x.serial || "").toUpperCase());
        if (l) l.bad = "Serial not found";
      });
      toast("Some serials were not found — remove them to continue.", "err", 7000);
    } else if (e.status === 400) {
      toast("Invalid sale: " + (e.body?.error || "check the bill, discount and payment"), "err", 7000);
    } else {
      // Surface the server's error details so a 500 doesn't just read as "Failed to complete sale".
      const detail = e.body?.details ? " — " + (typeof e.body.details === "string" ? e.body.details : JSON.stringify(e.body.details)) : "";
      toast("Charge failed: " + (e.message || e) + detail, "err", 10000);
      console.error("pos-checkout failure", e.status, e.body);
    }
  } finally {
    charging = false; render();
  }
}

// ───────────── reset / confirm ─────────────
function newSale() {
  bill = []; done = null; customer = null;
  $("discValue").value = "";
  $("discType").value = "flat";
  document.querySelector('input[name="custMode"][value="anon"]').checked = true;
  document.querySelector('input[name="payMethod"][value="cash"]').checked = true;
  $("custPhone").value = ""; $("custName").value = ""; $("custMsg").textContent = ""; $("custFound").innerHTML = ""; $("custOptIn").checked = false;
  $("lastSerial").textContent = "—"; $("lastSerial").classList.remove("ok", "err");
  syncCustUi(); render(); focusScan();
}

const modalOpen = () => $("confirmModal").classList.contains("open");
function openConfirm() { $("confirmModal").classList.add("open"); $("confirmYes").focus(); }
function closeConfirm() { $("confirmModal").classList.remove("open"); focusScan(); }

// ───────────── search / browse in-stock pieces ─────────────
let searchTimer = null;
let searchSeq = 0;

function closeSearch() { $("searchResults").hidden = true; $("searchResults").innerHTML = ""; }

async function runSearch(query) {
  const seq = ++searchSeq;
  const resEl = $("searchResults");
  resEl.hidden = false;
  resEl.innerHTML = '<div class="search-row search-note">Searching…</div>';
  try {
    // Pull in-stock pieces matching the query (serial OR title via two parallel calls).
    const q = String(query || "").trim();
    const body = { action: "list", status: "in_stock", limit: 20 };
    if (q) body.serial_contains = q;
    const r = await authedFetch(INV_FN, body);
    if (seq !== searchSeq) return;
    let rows = r.rows || [];
    // If the user typed non-serial-looking text (letters only), also search by product title
    if (q && /^[A-Za-z\s]+$/.test(q) && rows.length < 20) {
      try {
        const byTitle = await authedFetch(INV_FN, { action: "list", status: "in_stock", limit: 20 });
        if (seq !== searchSeq) return;
        const titleMatch = (byTitle.rows || []).filter((p) =>
          (p.products?.title || "").toLowerCase().includes(q.toLowerCase()) &&
          !rows.some((r2) => r2.id === p.id)
        );
        rows = rows.concat(titleMatch).slice(0, 20);
      } catch (_) { /* ignore secondary search failure */ }
    }
    renderSearchResults(rows);
  } catch (e) {
    if (seq !== searchSeq) return;
    resEl.innerHTML = '<div class="search-row search-note err">Search failed: ' + (e.message || e) + '</div>';
  }
}

function renderSearchResults(rows) {
  const resEl = $("searchResults");
  if (!rows.length) { resEl.innerHTML = '<div class="search-row search-note">No in-stock pieces match.</div>'; return; }
  resEl.innerHTML = rows.map((p) => {
    const prod = p.products || {};
    const price = prod.sale_price_inr ?? prod.price_inr ?? 0;
    const title = prod.title || "Item";
    const sareeType = prod.saree_types?.name || "";
    return '<a href="#" class="search-row" data-serial="' + p.serial + '">' +
      '<span class="s-ser">' + p.serial + '</span>' +
      '<span class="s-title">' + title + (sareeType ? ' — ' + sareeType : '') + '</span>' +
      '<span class="s-price">₹ ' + Number(price).toLocaleString("en-IN") + '</span>' +
    '</a>';
  }).join("");
}

// ───────────── wiring ─────────────
function wire() {
  const scanEl = $("scan-input");
  scanEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = scanEl.value;
    scanEl.value = "";
    closeSearch();
    handleScan(v);
  });
  // Live search as you type (debounced). 2+ chars = search; empty = close.
  scanEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const v = scanEl.value.trim();
    if (!v) { closeSearch(); return; }
    if (v.length < 2) return;
    searchTimer = setTimeout(() => runSearch(v), 220);
  });
  $("browseBtn").addEventListener("click", () => { runSearch(""); scanEl.focus(); });
  $("searchResults").addEventListener("click", (e) => {
    e.preventDefault();
    const row = e.target.closest("[data-serial]");
    if (!row) return;
    const serial = row.getAttribute("data-serial");
    scanEl.value = "";
    closeSearch();
    handleScan(serial);
  });
  document.addEventListener("click", (e) => {
    if (!$("searchResults").hidden && !e.target.closest("#searchResults, #scan-input, #browseBtn")) closeSearch();
  });

  $("billBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (!b || done) return;
    bill = bill.filter((l) => l.serial !== b.getAttribute("data-rm"));
    render(); focusScan();
  });
  $("discType").addEventListener("change", render);
  $("discValue").addEventListener("input", render);
  document.querySelectorAll('input[name="custMode"]').forEach((r) => r.addEventListener("change", () => {
    resetCustomerLookup(); syncCustUi();
    if (custMode() !== "anon") $("custPhone").focus();
  }));
  $("btnLookup").addEventListener("click", lookupCustomer);
  $("custPhone").addEventListener("input", () => { if (customer) resetCustomerLookup(); });
  $("custPhone").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (custMode() === "lookup") lookupCustomer(); else focusScan(); }
  });
  $("btnCharge").addEventListener("click", charge);
  $("btnPrint").addEventListener("click", () => {
    const u = done && done.invoice_url;
    if (u && /^https?:/i.test(u)) window.open(u, "_blank", "noopener");
  });
  $("btnNew").addEventListener("click", newSale);
  $("confirmYes").addEventListener("click", () => { $("confirmModal").classList.remove("open"); newSale(); });
  $("confirmNo").addEventListener("click", closeConfirm);

  // refocus scan input after interacting with non-text controls
  document.querySelectorAll("#pos input[type=radio], #pos button").forEach((el) =>
    el.addEventListener("click", () => { if (!modalOpen() && el.name !== "custMode") setTimeout(focusScan, 0); }));

  document.addEventListener("keydown", (e) => {
    if (e.key === "F2") { e.preventDefault(); if (custMode() === "anon") { document.querySelector('input[name="custMode"][value="lookup"]').checked = true; syncCustUi(); } $("custPhone").focus(); return; }
    if (e.key === "F9") { e.preventDefault(); charge(); return; }
    if (e.key === "Escape") {
      if (modalOpen()) { closeConfirm(); return; }
      if (bill.length && !done) openConfirm();
      return;
    }
    if (modalOpen()) return;
    const t = e.target;
    const inField = t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    if (!inField && !e.ctrlKey && !e.metaKey && !e.altKey) focusScan();
  });
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!modalOpen() && !(t && /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(t.tagName))) focusScan();
  });
}

// ───────────── boot ─────────────
function gateError(title, message) {
  const g = $("loadingState");
  g.style.display = "block";
  $("pos").style.display = "none";
  g.innerHTML = '<div class="pos-gate"><h3 style="margin:0;">' + escapeHtml(title) + '</h3><div class="small">' + escapeHtml(message) + "</div></div>";
}

(async function init() {
  try {
    const sess = await supabase.auth.getSession();
    if (sess.error) return gateError("Auth Error", sess.error.message);
    if (!sess.data || !sess.data.session) { window.location.href = "login.html"; return; }
    const email = (sess.data.session.user.email || "").toLowerCase();
    const adm = await supabase.from("admin_users").select("email").eq("email", email).maybeSingle();
    if (adm.error) return gateError("Error", adm.error.message);
    if (!adm.data) return gateError("Access Denied", "Your account does not have admin access.");
    $("loadingState").style.display = "none";
    $("pos").style.display = "block";
    wire(); syncCustUi(); render(); focusScan();
    wirePrinterWidget(); printEngine.init();
  } catch (e) {
    gateError("Error", e.message || String(e));
  }
})();
