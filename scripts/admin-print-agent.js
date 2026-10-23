// admin-print-agent.js: the ONE device paired to the Seznik thermal printer.
// Picks queued jobs from print_jobs (Realtime + polling), renders them to a
// canvas, converts to ESC/POS raster (GS v 0) and writes over Bluetooth.
import { renderHeader, renderFooter, hydrateHeaderAuth } from "../assets/ui.js";
import { supabase, SUPABASE_ANON_KEY } from "../assets/supabase.js";
import { escapeHtml } from "../assets/safe.js";
import { queueCall } from "../assets/print-queue.js";

document.getElementById("header").innerHTML = renderHeader("admin");
document.getElementById("footer").innerHTML = renderFooter();
hydrateHeaderAuth();

const BASE = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/";
const INV_FN = BASE + "admin-manage-inventory";
const INVOICE_FN = BASE + "admin-generate-invoice";
const PDFJS_VER = "3.11.174";
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.worker.min.js";

const LABEL_W = 384;                       // print head is 384 dots wide (~48mm @ 203dpi)
const DPI = 203;
const mmToDots = (mm) => Math.round(mm * DPI / 25.4);
function readNumSetting(key, def, min, max) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    if (Number.isFinite(v)) return Math.min(max, Math.max(min, v));
  } catch (_) {}
  return def;
}
const getTopOffsetMm = () => readNumSetting("labelOffset", 0, -25, 25);
const getTrailingFeedMm = () => readNumSetting("trailingFeed", 15, 0, 50);
// 50x50mm labels: thermal printer firmware leaves ~4mm unprintable at top AND bottom
// of each physical label, so the usable area is ~42mm. Rendering at 336 dots (42mm @ 203 dpi)
// instead of 400 means content fits without content being clipped off the bottom.
const LABEL_H = { "50x50": 336, "50x30": 240 };
const BLE_CHUNK = 150;                     // under typical 180-byte BLE payloads
const BAND_ROWS = 65535;                   // one GS v 0 command per raster (multiple bands made the printer insert line spacing between them)
const PROVENANCE = "Handwoven in Chanderi, India";
const SITE_URL = "www.ahamstree.com";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// BLE services to request (hex numbers = 16-bit UUIDs). Seznik-specific UUIDs are a guess.
const BLE_SERVICES = [
  0xff00, 0x18f0, 0xffe0, 0xfee7, 0xae30,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "000018f0-0000-1000-8000-00805f9b34fb",
];
const PREFERRED_ORDER = ["e7810a71-73ae-499d-8c15-faa9aef0c3f2", "000018f0", "0000ff00", "0000ffe0", "49535343", "0000fee7", "0000ae30"];

// ───────────── state ─────────────
const agentId = (() => {
  try {
    let v = localStorage.getItem("ahamstreePrintAgentId");
    if (!v) { v = crypto.randomUUID(); localStorage.setItem("ahamstreePrintAgentId", v); }
    return v;
  } catch (_) { return crypto.randomUUID(); }
})();
let transport = null;        // { name, write(Uint8Array), close() }
let reconnecting = false;    // auto-reconnect loop active
let reconnectTimer = null;
let reconnectBusy = false;
let manualDisconnect = false;
let printing = false;
let processing = false;
let wakeLock = null;
const pending = [];          // queued job rows waiting for this agent
const seen = new Set();      // job ids already scheduled/handled
const infoCache = new Map(); // serial -> label info

// ───────────── ui helpers ─────────────
let toastTimer;
function toast(msg, ms = 4500) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function setState() {
  const st = printing ? "printing" : transport ? "connected" : reconnecting ? "reconnecting" : "disconnected";
  $("statusCard").dataset.state = st;
  $("stateText").textContent = st[0].toUpperCase() + st.slice(1);
  $("deviceName").textContent = transport ? transport.name : "no device";
  const dp = loadDefault();
  $("defaultName").textContent = dp ? dp.deviceName : "none";
  const pill = $("defaultPill");
  const pst = transport ? "connected" : reconnecting ? "reconnecting" : "disconnected";
  pill.dataset.state = pst;
  pill.textContent = pst === "connected" ? "Connected" : pst === "reconnecting" ? "Reconnecting…" : "Disconnected";
  $("changePrinter").hidden = !dp;
  $("btnDisconnect").hidden = !transport;
  // Hide the generic Connect buttons when a default exists; the big Reconnect button takes over.
  $("btnConnect").hidden = !!transport || !!dp;
  $("btnSerial").hidden = !!transport || !!dp || !("serial" in navigator);
  const canReconnect = !transport && !!dp;
  $("btnReconnect").hidden = !canReconnect;
  if (dp) $("btnReconnectName").textContent = dp.deviceName || "printer";
  $("queueInfo").textContent = pending.length + " queued";
}

function showGateError(title, message) {
  $("loadingState").style.display = "block";
  $("agent").style.display = "none";
  $("loadingState").innerHTML =
    '<div class="admin-gate"><h3 style="margin:0;">' + escapeHtml(title) + '</h3><div class="small" style="opacity:.8;">' +
    escapeHtml(message) + '</div><a class="btn secondary" href="index.html" style="margin-top:8px;">Go to store</a></div>';
}

// ───────────── fonts ─────────────
let hindiOk = false;
async function loadHindiFont() {
  try {
    await Promise.race([
      document.fonts.load('bold 10pt "Noto Sans Devanagari"', "अहम् स्त्री"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("font timeout")), 6000)),
    ]);
    hindiOk = document.fonts.check('bold 10pt "Noto Sans Devanagari"', "अहम् स्त्री");
  } catch (_) { hindiOk = false; }
  return hindiOk;
}

// ───────────── canvas rendering: labels ─────────────
function getCanvas(w, h) {
  const c = $("renderCanvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#000"; ctx.strokeStyle = "#000";
  ctx.textBaseline = "alphabetic";
  return { c, ctx };
}

function money(v) { return "₹ " + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

// Draw QR modules directly (crisp, no image decode). Returns drawn size.
function drawQr(ctx, text, x, y, size) {
  if (typeof window.qrcode !== "function") {
    ctx.strokeRect(x, y, size, size);
    ctx.font = "16px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("NO QR", x + size / 2, y + size / 2);
    return;
  }
  const qr = window.qrcode(0, "M");
  qr.addData(text); qr.make();
  const n = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(size / n));
  const full = cell * n;
  const ox = x + Math.floor((size - full) / 2), oy = y + Math.floor((size - full) / 2);
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    if (qr.isDark(r, col)) ctx.fillRect(ox + col * cell, oy + r * cell, cell, cell);
  }
}

// Shrink font until text fits maxW.
function fitText(ctx, text, x, y, maxW, px, weight = "", family = "Outfit, DM Sans, sans-serif") {
  let size = px;
  for (; size > 8; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`.trim();
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.fillText(text, x, y);
}

export function renderLabelCanvas(serial, layout, d = {}, topPx = mmToDots(getTopOffsetMm())) {
  const H = LABEL_H[layout] || LABEL_H["50x50"];
  // Content is laid out below a blank band of topPx rows; runLabelJob crops that band off
  // (the printer firmware adds its own ~10mm top offset). 50x50 canvas stays 384 tall.
  const CH = layout === "50x30" ? H + topPx : H;
  const { c, ctx } = getCanvas(LABEL_W, CH);
  const cx = LABEL_W / 2;
  const price = d.price != null ? money(d.price) : "";
  ctx.textAlign = "center";
  ctx.translate(0, topPx);
  if (layout === "50x30") {
    // QR left, text right.
    drawQr(ctx, serial, 8, 8, H - 16);
    const tx = 8 + (H - 16) + 14 + (LABEL_W - (H - 16) - 30) / 2;
    const tw = LABEL_W - (H - 16) - 40;
    ctx.fillStyle = "#555"; fitText(ctx, "AhamStree", tx, 52, tw, 22, "");
    ctx.fillStyle = "#000"; fitText(ctx, serial, tx, 98, tw, 26, "600");
    fitText(ctx, price, tx, 152, tw, 44, "800");
    ctx.fillStyle = "#555"; fitText(ctx, SITE_URL, tx, 200, tw, 20, "600");
    ctx.fillStyle = "#000";
    return c;
  }
  // 50x50 dense layout (mirrors print-labels.css). Usable area: 384 x 304 (~48 x 38mm).
  const AVAIL = Math.max(304, H - topPx), W = LABEL_W - 16;
  let y = 0;
  ctx.fillStyle = "#000";
  if (hindiOk) {
    fitText(ctx, "अहम् स्त्री", cx, y + 34, W, 42, "bold", '"Noto Sans Devanagari", serif');
    ctx.fillStyle = "#555"; ctx.font = "15px Outfit, sans-serif";
    ctx.fillText("AHAMSTREE", cx, y + 50);
    y += 54;
  } else {
    fitText(ctx, "AhamStree", cx, y + 34, W, 40, "bold");
    y += 44;
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(cx - 150, y, 300, 2); y += 4;
  const care = [d.care ? "Care: " + d.care : "", PROVENANCE].filter(Boolean).join(" | ");
  // Fixed rows below the QR: serial, rule, saree type, price, care/provenance, url.
  const below = 26 + 4 + (d.sareeType ? 20 : 0) + 46 + 16 + 16;
  const qs = Math.max(112, Math.min(230, AVAIL - y - below));
  drawQr(ctx, serial, cx - qs / 2, y, qs); y += qs;
  fitText(ctx, serial, cx, y + 20, W, 24, "700"); y += 26;
  ctx.fillRect(cx - 150, y, 300, 2); y += 2;
  if (d.sareeType) { fitText(ctx, d.sareeType, cx, y + 16, W, 18); y += 20; }
  fitText(ctx, price, cx, y + 38, W, 50, "900"); y += 46;
  ctx.fillStyle = "#333";
  fitText(ctx, care, cx, y + 12, W, 15); y += 16;
  ctx.fillStyle = "#000";
  fitText(ctx, SITE_URL, cx, y + 12, W, 15, "700");
  return c;
}

// ───────────── canvas -> ESC/POS raster ─────────────
// Returns bytes for GS v 0 bands: packed MSB-first, 1 = black.
export function canvasToRaster(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const px = ctx.getImageData(0, 0, w, h).data;
  const bpr = Math.ceil(w / 8);
  const out = [];
  for (let y0 = 0; y0 < h; y0 += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, h - y0);
    const buf = new Uint8Array(8 + bpr * rows);
    buf.set([0x1d, 0x76, 0x30, 0x00, bpr & 0xff, (bpr >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff]);
    for (let r = 0; r < rows; r++) {
      for (let x = 0; x < w; x++) {
        const i = ((y0 + r) * w + x) * 4;
        const a = px[i + 3] / 255;
        const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a);
        if (lum < 140) buf[8 + r * bpr + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    out.push(buf);
  }
  return out;
}

const INIT = new Uint8Array([0x1b, 0x40]);
const feed = (n) => new Uint8Array([0x1b, 0x64, n]);          // ESC d n (print and feed n lines)
const LINE_SPACING_RESET = new Uint8Array([0x1b, 0x32]);      // ESC 2: default line spacing
const FORM_FEED = new Uint8Array([0x0c]);                     // Advance to top of next label (needs label-mode calibration)
const CUT = new Uint8Array([0x1d, 0x56, 0x01]);               // GS V 1 (no-op if unsupported)

function concat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const o = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { o.set(p, off); off += p.length; }
  return o;
}

// ───────────── PDF -> canvas (invoices) ─────────────
let pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = PDFJS_URL; s.onload = res; s.onerror = () => rej(new Error("pdfjs_load_failed"));
      document.head.appendChild(s);
    });
    // Cross-origin workers are blocked; load the worker through a blob URL.
    const code = await (await fetch(PDFJS_WORKER_URL)).text();
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    return window.pdfjsLib;
  })();
  pdfjsPromise.catch(() => { pdfjsPromise = null; });
  return pdfjsPromise;
}

async function renderPdfToCanvas(pdfBytes, targetW) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: targetW / base.width });
    const pc = document.createElement("canvas");
    pc.width = targetW; pc.height = Math.ceil(vp.height);
    const pctx = pc.getContext("2d");
    pctx.fillStyle = "#fff"; pctx.fillRect(0, 0, pc.width, pc.height);
    await page.render({ canvasContext: pctx, viewport: vp }).promise;
    pages.push(pc);
  }
  // Stack pages; trim trailing white on the last page.
  let total = pages.reduce((s, p) => s + p.height, 0);
  const { c, ctx } = getCanvas(targetW, total);
  let y = 0;
  for (const p of pages) { ctx.drawImage(p, 0, y); y += p.height; }
  const px = ctx.getImageData(0, 0, targetW, total).data;
  let last = total - 1;
  outer: for (; last > 0; last--) {
    for (let x = 0; x < targetW; x++) if (px[(last * targetW + x) * 4] < 200) break outer;
  }
  const keep = Math.min(total, last + 24);
  if (keep < total) {
    const img = ctx.getImageData(0, 0, targetW, keep);
    c.height = keep;
    c.getContext("2d").putImageData(img, 0, 0);
  }
  return c;
}

// ───────────── authed fetch ─────────────
async function authedFetch(url, body) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.error || "HTTP " + res.status); e.status = res.status; throw e; }
  return json;
}

async function labelInfo(serial) {
  if (infoCache.has(serial)) return infoCache.get(serial);
  let info = {};
  try {
    const { piece } = await authedFetch(INV_FN, { action: "get-by-serial", serial });
    const prod = piece && piece.products;
    if (prod) info = {
      price: prod.sale_price_inr ?? prod.price_inr,
      sareeType: prod.saree_types?.name || "",
      care: prod.care_instructions?.text || "",
    };
  } catch (_) { /* serial-only label */ }
  infoCache.set(serial, info);
  return info;
}

// ───────────── job execution ─────────────
async function sendBytes(bytes) {
  if (!transport) throw new Error("bluetooth_disconnected");
  await transport.write(bytes);
}

async function printCanvas(canvas) {
  const bands = canvasToRaster(canvas);
  await sendBytes(concat([INIT, LINE_SPACING_RESET, ...bands]));
}

// Crop the top topPx rows off the canvas ("shift content up").
function cropTop(canvas, topPx) {
  // Positive topPx: crop N pixels off the top (content shifts UP on paper).
  // Negative topPx: ADD |N| blank pixels at the top (content shifts DOWN on paper).
  if (topPx === 0) return canvas;
  const h = Math.max(1, canvas.height - topPx);
  const out = document.createElement("canvas");
  out.width = canvas.width; out.height = h;
  const o = out.getContext("2d");
  o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, h);
  o.drawImage(canvas, 0, -topPx);
  return out;
}

// ESC J n (print and feed n dots), repeated for n > 255.
function trailingFeedBytes(mm) {
  let dots = mmToDots(mm);
  const parts = [];
  while (dots > 0) { const n = Math.min(255, dots); parts.push(new Uint8Array([0x1b, 0x4a, n])); dots -= n; }
  return parts;
}

async function runLabelJob(job) {
  const { serials = [], layout = "50x50" } = job.payload || {};
  if (!serials.length) throw new Error("empty_serials");
  await loadHindiFont();
  for (const serial of serials) {
    const topPx = mmToDots(getTopOffsetMm());
    const full = renderLabelCanvas(serial, layout, await labelInfo(serial), topPx);
    await printCanvas(cropTop(full, topPx));
    const tf = trailingFeedBytes(getTrailingFeedMm());
    if (tf.length) await sendBytes(concat(tf));
    // After each label, advance to the TOP of the next label. On label-mode
    // printers with the gap sensor calibrated, 0x0C advances to the next
    // gap. If the printer isn't calibrated, this is a no-op and labels
    // will drift — user must run the printer's label-learn procedure once.
    await sendBytes(FORM_FEED);
  }
  // No trailing dot feed — form feed already parked us at the next label top.
  // Keep CUT in case the unit has an auto-cutter.
  await sendBytes(CUT);
}

async function runInvoiceJob(job) {
  const orderId = job.payload?.order_id;
  if (!orderId) throw new Error("missing_order_id");
  const r = await authedFetch(INVOICE_FN, { order_id: orderId });
  const url = r.invoice_url || r.url;
  if (!url || !/^https:/i.test(url)) throw new Error("invoice_url_missing");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("invoice_download_failed");
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const width = parseInt($("paperWidth").value, 10) || 384;
  const canvas = await renderPdfToCanvas(bytes, width);
  await printCanvas(canvas);
  await sendBytes(concat([feed(4), CUT]));
}

function reasonOf(e) {
  const m = String(e?.message || e || "unknown");
  if (e?.name === "NetworkError" || /disconnect|GATT|device is no longer/i.test(m)) return "bluetooth_disconnected";
  return m.slice(0, 200);
}

async function processJob(row) {
  let claimed;
  try {
    claimed = (await queueCall({ action: "claim", job_id: row.id, agent_id: agentId })).job;
  } catch (e) {
    if (e.status === 409) return; // another agent took it
    throw e;
  }
  printing = true; setState();
  let ok = false, reason = null;
  try {
    if (claimed.kind === "label") await runLabelJob(claimed);
    else if (claimed.kind === "invoice") await runInvoiceJob(claimed);
    else throw new Error("unknown_kind");
    ok = true;
  } catch (e) {
    reason = reasonOf(e);
    console.error("print job failed", e);
    if (reason === "bluetooth_disconnected") onTransportLost();
  }
  try { await queueCall({ action: "complete", job_id: claimed.id, success: ok, failure_reason: reason }); }
  catch (e) { console.error("complete failed", e); }
  printing = false; setState();
  toast(ok ? "Printed " + claimed.kind : "Print failed: " + reason);
  loadJobs();
}

async function drain() {
  if (processing) return;
  processing = true;
  try {
    while (transport && pending.length) {
      const row = pending.shift();
      setState();
      try { await processJob(row); } catch (e) { console.error(e); toast("Queue error: " + e.message); }
    }
  } finally { processing = false; setState(); }
}

function schedule(row) {
  if (!row || row.status !== "queued" || seen.has(row.id)) return;
  seen.add(row.id);
  pending.push(row);
  setState();
  drain();
}

// Jobs left unscheduled while disconnected get re-picked after reconnect.
async function syncQueued() {
  try {
    const r = await queueCall({ action: "list", status: "queued", limit: 100 });
    const ids = new Set((r.rows || []).map((x) => x.id));
    for (const id of [...seen]) if (!ids.has(id) && !pending.some((p) => p.id === id)) seen.delete(id);
    (r.rows || []).forEach(schedule);
    setState();
  } catch (e) { console.warn("syncQueued", e); }
}

// ───────────── job log ─────────────
function fmtTime(s) { try { return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (_) { return s; } }
function detailOf(j) {
  const p = j.payload || {};
  if (j.kind === "label") return (p.serials || []).slice(0, 3).join(", ") + ((p.serials || []).length > 3 ? " +" + (p.serials.length - 3) : "") + " (" + (p.layout || "50x50") + ")";
  return "Order " + String(p.order_id || "").slice(0, 8);
}
let jobRows = [];
async function loadJobs() {
  try {
    const r = await queueCall({ action: "list", limit: 20 });
    jobRows = r.rows || [];
  } catch (e) { $("jobsBody").innerHTML = '<tr><td colspan="5" class="pa-empty">Failed to load: ' + escapeHtml(e.message) + "</td></tr>"; return; }
  if (!jobRows.length) { $("jobsBody").innerHTML = '<tr><td colspan="5" class="pa-empty">No jobs yet.</td></tr>'; return; }
  $("jobsBody").innerHTML = jobRows.map((j) =>
    '<tr class="' + (j.status === "failed" ? "failed" : "") + '" data-id="' + escapeHtml(j.id) + '">' +
    "<td>" + escapeHtml(fmtTime(j.created_at)) + "</td><td>" + escapeHtml(j.kind) + "</td><td class=\"mono\">" + escapeHtml(detailOf(j)) + "</td>" +
    '<td><span class="pa-pill ' + escapeHtml(j.status) + '">' + escapeHtml(j.status) + "</span>" +
    (j.failure_reason ? ' <span class="pa-sub">' + escapeHtml(j.failure_reason) + "</span>" : "") + "</td>" +
    "<td>" + (j.status === "failed" ? "Retry" : j.status === "queued" ? '<a href="#" data-cancel="1">Cancel</a>' : "") + "</td></tr>"
  ).join("");
}

// ───────────── transports ─────────────
// ───────────── default printer + auto-reconnect ─────────────
function loadDefault() {
  try { const v = JSON.parse(localStorage.getItem("defaultPrinter") || "null"); return v && v.deviceId ? v : null; } catch (_) { return null; }
}
function saveDefault(deviceId, deviceName, transportKind) {
  try { localStorage.setItem("defaultPrinter", JSON.stringify({ deviceId, deviceName, transportKind })); } catch (_) {}
}
function clearDefault() { try { localStorage.removeItem("defaultPrinter"); } catch (_) {} }
function agentLog(msg) { console.info("[print-agent] " + msg); const l = $("agentLog"); if (l) l.textContent = new Date().toLocaleTimeString() + " " + msg; }

function onTransportLost() {
  if (!transport) return;
  try { transport.close(); } catch (_) {}
  transport = null;
  if (loadDefault() && !manualDisconnect) { startReconnect(); toast("Printer disconnected. Reconnecting…", 5000); }
  else toast("Printer disconnected. Reconnect to resume the queue.", 7000);
  setState();
}

function startReconnect() {
  if (reconnecting || !loadDefault()) return;
  reconnecting = true; setState();
  agentLog("Auto-reconnect started");
  const tick = async () => {
    if (!reconnecting) return;
    if (document.visibilityState === "visible" && !reconnectBusy) {
      reconnectBusy = true;
      try { if (await tryAutoConnect()) return; } catch (e) { agentLog("Reconnect failed: " + (e.message || e)); }
      finally { reconnectBusy = false; }
    }
    if (reconnecting) reconnectTimer = setTimeout(tick, 5000);
  };
  reconnectTimer = setTimeout(tick, 5000);
}
function stopReconnect() { reconnecting = false; clearTimeout(reconnectTimer); reconnectTimer = null; }

// Silent connect to the stored default printer (no user prompt). Returns true on success.
async function tryAutoConnect() {
  const dp = loadDefault();
  if (!dp) return false;
  if (dp.transportKind === "mock") {
    if (params.get("mock") !== "1") return false;
    mockTransport(); agentLog("Auto-reconnected to " + dp.deviceName); await afterConnect(); return true;
  }
  if (dp.transportKind === "bluetooth") {
    if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return false;
    const devs = await navigator.bluetooth.getDevices();
    const device = devs.find((d) => d.id === dp.deviceId);
    if (!device) return false;
    await connectBleDevice(device, true);
  } else if (dp.transportKind === "serial") {
    if (!navigator.serial) return false;
    const ports = await navigator.serial.getPorts();
    const port = ports[parseInt(String(dp.deviceId).split(":")[1], 10)];
    if (!port) return false;
    await openSerialPort(port);
  } else return false;
  agentLog("Auto-reconnected to " + dp.deviceName);
  await afterConnect();
  return true;
}

function bleTransport(device, ch) {
  const withResp = ch.properties.write || !ch.properties.writeWithoutResponse;
  device.addEventListener("gattserverdisconnected", onTransportLost);
  return {
    name: device.name || "Bluetooth printer",
    async write(bytes) {
      for (let i = 0; i < bytes.length; i += BLE_CHUNK) {
        const part = bytes.subarray(i, i + BLE_CHUNK);
        if (withResp) await ch.writeValueWithResponse(part);
        else { await ch.writeValueWithoutResponse(part); if ((i / BLE_CHUNK) % 4 === 3) await new Promise((r) => setTimeout(r, 15)); }
      }
    },
    close() { try { device.removeEventListener("gattserverdisconnected", onTransportLost); device.gatt.disconnect(); } catch (_) {} },
  };
}

async function findWritable(server) {
  const services = await server.getPrimaryServices();
  const cands = [];
  for (const svc of services) {
    let chars = [];
    try { chars = await svc.getCharacteristics(); } catch (_) { continue; }
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) cands.push({ svc, ch: c });
    }
  }
  const rank = (x) => { const i = PREFERRED_ORDER.findIndex((p) => x.svc.uuid.startsWith(p)); return i < 0 ? 99 : i; };
  cands.sort((a, b) => rank(a) - rank(b));
  return cands;
}

async function connectBle() {
  if (!navigator.bluetooth) throw new Error("Web Bluetooth is not available in this browser (use Chrome/Edge on Android or desktop).");
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
  await connectBleDevice(device, false);
}

async function connectBleDevice(device, silent) {
  const server = await device.gatt.connect();
  const cands = await findWritable(server);
  if (!cands.length) { try { device.gatt.disconnect(); } catch (_) {} throw new Error("No writable BLE characteristic found. This printer may be classic Bluetooth; use \"Connect via paired serial port\"."); }
  // Auto-pick the best-ranked candidate; offer a manual choice if several exist.
  if (cands.length > 1 && !silent) offerPicker(device, cands);
  transport = bleTransport(device, cands[0].ch);
  manualDisconnect = false; stopReconnect();
  saveDefault(device.id, device.name || "Bluetooth printer", "bluetooth");
  setState();
}

function offerPicker(device, cands) {
  const sel = $("svcSelect");
  sel.innerHTML = cands.map((c, i) => '<option value="' + i + '">' + escapeHtml(c.svc.uuid + " / " + c.ch.uuid) + "</option>").join("");
  $("svcPick").hidden = false;
  $("svcUse").onclick = () => {
    const c = cands[parseInt(sel.value, 10)];
    if (transport) transport.close();
    transport = bleTransport(device, c.ch);
    $("svcPick").hidden = true; setState(); toast("Using " + c.ch.uuid);
    syncQueued();
  };
}

async function connectSerial() {
  const port = await navigator.serial.requestPort();
  await openSerialPort(port);
  // Serial ports have no stable id: store the index among permitted ports.
  const idx = (await navigator.serial.getPorts()).indexOf(port);
  saveDefault("serial:" + Math.max(0, idx), "Serial / paired Bluetooth", "serial");
  setState();
}

async function openSerialPort(port) {
  await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();
  transport = {
    name: "Serial / paired Bluetooth",
    async write(bytes) { await writer.write(bytes); },
    close() { try { writer.releaseLock(); } catch (_) {} try { port.close(); } catch (_) {} },
  };
  port.addEventListener?.("disconnect", onTransportLost);
  manualDisconnect = false; stopReconnect();
  setState();
}

function mockTransport() {
  window.__mockChunks = [];
  transport = {
    name: "MOCK (logs chunks)",
    async write(bytes) {
      for (let i = 0; i < bytes.length; i += BLE_CHUNK) window.__mockChunks.push(bytes.slice(i, i + BLE_CHUNK));
      await new Promise((r) => setTimeout(r, 5));
    },
    close() {},
  };
  manualDisconnect = false; stopReconnect();
  saveDefault("mock", "MOCK (logs chunks)", "mock");
  setState();
}

async function afterConnect() {
  requestWake();
  await syncQueued();
  loadJobs();
}

// ───────────── wake lock ─────────────
async function requestWake() {
  try {
    if (!("wakeLock" in navigator)) throw new Error("unsupported");
    wakeLock = await navigator.wakeLock.request("screen");
    $("wakeInfo").textContent = "Screen kept awake.";
    wakeLock.addEventListener("release", () => { $("wakeInfo").textContent = ""; });
  } catch (e) {
    $("wakeInfo").textContent = "Screen may sleep.";
    toast("Could not keep the screen awake. Disable auto-lock manually.", 6000);
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && (!wakeLock || wakeLock.released)) requestWake(); });

// ───────────── realtime ─────────────
function subscribe() {
  supabase.channel("print_jobs_agent")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "print_jobs", filter: "status=eq.queued" }, (payload) => {
      if (payload.new) { schedule(payload.new); loadJobs(); }
    })
    .subscribe((status) => { if (status === "SUBSCRIBED") console.info("print_jobs realtime subscribed"); });
  // Safety net: Realtime can drop silently on flaky networks.
  setInterval(() => { if (transport && !processing) syncQueued(); loadJobs(); }, 10000);
}

// ───────────── wiring ─────────────
function wire() {
  $("agentId").textContent = agentId.slice(0, 8);
  $("agentId").title = agentId;
  const supported = !!navigator.bluetooth;
  $("supportNote").textContent = supported ? "" : "Web Bluetooth is not available here (iOS/Safari/Firefox are unsupported). Use Chrome or Edge on Android or desktop.";
  try { const w = localStorage.getItem("ahamstreePaperWidth"); if (w) $("paperWidth").value = w; } catch (_) {}
  $("paperWidth").addEventListener("change", () => { try { localStorage.setItem("ahamstreePaperWidth", $("paperWidth").value); } catch (_) {} });
  for (const [id, def, min, max] of [["labelOffset", 0, 0, 25], ["trailingFeed", 15, 0, 50]]) {
    const el = $(id);
    el.value = readNumSetting(id, def, min, max);
    el.addEventListener("change", () => {
      const v = Math.min(max, Math.max(min, parseFloat(el.value) || 0));
      el.value = v;
      try { localStorage.setItem(id, String(v)); } catch (_) {}
    });
  }
  if (params.get("mock") === "1") $("btnMock").hidden = false;

  $("btnConnect").addEventListener("click", async () => {
    try { await connectBle(); await afterConnect(); }
    catch (e) { if (e.name !== "NotFoundError") toast(e.message || String(e), 7000); }
  });
  // One-click reconnect uses the stored default printer's transport kind directly.
  $("btnReconnect").addEventListener("click", async () => {
    const dp = loadDefault();
    if (!dp) return;
    manualDisconnect = false; stopReconnect();
    try {
      if (dp.transportKind === "serial") await connectSerial();
      else if (dp.transportKind === "mock") { mockTransport(); }
      else await connectBle();
      await afterConnect();
    } catch (e) {
      if (e.name !== "NotFoundError") toast(e.message || String(e), 7000);
    }
  });
  $("btnSerial").addEventListener("click", async () => {
    try { await connectSerial(); await afterConnect(); }
    catch (e) { if (e.name !== "NotFoundError") toast(e.message || String(e), 7000); }
  });
  $("btnMock").addEventListener("click", async () => { mockTransport(); await afterConnect(); });
  $("btnDisconnect").addEventListener("click", () => { manualDisconnect = true; stopReconnect(); onTransportLost(); });
  $("changePrinter").addEventListener("click", (e) => {
    e.preventDefault();
    clearDefault(); manualDisconnect = true; stopReconnect();
    if (transport) onTransportLost(); else setState();
    toast("Default printer cleared. Pick a new printer with Connect.", 6000);
  });
  $("showCanvas").addEventListener("change", (e) => {
    $("canvasWrap").hidden = !e.target.checked;
    $("renderCanvas").style.display = e.target.checked ? "block" : "none";
  });
  $("jobsBody").addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const job = jobRows.find((j) => j.id === tr.dataset.id);
    if (!job) return;
    try {
      if (e.target.closest("[data-cancel]")) {
        e.preventDefault();
        await queueCall({ action: "cancel", job_id: job.id });
        pending.splice(0, pending.length, ...pending.filter((p) => p.id !== job.id));
        toast("Cancelled");
      } else if (job.status === "failed") {
        await queueCall({ action: "enqueue", kind: job.kind, payload: job.payload });
        toast("Re-queued");
      } else return;
      loadJobs();
    } catch (err) { toast(err.message); }
  });

  // Debug hooks for local verification.
  window.__printAgent = { renderLabelCanvas, canvasToRaster, loadHindiFont, schedule, get hindiOk() { return hindiOk; } };
}

// ───────────── boot ─────────────
(async function init() {
  try {
    const sess = await supabase.auth.getSession();
    if (sess.error) return showGateError("Auth Error", sess.error.message);
    if (!sess.data || !sess.data.session) { window.location.href = "login.html"; return; }
    const email = (sess.data.session.user.email || "").toLowerCase();
    const adm = await supabase.from("admin_users").select("email").eq("email", email).maybeSingle();
    if (adm.error) return showGateError("Error", adm.error.message);
    if (!adm.data) return showGateError("Access Denied", "Your account does not have admin access.");
    $("loadingState").style.display = "none";
    $("agent").style.display = "block";
    wire();
    setState();
    tryAutoConnect().then((ok) => { if (!ok && loadDefault()) startReconnect(); }).catch((e) => { agentLog("Auto-connect failed: " + (e.message || e)); if (loadDefault()) startReconnect(); });
    loadHindiFont();
    loadJobs();
    subscribe();
  } catch (e) {
    showGateError("Error", e.message || String(e));
  }
})();
