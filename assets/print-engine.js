// assets/print-engine.js
//
// The Bluetooth/Serial printer connection + print_jobs queue engine, shared
// by admin-print-agent.html (the home QR-label station) and admin-pos.html
// (exhibition billing, invoice-only). Previously this all lived inline in
// admin-print-agent.js, tightly coupled to that page's specific DOM ids —
// pulled out here so a second page can hold its own independent printer
// connection without duplicating ~900 lines of BLE/TSPL/ESC-POS/PDF logic.
//
// A caller gets its own isolated engine instance via createPrintEngine();
// each instance has its own transport, reconnect loop, and job queue state
// — two pages each running an engine never share a JS-level connection
// (they're different tabs/devices anyway), they just share the *code*.
//
// UI is entirely the caller's responsibility: this module never touches the
// DOM except for an offscreen <canvas> it creates itself. State changes,
// log lines, and toasts are reported via the hooks passed into
// createPrintEngine({ onState, onLog, onToast }).

import { supabase, SUPABASE_ANON_KEY } from "./supabase.js";
import { queueCall } from "./print-queue.js";

const INVOICE_FN = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/admin-generate-invoice";
const INV_FN = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/admin-manage-inventory";
const PDFJS_VER = "3.11.174";
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VER + "/pdf.worker.min.js";

const LABEL_W = 384;
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
const LABEL_H = { "50x50": 400, "50x30": 240 };
const BLE_CHUNK = 200;
const BAND_ROWS = 65535;
const PROVENANCE = "Handwoven in Chanderi, India";
const SITE_URL = "www.ahamstree.com";

const BLE_SERVICES = [
  0xff00, 0x18f0, 0xffe0, 0xfee7, 0xae30,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "000018f0-0000-1000-8000-00805f9b34fb",
];
const PREFERRED_ORDER = ["e7810a71-73ae-499d-8c15-faa9aef0c3f2", "000018f0", "0000ff00", "0000ffe0", "49535343", "0000fee7", "0000ae30"];

function money(v) { return "₹ " + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

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

function fitText(ctx, text, x, y, maxW, px, weight = "", family = "Outfit, DM Sans, sans-serif") {
  let size = px;
  for (; size > 8; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`.trim();
    if (ctx.measureText(text).width <= maxW) break;
  }
  ctx.fillText(text, x, y);
}

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

export function canvasToTsplBitmap(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const px = ctx.getImageData(0, 0, w, h).data;
  const widthBytes = Math.ceil(w / 8);
  const data = new Uint8Array(widthBytes * h);
  data.fill(0xFF);
  for (let y = 0; y < h; y++) {
    const rowOff = y * widthBytes;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3] / 255;
      const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a);
      if (lum < 140) data[rowOff + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }
  return { widthBytes, height: h, data };
}

const CRLF = new TextEncoder().encode("\r\n");
function tsplCmd(str) { return new TextEncoder().encode(str + "\r\n"); }
const INIT = new Uint8Array([0x1b, 0x40]);
const feed = (n) => new Uint8Array([0x1b, 0x64, n]);
const LINE_SPACING_RESET = new Uint8Array([0x1b, 0x32]);
const CUT = new Uint8Array([0x1d, 0x56, 0x01]);
function concat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const o = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { o.set(p, off); off += p.length; }
  return o;
}

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
    const code = await (await fetch(PDFJS_WORKER_URL)).text();
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    return window.pdfjsLib;
  })();
  pdfjsPromise.catch(() => { pdfjsPromise = null; });
  return pdfjsPromise;
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
  if (!res.ok) { const e = new Error(json.error || "HTTP " + res.status); e.status = res.status; throw e; }
  return json;
}

// One engine instance per page. `kinds` restricts which print_jobs this
// instance will claim — the POS/exhibition engine passes ["invoice"] so it
// never picks up a QR-label job meant for the home station (and vice versa
// if a label-only instance existed), even though both read the same table.
export function createPrintEngine({
  kinds = ["label", "invoice"],
  onState = () => {},
  onLog = () => {},
  onToast = () => {},
  onJobScheduled = () => {},
  getPaperWidth = () => 384,
} = {}) {
  const kindSet = new Set(kinds);
  const params = new URLSearchParams(location.search);
  const mockAllowed = params.get("mock") === "1";

  const agentId = (() => {
    try {
      let v = localStorage.getItem("ahamstreePrintAgentId");
      if (!v) { v = crypto.randomUUID(); localStorage.setItem("ahamstreePrintAgentId", v); }
      return v;
    } catch (_) { return crypto.randomUUID(); }
  })();

  let transport = null;
  let reconnecting = false;
  let reconnectTimer = null;
  let reconnectBusy = false;
  let manualDisconnect = false;
  let printing = false;
  let processing = false;
  let wakeLock = null;
  const pending = [];
  const seen = new Set();
  const infoCache = new Map();
  let hindiOk = false;
  let subscribed = false;
  let keepaliveTimer = null;

  function loadDefault() {
    try { const v = JSON.parse(localStorage.getItem("defaultPrinter") || "null"); return v && v.deviceId ? v : null; } catch (_) { return null; }
  }
  function saveDefault(deviceId, deviceName, transportKind) {
    try { localStorage.setItem("defaultPrinter", JSON.stringify({ deviceId, deviceName, transportKind })); } catch (_) {}
  }
  function clearDefault() { try { localStorage.removeItem("defaultPrinter"); } catch (_) {} }

  function reportState() {
    const status = printing ? "printing" : transport ? "connected" : reconnecting ? "reconnecting" : "disconnected";
    const dp = loadDefault();
    onState({
      status,
      deviceName: transport ? transport.name : null,
      defaultName: dp ? dp.deviceName : null,
      queueLength: pending.length,
      hasDefault: !!dp,
    });
  }

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

  function getCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#000"; ctx.strokeStyle = "#000";
    ctx.textBaseline = "alphabetic";
    return { c, ctx };
  }

  function renderLabelCanvas(serial, layout, d = {}, topPx = mmToDots(getTopOffsetMm())) {
    const H = LABEL_H[layout] || LABEL_H["50x50"];
    const extra = Math.abs(topPx);
    const CH = layout === "50x30" ? H + topPx : H + extra;
    const { c, ctx } = getCanvas(LABEL_W, CH);
    const cx = LABEL_W / 2;
    const price = d.price != null ? money(d.price) : "";
    ctx.textAlign = "center";
    ctx.translate(0, topPx >= 0 ? topPx : extra);
    if (layout === "50x30") {
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
    const URL_STRIP = 30;
    const MAIN_W = LABEL_W - URL_STRIP;
    const mcx = MAIN_W / 2;
    const AVAIL = Math.max(304, H - topPx);
    const W = MAIN_W - 8;
    const RW = Math.round(MAIN_W * 0.9);
    let y = 0;
    const rule = () => { ctx.fillStyle = "#000"; ctx.fillRect(mcx - RW / 2, y, RW, 2); };
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    if (hindiOk) {
      fitText(ctx, "अहम् स्त्री", mcx, y + 27, W, 32, "bold", '"Noto Sans Devanagari", serif'); y += 32;
      fitText(ctx, "AhamStree", mcx, y + 15, W, 19, "600"); y += 20;
    } else {
      fitText(ctx, "AhamStree", mcx, y + 30, W, 40, "bold"); y += 36;
    }
    y += 2; rule(); y += 2 + 3;
    const hasType = !!d.sareeType;
    const below = 3 + 22 + 7 + (hasType ? 20 : 0) + 44 + 18 + 18;
    const qs = Math.max(112, Math.min(230, AVAIL - y - below));
    drawQr(ctx, serial, mcx - qs / 2, y, qs); y += qs + 3;
    fitText(ctx, serial, mcx, y + 17, W, 20, "700"); y += 22;
    y += 2; rule(); y += 2 + 3;
    if (hasType) { fitText(ctx, d.sareeType, mcx, y + 14, W, 17, "700"); y += 20; }
    fitText(ctx, price, mcx, y + 34, W, 40, "900"); y += 44;
    ctx.fillStyle = "#000";
    if (d.care) { fitText(ctx, "Care: " + d.care, mcx, y + 14, W, 16, "700"); y += 18; }
    fitText(ctx, PROVENANCE, mcx, y + 14, W, 16, "700"); y += 18;
    ctx.fillStyle = "#000";
    ctx.fillRect(MAIN_W, 0, 2, H);
    ctx.save();
    ctx.translate(MAIN_W + URL_STRIP / 2, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = `800 20px Outfit, DM Sans, sans-serif`;
    ctx.fillText(SITE_URL, 0, 7);
    ctx.restore();
    return c;
  }

  function cropTop(canvas, topPx) {
    if (topPx === 0) return canvas;
    const h = Math.max(1, canvas.height - topPx);
    const out = document.createElement("canvas");
    out.width = canvas.width; out.height = h;
    const o = out.getContext("2d");
    o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, h);
    o.drawImage(canvas, 0, -topPx);
    return out;
  }

  async function sendBytes(bytes) {
    if (!transport) throw new Error("bluetooth_disconnected");
    await transport.write(bytes);
  }

  async function printCanvas(canvas) {
    const bands = canvasToRaster(canvas);
    await sendBytes(concat([INIT, LINE_SPACING_RESET, ...bands]));
  }

  async function sendTsplLabel(sizeMm, canvas, xOffsetDots = 0, yOffsetDots = 0) {
    const bmp = canvasToTsplBitmap(canvas);
    const bmpHdr = new TextEncoder().encode(`BITMAP ${xOffsetDots},${yOffsetDots},${bmp.widthBytes},${bmp.height},0,`);
    await sendBytes(concat([
      tsplCmd(`SIZE ${sizeMm}`),
      tsplCmd(`GAP 2 mm, 0 mm`),
      tsplCmd(`DIRECTION 0`),
      tsplCmd(`CLS`),
      bmpHdr, bmp.data, CRLF,
      tsplCmd(`PRINT 1, 1`),
    ]));
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

  async function runLabelJob(job) {
    const { serials = [], layout = "50x50" } = job.payload || {};
    if (!serials.length) throw new Error("empty_serials");
    await loadHindiFont();
    const sizeMm = layout === "50x30" ? "50 mm, 30 mm" : "50 mm, 50 mm";
    for (const serial of serials) {
      const topPx = mmToDots(getTopOffsetMm());
      const full = renderLabelCanvas(serial, layout, await labelInfo(serial), topPx);
      await sendTsplLabel(sizeMm, topPx > 0 ? cropTop(full, topPx) : full, 0, 0);
    }
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

  async function runInvoiceJob(job) {
    const orderId = job.payload?.order_id;
    if (!orderId) throw new Error("missing_order_id");
    const r = await authedFetch(INVOICE_FN, { order_id: orderId });
    const url = r.invoice_url || r.url;
    if (!url || !/^https:/i.test(url)) throw new Error("invoice_url_missing");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("invoice_download_failed");
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const width = getPaperWidth() || 384;
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
      if (e.status === 409) return;
      throw e;
    }
    printing = true; reportState();
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
    printing = false; reportState();
    onToast(ok ? "Printed " + claimed.kind : "Print failed: " + reason);
    onJobScheduled();
  }

  async function drain() {
    if (processing) return;
    processing = true;
    try {
      while (transport && pending.length) {
        const row = pending.shift();
        reportState();
        try { await processJob(row); } catch (e) { console.error(e); onToast("Queue error: " + e.message); }
      }
    } finally { processing = false; reportState(); }
  }

  function schedule(row) {
    if (!row || row.status !== "queued" || seen.has(row.id) || !kindSet.has(row.kind)) return;
    seen.add(row.id);
    pending.push(row);
    reportState();
    drain();
  }

  async function syncQueued() {
    try {
      const r = await queueCall({ action: "list", status: "queued", limit: 100 });
      const ids = new Set((r.rows || []).map((x) => x.id));
      for (const id of [...seen]) if (!ids.has(id) && !pending.some((p) => p.id === id)) seen.delete(id);
      (r.rows || []).forEach(schedule);
      reportState();
    } catch (e) { console.warn("syncQueued", e); }
  }

  function agentLog(msg) {
    console.info("[print-engine] " + msg);
    onLog(msg);
  }

  function onTransportLost() {
    if (!transport) return;
    stopKeepalive();
    try { transport.close(); } catch (_) {}
    transport = null;
    if (loadDefault() && !manualDisconnect) { startReconnect(); onToast("Printer disconnected. Reconnecting…", 5000); }
    else onToast("Printer disconnected. Reconnect to resume the queue.", 7000);
    reportState();
  }

  function startReconnect() {
    if (reconnecting || !loadDefault()) return;
    reconnecting = true; reportState();
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

  async function tryAutoConnect() {
    const dp = loadDefault();
    if (!dp) return false;
    if (dp.transportKind === "mock") {
      if (!mockAllowed) return false;
      mockConnect(); agentLog("Auto-reconnected to " + dp.deviceName); await afterConnect(); return true;
    }
    if (dp.transportKind === "bluetooth") {
      if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
        agentLog("Silent reconnect unavailable: this browser doesn't support navigator.bluetooth.getDevices() — tap Reconnect manually.");
        return false;
      }
      const devs = await navigator.bluetooth.getDevices();
      const device = devs.find((d) => d.id === dp.deviceId);
      if (!device) {
        agentLog("Silent reconnect found " + devs.length + " remembered device(s), none matching the saved printer (" + dp.deviceName + ") — tap Reconnect manually.");
        return false;
      }
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

  function withTimeout(p, ms, label) {
    return Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout:" + label)), ms)),
    ]);
  }

  function bleTransport(device, initialCh) {
    let ch = initialCh;
    let withResp = ch.properties.write || !ch.properties.writeWithoutResponse;
    device.addEventListener("gattserverdisconnected", onTransportLost);

    async function ensureConnected() {
      if (device.gatt.connected) return;
      agentLog("GATT dropped — reconnecting in place…");
      await withTimeout(device.gatt.connect(), 8000, "gatt_connect");
      const cands = await withTimeout(findWritable(device.gatt), 8000, "find_writable");
      if (!cands.length) throw new Error("No writable characteristic after reconnect");
      const match = cands.find((c) => c.ch.uuid === ch.uuid) || cands[0];
      ch = match.ch;
      withResp = ch.properties.write || !ch.properties.writeWithoutResponse;
      await new Promise((r) => setTimeout(r, 1000));
      agentLog("Reconnected to " + (device.name || "printer") + " mid-print.");
    }

    async function rawWrite(part) {
      if (withResp) await withTimeout(ch.writeValueWithResponse(part), 10000, "write");
      else await withTimeout(ch.writeValueWithoutResponse(part), 10000, "write");
    }

    async function writeOne(part) {
      try {
        await rawWrite(part);
      } catch (e) {
        if (device.gatt.connected && !/^timeout:/.test(String(e.message || ""))) throw e;
        await ensureConnected();
        await rawWrite(part);
      }
    }

    return {
      name: device.name || "Bluetooth printer",
      async write(bytes) {
        if (!device.gatt.connected) await ensureConnected();
        for (let i = 0; i < bytes.length; i += BLE_CHUNK) {
          const part = bytes.subarray(i, i + BLE_CHUNK);
          await writeOne(part);
          if (!withResp && (i / BLE_CHUNK) % 4 === 3) await new Promise((r) => setTimeout(r, 15));
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

  async function connectBle(onMultipleCandidates) {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth is not available in this browser (use Chrome/Edge on Android or desktop).");
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    await connectBleDevice(device, false, onMultipleCandidates);
  }

  async function connectBleDevice(device, silent, onMultipleCandidates) {
    const server = await device.gatt.connect();
    const cands = await findWritable(server);
    if (!cands.length) { try { device.gatt.disconnect(); } catch (_) {} throw new Error("No writable BLE characteristic found. This printer may be classic Bluetooth; use \"Connect via paired serial port\"."); }
    if (cands.length > 1 && !silent && onMultipleCandidates) onMultipleCandidates(device, cands, (chosen) => {
      if (transport) transport.close();
      transport = bleTransport(device, chosen.ch);
      reportState();
      afterConnect();
    });
    transport = bleTransport(device, cands[0].ch);
    manualDisconnect = false; stopReconnect();
    saveDefault(device.id, device.name || "Bluetooth printer", "bluetooth");
    reportState();
    await afterConnect();
  }

  async function connectSerial() {
    const port = await navigator.serial.requestPort();
    await openSerialPort(port);
    const idx = (await navigator.serial.getPorts()).indexOf(port);
    saveDefault("serial:" + Math.max(0, idx), "Serial / paired Bluetooth", "serial");
    reportState();
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
    reportState();
    await afterConnect();
  }

  function mockConnect() {
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
    reportState();
  }

  async function afterConnect() {
    requestWake();
    startKeepalive();
    await syncQueued();
    // A job that arrived (e.g. via the realtime subscription) while this
    // engine was disconnected gets added to `pending` and marked `seen`,
    // but drain()'s own while-loop no-ops when transport is still null —
    // and schedule() (the only other drain() caller) skips anything
    // already in `seen`, so that job would otherwise sit unprocessed
    // forever even after reconnecting. Explicitly draining here catches
    // exactly that case.
    drain();
    onJobScheduled();
  }

  // Some cheap BLE label printers (confirmed with this Seznik unit) drop
  // the connection after a short idle period regardless of the GATT link
  // itself — a firmware-side power-save timer tied to command traffic, not
  // Bluetooth's own supervision timeout. A bare TSPL `CLS` with no
  // following PRINT is a true no-op (clears the print buffer, advances no
  // paper) and is already proven to parse cleanly on this printer since
  // every real label job sends it — so it's safe to replay on its own as
  // a keepalive. Only runs while idle; never overlaps an active print.
  function startKeepalive() {
    stopKeepalive();
    keepaliveTimer = setInterval(async () => {
      if (!transport || printing || processing) return;
      try { await sendBytes(tsplCmd("CLS")); } catch (_) { /* onTransportLost already wired via gattserverdisconnected */ }
    }, 20000);
  }
  function stopKeepalive() { clearInterval(keepaliveTimer); keepaliveTimer = null; }

  async function requestWake() {
    try {
      if (!("wakeLock" in navigator)) throw new Error("unsupported");
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {});
    } catch (e) {
      onToast("Could not keep the screen awake. Disable auto-lock manually.", 6000);
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && (!wakeLock || wakeLock.released)) requestWake(); });

  function subscribeRealtime() {
    if (subscribed) return;
    subscribed = true;
    supabase.channel("print_jobs_agent_" + kinds.join("_") + "_" + agentId.slice(0, 8))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "print_jobs", filter: "status=eq.queued" }, (payload) => {
        if (payload.new) { schedule(payload.new); onJobScheduled(); }
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") console.info("print_jobs realtime subscribed (" + kinds.join(",") + ")"); });
    setInterval(() => { if (transport && !processing) syncQueued(); onJobScheduled(); }, 10000);
  }

  return {
    agentId,
    // connection
    connectBluetooth: (onMultipleCandidates) => connectBle(onMultipleCandidates),
    connectSerial,
    reconnectDefault: async () => {
      const dp = loadDefault();
      if (!dp) return false;
      manualDisconnect = false; stopReconnect();
      if (dp.transportKind === "serial") await connectSerial();
      else if (dp.transportKind === "mock") mockConnect();
      else await connectBle();
      await afterConnect();
      return true;
    },
    mockConnect: () => { mockConnect(); return afterConnect(); },
    disconnect: () => { manualDisconnect = true; stopReconnect(); onTransportLost(); },
    forgetDefault: () => {
      clearDefault(); manualDisconnect = true; stopReconnect();
      if (transport) onTransportLost(); else reportState();
    },
    nudgeReconnect: () => tryAutoConnect(),
    isConnected: () => !!transport,
    isReconnecting: () => reconnecting,
    isSerialSupported: () => "serial" in navigator,
    isBluetoothSupported: () => !!navigator.bluetooth,
    isMockAllowed: () => mockAllowed,
    // lifecycle — call once on page load
    init: async () => {
      subscribeRealtime();
      loadHindiFont();
      const ok = await tryAutoConnect().catch((e) => { agentLog("Auto-connect failed: " + (e.message || e)); return false; });
      if (!ok && loadDefault()) startReconnect();
      reportState();
    },
    // job list (for admin-print-agent.html's table — POS doesn't use this)
    listJobs: (opts) => queueCall({ action: "list", limit: 20, ...opts }),
    cancelJob: (job_id) => queueCall({ action: "cancel", job_id }),
    retryJob: (kind, payload) => queueCall({ action: "enqueue", kind, payload }),
    // debug
    __internals: { renderLabelCanvas, canvasToRaster, canvasToTsplBitmap, sendTsplLabel, loadHindiFont, schedule, get hindiOk() { return hindiOk; } },
  };
}
