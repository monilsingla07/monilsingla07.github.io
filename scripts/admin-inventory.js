import { renderHeader, renderFooter, hydrateHeaderAuth, renderAdminBreadcrumb, hydrateAdminBreadcrumb } from "../assets/ui.js";
import { supabase, SUPABASE_ANON_KEY } from "../assets/supabase.js";
import { escapeHtml, escapeAttr } from "../assets/safe.js";
import { money, day, thumbOf, printUrl } from "./inventory-rows.js";
import { resizeImageFile, IMAGE_PRESETS } from "../assets/image-resize.js";
import { enqueueLabels, queuedCount, showPrintChoice } from "../assets/print-queue.js";
import { listTagOptions, createTagOption, updateTagOption, deleteTagOption, fillSelect } from "./tag-options.js";

document.getElementById("header").innerHTML = renderHeader("admin");
document.getElementById("footer").innerHTML = renderFooter();
hydrateHeaderAuth();
document.getElementById("adminBreadcrumb").innerHTML = renderAdminBreadcrumb("Inventory");
hydrateAdminBreadcrumb();

const BASE = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/";
const INV_FN = BASE + "admin-manage-inventory";
const PRODUCTS_FN = BASE + "admin-manage-products";
const STATS_FN = BASE + "inventory-stats";
const PAGE_SIZE = 50;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const $ = (id) => document.getElementById(id);
const loadingState = $("loadingState");
const dashboard = $("dashboard");

let products = [];          // [{id,title,price_inr,...}]
let rows = [];              // currently loaded ledger page
let total = 0;
let offset = 0;
let selected = new Set();   // ids of in-stock pieces checked for bulk delete
let chosen = null;          // {id,title} | {isNew:true}
let editingId = null;
let tagOpts = { saree_type: [], care_instruction: [] };   // active options for the Add modal dropdowns
let origTags = { saree_type_id: null, care_instruction_id: null }; // stored values on the picked SKU

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
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
  if (!res.ok) throw new HttpError(res.status, json.error || "HTTP " + res.status);
  return json;
}


let toastTimer;
function toast(html, ms = 6000) {
  const t = $("toast");
  t.innerHTML = html;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function showGateError(title, message) {
  loadingState.style.display = "block";
  dashboard.style.display = "none";
  loadingState.innerHTML =
    '<div class="admin-gate"><h3 style="margin:0;">' + escapeHtml(title) + '</h3><div class="small" style="opacity:.8;">' +
    escapeHtml(message) + '</div><a class="btn secondary" href="index.html" style="margin-top:8px;">Go to store</a></div>';
}

// ───────────────────────────── KPIs ─────────────────────────────
async function loadStats() {
  const set = (id, v) => { $(id).textContent = v; };
  try {
    const s = await authedFetch(STATS_FN, {});
    const pick = (...keys) => { for (const k of keys) if (s[k] !== undefined && s[k] !== null) return s[k]; return undefined; };
    const inStock = pick("in_stock", "in_stock_count");
    const value = pick("inventory_value", "value_at_cost", "inventory_value_at_cost");
    const added = pick("added_this_month", "added_mtd");
    const sold = pick("sold_this_month", "sold_mtd");
    if (inStock === undefined && value === undefined) throw new Error("unexpected shape");
    set("kpiInStock", inStock ?? "—");
    set("kpiValue", value === undefined ? "—" : money(value));
    set("kpiAdded", added ?? "—");
    set("kpiSold", sold ?? "—");
    $("kpiNote").textContent = "";
  } catch (_) {
    ["kpiInStock", "kpiValue", "kpiAdded", "kpiSold"].forEach((id) => set(id, "—"));
    $("kpiNote").textContent = "Stats not available yet.";
  }
}

// ───────────────────────────── Ledger ─────────────────────────────
function filters() {
  const f = { limit: PAGE_SIZE, offset };
  if ($("fStatus").value) f.status = $("fStatus").value;
  if ($("fSku").value) f.product_id = $("fSku").value;
  if ($("fWeaver").value.trim()) f.weaver = $("fWeaver").value.trim();
  if ($("fFrom").value) f.date_from = $("fFrom").value;
  if ($("fTo").value) f.date_to = $("fTo").value;
  if ($("fSerial").value.trim()) f.serial_contains = $("fSerial").value.trim();
  return f;
}

function updateBulkBar() {
  const n = selected.size;
  $("bulkBar").style.display = n ? "flex" : "none";
  $("bulkCount").textContent = n + (n === 1 ? " piece selected" : " pieces selected");
  const inStockIdsOnPage = rows.filter((r) => r.status === "in_stock").map((r) => r.id);
  $("selectAll").checked = inStockIdsOnPage.length > 0 && inStockIdsOnPage.every((id) => selected.has(id));
}

function renderLedger() {
  const body = $("ledgerBody");
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="12" style="padding:24px; text-align:center; color:var(--text-light);">No pieces match.</td></tr>';
  } else {
    body.innerHTML = rows.map((r) => {
      const inStock = r.status === "in_stock";
      const actions = inStock
        ? '<button class="btn secondary" data-act="reprint" type="button">Reprint QR</button>' +
          '<button class="btn secondary" data-act="edit" type="button">Edit</button>' +
          '<button class="btn secondary" data-act="delete" type="button" style="color:#a13d3d;">Delete</button>'
        : "";
      const order = r.order_id
        ? '<a href="admin-orders.html?id=' + encodeURIComponent(r.order_id) + '" class="small">View order</a>'
        : "—";
      const check = inStock
        ? '<input type="checkbox" class="rowSel"' + (selected.has(r.id) ? " checked" : "") + " />"
        : '<input type="checkbox" disabled title="Only in-stock pieces can be deleted" />';
      return '<tr data-id="' + escapeAttr(r.id) + '">' +
        "<td>" + check + "</td>" +
        "<td>" + thumbOf(r) + "</td>" +
        '<td class="mono">' + escapeHtml(r.serial) + "</td>" +
        "<td>" + escapeHtml(r.products?.title || "—") + "</td>" +
        '<td><span class="pill ' + escapeAttr(r.status) + '">' + escapeHtml(inStock ? "In stock" : r.status === "sold" ? "Sold" : r.status) + "</span></td>" +
        "<td>" + money(r.cost_price) + "</td>" +
        "<td>" + escapeHtml(r.weaver_name || "—") + "</td>" +
        "<td>" + escapeHtml(day(r.intake_date)) + "</td>" +
        "<td>" + escapeHtml(day(r.sold_at)) + "</td>" +
        "<td>" + escapeHtml(r.sold_via || "—") + "</td>" +
        "<td>" + order + "</td>" +
        '<td><div class="row-actions">' + actions + "</div></td></tr>";
    }).join("");
  }
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + rows.length, total);
  $("pagerInfo").textContent = from + "–" + to + " of " + total;
  $("btnPrev").disabled = offset <= 0;
  $("btnNext").disabled = offset + PAGE_SIZE >= total;
  updateBulkBar();
}

async function loadLedger() {
  selected.clear();
  try {
    const r = await authedFetch(INV_FN, { action: "list", ...filters() });
    rows = r.rows || [];
    total = r.total || 0;
    renderLedger();
  } catch (e) {
    $("ledgerBody").innerHTML = '<tr><td colspan="12" style="padding:24px; color:#a13d3d;">Failed to load: ' + escapeHtml(e.message) + "</td></tr>";
  }
}

function applyFilters() { offset = 0; loadLedger(); }

async function bulkDelete() {
  const ids = Array.from(selected);
  if (!ids.length) return;
  if (!window.confirm("Delete " + ids.length + " selected piece(s)? This cannot be undone.")) return;
  $("btnBulkDelete").disabled = true;
  try {
    const r = await authedFetch(INV_FN, { action: "bulk_delete", ids });
    const skipped = r.skipped || [];
    if (skipped.length) {
      toast("Deleted " + r.deleted + ". Skipped " + skipped.length + " (already sold or removed by someone else).");
    } else {
      toast("Deleted " + r.deleted + " piece(s).");
    }
    selected.clear();
    await Promise.all([loadLedger(), loadStats()]);
  } catch (e) {
    toast(escapeHtml(e.message));
  } finally {
    $("btnBulkDelete").disabled = false;
  }
}

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv() {
  const head = ["serial", "product", "status", "cost_price", "weaver", "intake_date", "sold_at", "sold_via", "order_id"];
  const lines = [head.join(",")].concat(rows.map((r) =>
    [r.serial, r.products?.title, r.status, r.cost_price, r.weaver_name, day(r.intake_date), r.sold_at ? day(r.sold_at) : "", r.sold_via, r.order_id].map(csvCell).join(",")));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "inventory-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ───────────────────────────── Printing ─────────────────────────────
function openPrint(serials) {
  const url = printUrl(serials);
  const w = window.open(url, "_blank");
  return !!w;
}

async function printToShop(serials) {
  try {
    const r = await enqueueLabels(serials, "50x50");
    toast("Printing now (job " + escapeHtml(String(r.job_id).slice(0, 8)) + ").");
    loadQueueWidget();
  } catch (e) { toast("Could not queue: " + escapeHtml(e.message)); }
}

async function loadQueueWidget() {
  if (!$("pqWidget")) return;
  try {
    const n = await queuedCount();
    $("pqCount").textContent = n + (n === 1 ? " job queued" : " jobs queued");
  } catch (_) { $("pqCount").textContent = "Print queue"; }
}

// ───────────────────────────── Products ─────────────────────────────
async function loadProducts() {
  try {
    const r = await authedFetch(PRODUCTS_FN, { action: "list" });
    products = (r.products || []).map((p) => ({ id: p.id, title: p.title, price_inr: p.price_inr }));
  } catch (_) {
    products = [];
  }
  const sel = $("fSku");
  sel.innerHTML = '<option value="">All SKUs</option>' +
    products.map((p) => '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.title) + "</option>").join("");
}

// ───────────────────────────── Image upload ─────────────────────────────
// The inventory-pieces bucket is private and has no upload endpoint, so photos
// go through the same signed-upload slot as product photos (public bucket).
async function uploadPhoto(file) {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("Photo must be JPG, PNG or WEBP.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo is over 8MB.");
  const optimized = await resizeImageFile(file, IMAGE_PRESETS.productPhoto || {});
  const slot = await authedFetch(PRODUCTS_FN, { action: "get_upload_url", content_type: optimized.type });
  const { error } = await supabase.storage.from("product-images").uploadToSignedUrl(slot.path, slot.token, optimized);
  if (error) throw new Error("Photo upload failed: " + error.message);
  return slot.publicUrl;
}

// ───────────────────────────── Add modal ─────────────────────────────
function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }

function updateSubmitLabel() {
  // Two fixed-label submit buttons ("Save & print now" / "Save (print later)").
  $("addSubmit").textContent = "Save & print now";
  $("addSaveLater").textContent = "Save (print later)";
}

function renderSkuList() {
  const q = $("addSkuInput").value.trim().toLowerCase();
  const matches = products.filter((p) => !q || (p.title || "").toLowerCase().includes(q)).slice(0, 60);
  $("addSkuList").innerHTML =
    '<div class="combo-item new" data-new="1">+ Create new SKU' + (q ? ': “' + escapeHtml($("addSkuInput").value.trim()) + "”" : "") + "</div>" +
    matches.map((p) => '<div class="combo-item" data-pid="' + escapeAttr(p.id) + '"><span>' + escapeHtml(p.title) +
      '</span><span class="small">' + money(p.price_inr) + "</span></div>").join("");
  $("addSkuList").classList.add("open");
}

function chooseSku(c) {
  chosen = c;
  $("addSkuList").classList.remove("open");
  $("newSkuForm").style.display = c.isNew ? "block" : "none";
  pickedSkuTags(c);
  if (c.isNew) {
    $("addSkuInput").value = "";
    $("addSkuInput").placeholder = "New SKU";
    $("addSkuChosen").textContent = "Creating a new SKU.";
    if (c.title) $("nsTitle").value = c.title;
  } else {
    $("addSkuInput").value = c.title;
    $("addSkuChosen").textContent = "Selected: " + c.title;
  }
}

// ───────────────────────────── Tag dropdowns (Add modal) ─────────────────────────────
const TAG_SEL = {
  saree_type: { sel: "addSareeType", form: "addSareeTypeForm", addLabel: "+ Add new saree type" },
  care_instruction: { sel: "addCare", form: "addCareForm", addLabel: "+ Add new care instruction" },
};

function renderTagSelect(kind, selected) {
  const c = TAG_SEL[kind];
  fillSelect($(c.sel), tagOpts[kind], selected, { addNewLabel: c.addLabel });
  $(c.form).style.display = "none";
}

async function loadTagOpts() {
  await Promise.all(Object.keys(TAG_SEL).map(async (kind) => {
    try { tagOpts[kind] = (await listTagOptions(authedFetch, kind)).filter((r) => r.is_active !== false); }
    catch (_) { tagOpts[kind] = []; }
    renderTagSelect(kind, "");
  }));
}

function selectedTag(kind) {
  const v = $(TAG_SEL[kind].sel).value;
  return v && v !== "__new__" ? v : null;
}

async function saveInlineTag(kind) {
  const err = $("addErr");
  err.textContent = "";
  const fields = kind === "saree_type"
    ? { name: $("addSareeTypeName").value.trim() }
    : { name: $("addCareName").value.trim(), text: $("addCareText").value.trim() };
  if (!fields.name) { err.textContent = "Enter a name."; return; }
  if (kind === "care_instruction" && !fields.text) fields.text = fields.name;
  try {
    const row = await createTagOption(authedFetch, kind, fields);
    tagOpts[kind] = tagOpts[kind].concat(row);
    renderTagSelect(kind, row.id);
    ["addSareeTypeName", "addCareName", "addCareText"].forEach((id) => { $(id).value = ""; });
  } catch (e) { err.textContent = e.message || "Failed to save."; }
}

async function pickedSkuTags(c) {
  origTags = { saree_type_id: null, care_instruction_id: null };
  renderTagSelect("saree_type", "");
  renderTagSelect("care_instruction", "");
  if (!c || c.isNew || !c.id) return;
  try {
    const r = await authedFetch(PRODUCTS_FN, { action: "get", id: c.id });
    if (!chosen || chosen.id !== c.id) return; // user moved on
    origTags = { saree_type_id: r.product.saree_type_id || null, care_instruction_id: r.product.care_instruction_id || null };
    renderTagSelect("saree_type", origTags.saree_type_id || "");
    renderTagSelect("care_instruction", origTags.care_instruction_id || "");
  } catch (_) { /* leave blank; submit will treat as unchanged only if still blank */ }
}

function resetAddModal() {
  chosen = null;
  ["addSkuInput", "addCost", "addWeaver", "nsTitle", "nsPrice"].forEach((id) => { $(id).value = ""; });
  $("addQty").value = "1";
  ["addPhoto", "nsThumb"].forEach((id) => { $(id).value = ""; });
  $("addSkuChosen").textContent = "";
  $("addSkuInput").placeholder = "Search products or create a new SKU…";
  $("newSkuForm").style.display = "none";
  $("addErr").textContent = "";
  $("addSubmit").disabled = false;
  $("addSaveLater").disabled = false;
  origTags = { saree_type_id: null, care_instruction_id: null };
  ["saree_type", "care_instruction"].forEach((k) => renderTagSelect(k, ""));
  ["addSareeTypeName", "addCareName", "addCareText"].forEach((id) => { $(id).value = ""; });
  updateSubmitLabel();
}

async function submitAdd(printNow) {
  const err = $("addErr");
  err.textContent = "";
  const qty = parseInt($("addQty").value, 10);
  const cost = parseFloat($("addCost").value);
  if (!chosen) { err.textContent = "Pick a SKU or create a new one."; return; }
  if (!Number.isInteger(qty) || qty < 1) { err.textContent = "Quantity must be 1 or more."; return; }
  if (!Number.isFinite(cost) || cost < 0) { err.textContent = "Enter the cost price."; return; }
  const btn = $("addSubmit"), btn2 = $("addSaveLater");
  btn.disabled = true; btn2.disabled = true;
  try {
    const payload = { action: "create", qty, cost_price: cost };
    const weaver = $("addWeaver").value.trim();
    if (weaver) payload.weaver_name = weaver;
    const photo = await uploadPhoto($("addPhoto").files[0]);
    if (photo) payload.photo_url = photo;

    if (chosen.isNew) {
      const title = $("nsTitle").value.trim();
      const price = parseInt($("nsPrice").value, 10);
      if (!title) throw new Error("Enter a title for the new SKU.");
      if (!Number.isInteger(price) || price < 0) throw new Error("Enter a selling price for the new SKU.");
      // admin-manage-inventory contract: new_sku = { name, selling_price, thumbnail_url? }
      payload.new_sku = { name: title, selling_price: price };
      const thumb = await uploadPhoto($("nsThumb").files[0]);
      if (thumb) payload.new_sku.thumbnail_url = thumb;
    } else {
      payload.product_id = chosen.id;
    }

    const tagIds = { saree_type_id: selectedTag("saree_type"), care_instruction_id: selectedTag("care_instruction") };
    const tagsChanged = tagIds.saree_type_id !== origTags.saree_type_id || tagIds.care_instruction_id !== origTags.care_instruction_id;
    // Existing SKU: update the FKs BEFORE creating pieces (only if changed).
    if (!chosen.isNew && tagsChanged) {
      await authedFetch(PRODUCTS_FN, { action: "save", id: chosen.id, ...tagIds });
      origTags = { ...tagIds };
    }

    let res;
    try {
      res = await authedFetch(INV_FN, payload);
    } catch (e) {
      if (e.status === 409 && !chosen.isNew) {
        if (!window.confirm("Enable inventory management for '" + chosen.title + "'? This switches the SKU to piece-tracked stock. Continue?")) {
          err.textContent = "Cancelled — this SKU is not inventory-managed.";
          return;
        }
        await authedFetch(PRODUCTS_FN, { action: "set_inventory_managed", id: chosen.id, inventory_managed: true });
        res = await authedFetch(INV_FN, payload);
      } else {
        throw e;
      }
    }

    // New SKU: attach the FKs right after the product exists.
    let tagWarn = "";
    if (chosen.isNew && (tagIds.saree_type_id || tagIds.care_instruction_id) && res.product_id) {
      try { await authedFetch(PRODUCTS_FN, { action: "save", id: res.product_id, ...tagIds }); }
      catch (e) { tagWarn = " (tags not saved: " + e.message + " — set them in Products)"; }
    }

    closeModal("addModal");
    const serials = res.serials || [];
    const n = serials.length, pieces = "Added " + n + " piece" + (n === 1 ? "" : "s");
    const prev = ' <a id="toastPrint" style="font-size:11px;opacity:.8;cursor:pointer;">Preview labels</a>';
    if (printNow && n) {
      try {
        await enqueueLabels(serials, "50x50");
        toast(pieces + ". Printing now." + escapeHtml(tagWarn) + prev, 10000);
        loadQueueWidget();
      } catch (e) {
        toast(pieces + ", but could not queue printing: " + escapeHtml(e.message) + ". Reprint from the ledger." + escapeHtml(tagWarn) + prev, 12000);
      }
      const tp = $("toastPrint");
      if (tp) tp.addEventListener("click", () => openPrint(serials));
    } else {
      toast(pieces + ". Reprint from the ledger when you're ready." + escapeHtml(tagWarn), 10000);
    }
    await loadProducts();
    offset = 0;
    await Promise.all([loadLedger(), loadStats()]);
  } catch (e) {
    err.textContent = e.message || "Failed to add inventory.";
  } finally {
    btn.disabled = false; btn2.disabled = false;
  }
}

// ───────────────────────────── Manage tag options modal ─────────────────────────────
let tagsKind = "saree_type";
let tagsRows = [];

async function loadTagsTable() {
  const body = $("tagsBody");
  $("tagsErr").textContent = "";
  try {
    tagsRows = await listTagOptions(authedFetch, tagsKind, true);
  } catch (e) {
    body.innerHTML = '<div class="err">Failed to load: ' + escapeHtml(e.message) + "</div>";
    return;
  }
  const care = tagsKind === "care_instruction";
  const head = "<th>Name</th>" + (care ? "<th>Text</th>" : "") + '<th style="width:80px;">Order</th><th style="width:60px;">Active</th><th style="width:70px;"></th>';
  const rowsHtml = tagsRows.map((r) =>
    '<tr data-id="' + escapeAttr(r.id) + '">' +
    '<td><input class="input" data-f="name" type="text" value="' + escapeAttr(r.name) + '" /></td>' +
    (care ? '<td><input class="input" data-f="text" type="text" value="' + escapeAttr(r.text || "") + '" /></td>' : "") +
    '<td><input class="input ord" data-f="display_order" type="number" step="1" value="' + escapeAttr(r.display_order ?? 0) + '" /></td>' +
    '<td style="text-align:center;"><input data-f="is_active" type="checkbox"' + (r.is_active !== false ? " checked" : "") + " /></td>" +
    '<td><button class="btn secondary" data-del="1" type="button" style="padding:4px 9px; font-size:12px; color:#a13d3d;">Delete</button></td></tr>'
  ).join("") || '<tr><td colspan="5" style="padding:14px; color:var(--text-light);">None yet.</td></tr>';
  const addRow = '<tr data-new="1">' +
    '<td><input class="input" data-f="name" type="text" placeholder="+ Add new — name" /></td>' +
    (care ? '<td><input class="input" data-f="text" type="text" placeholder="Label text" /></td>' : "") +
    '<td colspan="' + (care ? 1 : 1) + '"></td><td></td>' +
    '<td><button class="btn" data-add="1" type="button" style="padding:4px 9px; font-size:12px;">Save</button></td></tr>';
  body.innerHTML = '<table class="tags"><thead><tr>' + head + "</tr></thead><tbody>" + rowsHtml + addRow + "</tbody></table>";
}

async function tagsCommit(tr, input) {
  const id = tr.dataset.id;
  const f = input.dataset.f;
  let v = input.type === "checkbox" ? input.checked : input.value.trim();
  if (f === "display_order") v = parseInt(v, 10) || 0;
  if (f === "name" && !v) { $("tagsErr").textContent = "Name cannot be empty."; return loadTagsTable(); }
  try {
    await updateTagOption(authedFetch, tagsKind, id, { [f]: v });
    await loadTagsTable();
  } catch (e) { $("tagsErr").textContent = e.message || "Update failed."; }
}

async function tagsAdd(tr) {
  const fields = {};
  tr.querySelectorAll("input[data-f]").forEach((i) => { fields[i.dataset.f] = i.value.trim(); });
  if (!fields.name) { $("tagsErr").textContent = "Enter a name."; return; }
  if (tagsKind === "care_instruction" && !fields.text) fields.text = fields.name;
  try {
    await createTagOption(authedFetch, tagsKind, fields);
    await loadTagsTable();
  } catch (e) { $("tagsErr").textContent = e.message || "Create failed."; }
}

function openTagsModal() { $("tagsErr").textContent = ""; openModal("tagsModal"); loadTagsTable(); }

// ───────────────────────────── Row actions ─────────────────────────────
async function rowAction(act, row, anchor) {
  if (act === "reprint") {
    const run = async (shop) => {
      try {
        const r = await authedFetch(INV_FN, { action: "reprint", ids: [row.id] });
        const serials = r.serials || [row.serial];
        if (shop) await printToShop(serials);
        else if (!openPrint(serials)) toast("Popup blocked — allow popups to print.");
      } catch (e) { toast(escapeHtml(e.message)); }
    };
    showPrintChoice(anchor, { onShop: () => run(true), onBrowser: () => run(false) });
  } else if (act === "edit") {
    editingId = row.id;
    $("editSerial").textContent = row.serial + " — " + (row.products?.title || "");
    $("editCost").value = row.cost_price ?? "";
    $("editWeaver").value = row.weaver_name || "";
    $("editPhoto").value = "";
    $("editErr").textContent = "";
    openModal("editModal");
  } else if (act === "delete") {
    if (!window.confirm("Delete piece " + row.serial + "? This cannot be undone.")) return;
    try {
      await authedFetch(INV_FN, { action: "delete", id: row.id });
      toast("Deleted " + escapeHtml(row.serial));
      await Promise.all([loadLedger(), loadStats()]);
    } catch (e) { toast(escapeHtml(e.message)); }
  }
}

async function saveEdit() {
  const err = $("editErr");
  err.textContent = "";
  const cost = parseFloat($("editCost").value);
  if (!Number.isFinite(cost) || cost < 0) { err.textContent = "Enter a valid cost price."; return; }
  const btn = $("editSave");
  btn.disabled = true;
  try {
    const payload = { action: "update", id: editingId, cost_price: cost, weaver_name: $("editWeaver").value.trim() };
    const photo = await uploadPhoto($("editPhoto").files[0]);
    if (photo) payload.photo_url = photo;
    await authedFetch(INV_FN, payload);
    closeModal("editModal");
    toast("Piece updated");
    await Promise.all([loadLedger(), loadStats()]);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

// ───────────────────────────── Wiring ─────────────────────────────
function wire() {
  $("btnApply").addEventListener("click", applyFilters);
  $("btnReset").addEventListener("click", () => {
    ["fStatus", "fSku", "fWeaver", "fFrom", "fTo", "fSerial"].forEach((id) => { $(id).value = ""; });
    applyFilters();
  });
  ["fStatus", "fSku", "fFrom", "fTo"].forEach((id) => $(id).addEventListener("change", applyFilters));
  ["fWeaver", "fSerial"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") applyFilters(); }));
  $("btnPrev").addEventListener("click", () => { offset = Math.max(0, offset - PAGE_SIZE); loadLedger(); });
  $("btnNext").addEventListener("click", () => { offset += PAGE_SIZE; loadLedger(); });
  $("btnExport").addEventListener("click", exportCsv);

  $("ledgerBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const tr = btn.closest("tr[data-id]");
    const row = rows.find((r) => r.id === tr.dataset.id);
    if (row) rowAction(btn.dataset.act, row, btn);
  });
  $("ledgerBody").addEventListener("change", (e) => {
    const box = e.target.closest("input.rowSel");
    if (!box) return;
    const tr = box.closest("tr[data-id]");
    if (box.checked) selected.add(tr.dataset.id);
    else selected.delete(tr.dataset.id);
    updateBulkBar();
  });
  $("selectAll").addEventListener("change", () => {
    const checked = $("selectAll").checked;
    rows.filter((r) => r.status === "in_stock").forEach((r) => {
      if (checked) selected.add(r.id); else selected.delete(r.id);
    });
    renderLedger();
  });
  $("btnBulkDelete").addEventListener("click", bulkDelete);

  $("btnAdd").addEventListener("click", () => { resetAddModal(); openModal("addModal"); });
  $("addCancel").addEventListener("click", () => closeModal("addModal"));
  $("addSubmit").addEventListener("click", () => submitAdd(true));
  $("addSaveLater").addEventListener("click", () => submitAdd(false));
  $("addQty").addEventListener("input", updateSubmitLabel);
  $("addSkuInput").addEventListener("focus", renderSkuList);
  $("addSkuInput").addEventListener("input", () => { chosen = null; $("addSkuChosen").textContent = ""; $("newSkuForm").style.display = "none"; renderSkuList(); });
  $("addSkuList").addEventListener("click", (e) => {
    const item = e.target.closest(".combo-item");
    if (!item) return;
    if (item.dataset.new) chooseSku({ isNew: true, title: $("addSkuInput").value.trim() });
    else chooseSku({ id: item.dataset.pid, title: (products.find((p) => p.id === item.dataset.pid) || {}).title || "" });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".combo")) $("addSkuList").classList.remove("open"); });

  $("addSareeType").addEventListener("change", () => { $("addSareeTypeForm").style.display = $("addSareeType").value === "__new__" ? "block" : "none"; });
  $("addCare").addEventListener("change", () => { $("addCareForm").style.display = $("addCare").value === "__new__" ? "block" : "none"; });
  $("addSareeTypeSave").addEventListener("click", () => saveInlineTag("saree_type"));
  $("addCareSave").addEventListener("click", () => saveInlineTag("care_instruction"));
  $("addSareeTypeCancel").addEventListener("click", () => renderTagSelect("saree_type", ""));
  $("addCareCancel").addEventListener("click", () => renderTagSelect("care_instruction", ""));

  $("btnTags").addEventListener("click", openTagsModal);
  $("tagsClose").addEventListener("click", () => { closeModal("tagsModal"); loadTagOpts(); });
  document.querySelectorAll("#tagsModal .tab-btn").forEach((b) => b.addEventListener("click", () => {
    tagsKind = b.dataset.kind;
    document.querySelectorAll("#tagsModal .tab-btn").forEach((x) => x.classList.toggle("active", x === b));
    loadTagsTable();
  }));
  $("tagsBody").addEventListener("change", (e) => {
    const input = e.target.closest("input[data-f]");
    const tr = e.target.closest("tr[data-id]");
    if (input && tr) tagsCommit(tr, input);
  });
  $("tagsBody").addEventListener("click", async (e) => {
    const add = e.target.closest("button[data-add]");
    if (add) return tagsAdd(add.closest("tr"));
    const del = e.target.closest("button[data-del]");
    if (del) {
      const tr = del.closest("tr[data-id]");
      const row = tagsRows.find((r) => r.id === tr.dataset.id);
      if (!window.confirm("Delete '" + (row ? row.name : "this option") + "'?")) return;
      try { await deleteTagOption(authedFetch, tagsKind, tr.dataset.id); await loadTagsTable(); }
      catch (err) { $("tagsErr").textContent = err.message || "Delete failed."; }
    }
  });
  $("tagsBody").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest("tr[data-new]")) tagsAdd(e.target.closest("tr"));
  });

  $("editCancel").addEventListener("click", () => closeModal("editModal"));
  $("editSave").addEventListener("click", saveEdit);
  ["addModal", "editModal", "tagsModal"].forEach((id) => $(id).addEventListener("mousedown", (e) => { if (e.target === $(id)) closeModal(id); }));
}

// ───────────────────────────── Boot ─────────────────────────────
(async function init() {
  try {
    const sess = await supabase.auth.getSession();
    if (sess.error) return showGateError("Auth Error", sess.error.message);
    if (!sess.data || !sess.data.session) { window.location.href = "login.html"; return; }
    const email = (sess.data.session.user.email || "").toLowerCase();
    const adm = await supabase.from("admin_users").select("email").eq("email", email).maybeSingle();
    if (adm.error) return showGateError("Error", adm.error.message);
    if (!adm.data) return showGateError("Access Denied", "Your account does not have admin access.");
    loadingState.style.display = "none";
    dashboard.style.display = "block";
    wire();
    await Promise.all([loadProducts(), loadLedger(), loadStats(), loadTagOpts(), loadQueueWidget()]);
  } catch (e) {
    showGateError("Error", e.message || String(e));
  }
})();
