import { renderHeader, renderFooter, hydrateHeaderAuth, renderAdminBreadcrumb, hydrateAdminBreadcrumb } from "../assets/ui.js";
import { supabase, SUPABASE_ANON_KEY } from "../assets/supabase.js";
import { escapeHtml, escapeAttr } from "../assets/safe.js";
import { toast, confirmDialog } from "../assets/toast.js";
import { openTrap } from "../assets/a11y.js";

document.getElementById("header").innerHTML = renderHeader("admin");
document.getElementById("footer").innerHTML = renderFooter();
hydrateHeaderAuth();
document.getElementById("adminBreadcrumb").innerHTML = renderAdminBreadcrumb("Reviews");
hydrateAdminBreadcrumb();

const BASE = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/";
const REVIEWS_FN = BASE + "admin-manage-reviews";
const PRODUCTS_FN = BASE + "admin-manage-products";
const PAGE_SIZE = 20;

const $ = (id) => document.getElementById(id);
let rows = [];
let total = 0;
let offset = 0;
let editing = null;     // review row being edited
let rejecting = null;   // review row being rejected

async function authedFetch(url, body) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token || "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "HTTP " + res.status);
  return json;
}

function showGateError(title, message) {
  $("loadingState").style.display = "block";
  $("dashboard").style.display = "none";
  $("loadingState").innerHTML =
    '<div class="admin-gate"><h3 style="margin:0;">' + escapeHtml(title) + '</h3><div class="small" style="opacity:.8;">' +
    escapeHtml(message) + '</div><a class="btn secondary" href="index.html" style="margin-top:8px;">Go to store</a></div>';
}

function stars(n) {
  const r = Math.max(0, Math.min(5, Number(n) || 0));
  return '<span class="rv-stars" role="img" aria-label="' + r + ' out of 5 stars">' + "★".repeat(r) + "☆".repeat(5 - r) + "</span>";
}
function when(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function render() {
  const list = $("rvList");
  if (!rows.length) {
    list.innerHTML = '<div class="empty">No reviews match this filter.</div>';
  } else {
    list.innerHTML = rows.map((r) => {
      const body = String(r.body || "");
      const preview = body.length > 300 ? body.slice(0, 300) + "…" : body;
      const st = r.status;
      let actions = "";
      if (st !== "approved") actions += '<button class="btn" data-act="approve" type="button">Approve</button>';
      if (st !== "rejected") actions += '<button class="btn secondary" data-act="reject" type="button">Reject</button>';
      actions += '<button class="btn secondary" data-act="edit" type="button">Edit</button>';
      actions += '<button class="btn secondary" data-act="delete" type="button" style="color:#a13d3d;">Delete</button>';
      return '<article class="rv-card" data-id="' + escapeAttr(r.id) + '">' +
        '<div class="rv-head">' + stars(r.rating) +
        '<span class="rv-title">' + escapeHtml(r.title || "(no title)") + "</span>" +
        '<span class="pill ' + escapeAttr(st) + '">' + escapeHtml(st) + "</span></div>" +
        '<div class="rv-meta">' + escapeHtml(r.customer_name || "—") + " · " + escapeHtml(r.products?.title || "Unknown product") +
        " · " + escapeHtml(when(r.created_at)) + (r.customer_phone ? " · " + escapeHtml(r.customer_phone) : "") + "</div>" +
        (preview ? '<p class="rv-body">' + escapeHtml(preview) + "</p>" : "") +
        (r.admin_notes ? '<div class="rv-note">Note: ' + escapeHtml(r.admin_notes) + "</div>" : "") +
        '<div class="rv-actions">' + actions + "</div></article>";
    }).join("");
  }
  const from = total ? offset + 1 : 0;
  $("pagerInfo").textContent = from + "–" + Math.min(offset + rows.length, total) + " of " + total;
  $("btnPrev").disabled = offset <= 0;
  $("btnNext").disabled = offset + PAGE_SIZE >= total;
}

async function load() {
  const body = { action: "list", status: $("fStatus").value, limit: PAGE_SIZE, offset };
  if ($("fProduct").value) body.product_id = $("fProduct").value;
  try {
    const r = await authedFetch(REVIEWS_FN, body);
    rows = r.rows || [];
    total = r.total || 0;
    render();
  } catch (e) {
    $("rvList").innerHTML = '<div class="empty" style="color:#a13d3d;">Failed to load: ' + escapeHtml(e.message) + "</div>";
  }
}

async function loadProducts() {
  try {
    const r = await authedFetch(PRODUCTS_FN, { action: "list" });
    const opts = (r.products || []).map((p) => ({ id: p.id, title: p.title })).sort((a, b) => a.title.localeCompare(b.title));
    $("fProduct").innerHTML = '<option value="">All products</option>' +
      opts.map((p) => '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.title) + "</option>").join("");
  } catch (_) { /* filter stays "All products" */ }
}

// ── modals ──
let releaseTrap = null;
function openModal(id, focusId) {
  const bg = $(id);
  bg.classList.add("open");
  releaseTrap = openTrap(bg.querySelector(".modal"), { onEscape: () => closeModal(id), initialFocus: $(focusId) });
}
function closeModal(id) {
  $(id).classList.remove("open");
  if (releaseTrap) { releaseTrap(); releaseTrap = null; }
}

async function act(fn, okMsg) {
  try {
    await fn();
    toast({ message: okMsg, kind: "success" });
    await load();
    return true;
  } catch (e) {
    toast({ message: e.message || "Action failed", kind: "error" });
    return false;
  }
}

function wire() {
  $("btnApply").addEventListener("click", () => { offset = 0; load(); });
  $("fStatus").addEventListener("change", () => { offset = 0; load(); });
  $("fProduct").addEventListener("change", () => { offset = 0; load(); });
  $("btnPrev").addEventListener("click", () => { offset = Math.max(0, offset - PAGE_SIZE); load(); });
  $("btnNext").addEventListener("click", () => { offset += PAGE_SIZE; load(); });

  $("rvList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    const card = e.target.closest("[data-id]");
    if (!btn || !card) return;
    const row = rows.find((r) => r.id === card.dataset.id);
    if (!row) return;
    const kind = btn.dataset.act;
    if (kind === "approve") {
      btn.disabled = true;
      await act(() => authedFetch(REVIEWS_FN, { action: "approve", id: row.id }), "Review approved and now live on the product page.");
    } else if (kind === "reject") {
      rejecting = row;
      $("rejectReason").value = "";
      openModal("rejectModal", "rejectReason");
    } else if (kind === "edit") {
      editing = row;
      $("editName").value = row.customer_name || "";
      $("editTitle").value = row.title || "";
      $("editBody").value = row.body || "";
      $("editErr").textContent = "";
      openModal("editModal", "editTitle");
    } else if (kind === "delete") {
      const ok = await confirmDialog({
        title: "Delete this review?", body: "It will be removed permanently. This cannot be undone.",
        confirmLabel: "Delete", focus: "cancel",
      });
      if (ok) await act(() => authedFetch(REVIEWS_FN, { action: "delete", id: row.id }), "Review deleted.");
    }
  });

  $("rejectCancel").addEventListener("click", () => closeModal("rejectModal"));
  $("rejectOk").addEventListener("click", async () => {
    if (!rejecting) return;
    const id = rejecting.id;
    closeModal("rejectModal");
    await act(() => authedFetch(REVIEWS_FN, { action: "reject", id, reason: $("rejectReason").value.trim() || undefined }), "Review rejected.");
  });

  $("editCancel").addEventListener("click", () => closeModal("editModal"));
  $("editSave").addEventListener("click", async () => {
    if (!editing) return;
    const id = editing.id;
    try {
      await authedFetch(REVIEWS_FN, {
        action: "edit", id,
        customer_name: $("editName").value, title: $("editTitle").value, body: $("editBody").value,
      });
    } catch (e) { $("editErr").textContent = e.message || "Save failed."; return; }
    closeModal("editModal");
    toast({ message: "Review updated.", kind: "success" });
    await load();
  });
  ["editModal", "rejectModal"].forEach((id) => $(id).addEventListener("mousedown", (e) => { if (e.target === $(id)) closeModal(id); }));
}

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
    $("dashboard").style.display = "block";
    wire();
    await Promise.all([loadProducts(), load()]);
  } catch (e) {
    showGateError("Error", e.message || String(e));
  }
})();
