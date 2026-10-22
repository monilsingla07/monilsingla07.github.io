// Shared rendering helpers for inventory pieces (used by admin-inventory.js
// and the per-SKU Pieces section in admin-products.html).
import { escapeHtml, escapeAttr, safeSrc } from "../assets/safe.js";

export const money = (v) => "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const day = (v) => (v ? String(v).slice(0, 10) : "—");

export function thumbOf(r) {
  const url = r.photo_url || r.products?.product_images?.[0]?.image_url || "";
  const src = safeSrc(url);
  return src && /^https?:/i.test(src)
    ? '<img class="thumb" loading="lazy" alt="" src="' + escapeAttr(src) + '">'
    : '<div class="thumb-empty"></div>';
}

export function statusPill(r) {
  const label = r.status === "in_stock" ? "In stock" : r.status === "sold" ? "Sold" : r.status;
  return '<span class="pill ' + escapeAttr(r.status) + '">' + escapeHtml(label) + "</span>";
}

export function printUrl(serials) {
  if (serials.length > 20) {
    sessionStorage.setItem("inventorySerials", JSON.stringify(serials));
    return "print-labels.html";
  }
  return "print-labels.html?serials=" + encodeURIComponent(serials.join(",")).replace(/%2C/g, ",");
}

// Compact per-SKU rows: thumb, serial, status, intake, cost, weaver.
export function renderPieceRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="7" style="padding:18px; text-align:center; color:var(--text-light);">No pieces yet.</td></tr>';
  }
  return rows.map((r) =>
    '<tr data-id="' + escapeAttr(r.id) + '">' +
    "<td>" + thumbOf(r) + "</td>" +
    '<td class="mono">' + escapeHtml(r.serial) + "</td>" +
    "<td>" + statusPill(r) + "</td>" +
    "<td>" + escapeHtml(day(r.intake_date)) + "</td>" +
    "<td>" + money(r.cost_price) + "</td>" +
    "<td>" + escapeHtml(r.weaver_name || "—") + "</td>" +
    '<td><button class="btn secondary" type="button" data-reprint="' + escapeAttr(r.serial) + '" style="padding:4px 9px; font-size:12px;">Reprint</button></td></tr>'
  ).join("");
}

export function pieceSummary(inStock, sold, total) {
  return inStock + " in stock, " + sold + " sold, " + total + " total";
}
