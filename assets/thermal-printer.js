// assets/thermal-printer.js
//
// Bluetooth thermal-printer support for the admin order list (e.g. the
// SEZNIK DEV, a 2-inch/58mm ESC/POS receipt+label printer). Admin-only —
// not used anywhere on the storefront.
//
// Why Web Serial, not Web Bluetooth: cheap thermal printers like this one
// speak classic Bluetooth (SPP/RFCOMM), not Bluetooth Low Energy — the Web
// Bluetooth API only reaches BLE devices and cannot see this printer at
// all. Chrome/Edge's Web Serial API added support for Bluetooth RFCOMM
// (desktop from Chrome 117, Android in a later release), which is what
// actually lets a webpage open a serial-style connection to a
// classic-Bluetooth device once it's already paired via the OS's own
// Bluetooth settings. Safari and Firefox have no equivalent — this feature
// simply isn't available there (see isThermalPrintingSupported()).
//
// Command set: plain ESC/POS text mode, assumed compatible with this
// printer class (no vendor SDK/datasheet was available to confirm against
// — the very first real test print is what actually proves this). Money
// values are written as "Rs." rather than the ₹ symbol, matching
// admin-generate-invoice's own PDF for the same reason: ₹ (U+20B9) isn't in
// the default ESC/POS codepage most cheap printers ship with, so it would
// print as a blank box or garbage character.

const LINE_WIDTH = 32; // standard for 58mm / 2" thermal printers at default font

// ── ESC/POS command bytes ──
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40], // ESC @  — reset printer to defaults
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_SIZE_ON: [GS, 0x21, 0x11], // double width + height
  DOUBLE_SIZE_OFF: [GS, 0x21, 0x00],
  FEED: (lines) => Array(lines).fill(0x0a),
  // GS V 1 — partial cut. Cheap mini printers usually have no auto-cutter
  // at all; sent anyway (harmless no-op if unsupported), preceded by feed
  // lines so a manual tear doesn't clip the last line of content.
  CUT: [GS, 0x56, 0x01],
};

function textToBytes(str) {
  return Array.from(new TextEncoder().encode(str));
}

// ── Small text-layout helpers (32-char line width) ──
function padRight(s, len) {
  s = String(s ?? "");
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function padLeft(s, len) {
  s = String(s ?? "");
  return s.length >= len ? s.slice(0, len) : " ".repeat(len - s.length) + s;
}

function twoCol(left, right, width = LINE_WIDTH) {
  const rightStr = String(right ?? "");
  const leftMax = Math.max(1, width - rightStr.length - 1);
  const leftStr = String(left ?? "").length > leftMax ? String(left ?? "").slice(0, leftMax) : String(left ?? "");
  return leftStr + " ".repeat(Math.max(1, width - leftStr.length - rightStr.length)) + rightStr;
}

function centered(s, width = LINE_WIDTH) {
  s = String(s ?? "");
  if (s.length >= width) return s.slice(0, width);
  const padTotal = width - s.length;
  const left = Math.floor(padTotal / 2);
  return " ".repeat(left) + s;
}

function rule(width = LINE_WIDTH) {
  return "-".repeat(width);
}

function money(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Wraps a long product title across multiple lines within the item column
// width, so a long saree title doesn't just get silently truncated.
function wrapText(str, width) {
  const words = String(str ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? line + " " + w : w;
    if (candidate.length > width) {
      if (line) lines.push(line);
      line = w.length > width ? w.slice(0, width) : w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// ── Receipt content — deliberately simple; the exact format is expected to
// change once this has actually been tested against the physical printer,
// so every layout decision lives in this one function. ──
export function buildOrderReceiptCommands(order, sellerName = "AhamStree") {
  const bytes = [];
  const push = (arr) => bytes.push(...arr);
  const line = (s = "") => push(textToBytes(s + "\n"));

  push(CMD.INIT);
  push(CMD.ALIGN_CENTER);
  push(CMD.DOUBLE_SIZE_ON);
  line(sellerName);
  push(CMD.DOUBLE_SIZE_OFF);
  line("Eternally Elegant");
  line(rule());

  push(CMD.ALIGN_LEFT);
  const orderRef = order.order_number || `#${String(order.id || "").slice(0, 8).toUpperCase()}`;
  const placedAt = order.created_at
    ? new Date(order.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  line(`Order: ${orderRef}`);
  if (placedAt) line(`Date: ${placedAt}`);
  const paymentLabel = order.payment_method === "manual" ? "In-store payment" : "Razorpay";
  const statusLabel = String(order.status || "").replace(/_/g, " ").toUpperCase();
  line(`Payment: ${paymentLabel} - ${statusLabel}`);
  line(rule());

  const custName = order.shipping_address?.full_name || order.customer_name || "";
  if (custName) line(`Customer: ${custName}`);
  if (order.customer_phone) line(`Ph: ${order.customer_phone}`);
  line(rule());

  push(CMD.BOLD_ON);
  line(twoCol("Item", "Amt"));
  push(CMD.BOLD_OFF);

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  for (const it of items) {
    const qty = Number(it.qty || 0);
    const lineTotal = qty * Number(it.price_inr || 0);
    const titleLines = wrapText(it.title || "Item", LINE_WIDTH - 9);
    titleLines.forEach((tLine, idx) => {
      if (idx === titleLines.length - 1) {
        line(twoCol(`${tLine} x${qty}`, money(lineTotal)));
      } else {
        line(tLine);
      }
    });
  }
  line(rule());

  if (Number(order.discount_inr) > 0) {
    line(twoCol("Subtotal", money(order.subtotal_inr)));
    line(twoCol("Discount", "-" + money(order.discount_inr)));
  } else {
    line(twoCol("Subtotal", money(order.subtotal_inr)));
  }
  line(twoCol("GST", money(order.gst_inr)));
  line(twoCol("Shipping", money(order.shipping_inr)));
  line(rule());

  push(CMD.BOLD_ON);
  push(CMD.DOUBLE_SIZE_ON);
  line(twoCol("TOTAL", money(order.total_inr)));
  push(CMD.DOUBLE_SIZE_OFF);
  push(CMD.BOLD_OFF);
  line(rule());

  push(CMD.ALIGN_CENTER);
  line("Thank you for shopping!");
  push(CMD.FEED(3));
  push(CMD.CUT);

  return new Uint8Array(bytes);
}

// ── Web Serial connection handling ──

export function isThermalPrintingSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

let _port = null;
let _writer = null;

async function closeCurrent() {
  try { _writer?.releaseLock(); } catch (_) {}
  try { await _port?.close(); } catch (_) {}
  _writer = null;
  _port = null;
}

// Silent reconnect: navigator.serial.getPorts() (unlike requestPort())
// doesn't need a user gesture and only ever returns ports this site was
// already granted — so a previously-connected printer can be reopened
// automatically on page load without asking the admin to re-pick it every
// single visit. Returns true if a port was reconnected.
export async function reconnectSavedPrinter() {
  if (!isThermalPrintingSupported()) return false;
  try {
    const ports = await navigator.serial.getPorts();
    if (!ports.length) return false;
    const port = ports[0];
    await port.open({ baudRate: 9600 });
    _port = port;
    _writer = port.writable.getWriter();
    return true;
  } catch (_) {
    await closeCurrent();
    return false;
  }
}

// Must be called from a direct user gesture (a click handler) — this is a
// Web Serial requirement, not something that can be worked around.
export async function connectPrinter() {
  if (!isThermalPrintingSupported()) {
    throw new Error("Bluetooth printing needs Chrome or Edge (desktop or Android) — this browser doesn't support it.");
  }
  await closeCurrent();
  // No filters: the picker lists every serial-capable device the OS knows
  // about, including Bluetooth RFCOMM ports for already-paired classic-
  // Bluetooth devices — which is where the SEZNIK DEV will show up once
  // it's paired in the OS's own Bluetooth settings.
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  _port = port;
  _writer = port.writable.getWriter();
  return true;
}

export function isPrinterConnected() {
  return !!_writer;
}

export async function disconnectPrinter() {
  await closeCurrent();
}

export async function printOrderReceipt(order, sellerName) {
  if (!_writer) {
    const reconnected = await reconnectSavedPrinter();
    if (!reconnected) {
      throw new Error("No printer connected. Click \"Connect printer\" first, then try again.");
    }
  }
  const commands = buildOrderReceiptCommands(order, sellerName);
  await _writer.write(commands);
}
