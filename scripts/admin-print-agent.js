// admin-print-agent.js: the UI for the home QR-label print station. All
// Bluetooth/Serial connection and print_jobs queue logic now lives in
// assets/print-engine.js (shared with admin-pos.js's exhibition billing
// printer widget) — this file just wires that engine's hooks into this
// page's specific DOM.
import { renderHeader, renderFooter, hydrateHeaderAuth, renderAdminBreadcrumb, hydrateAdminBreadcrumb } from "../assets/ui.js";
import { supabase } from "../assets/supabase.js";
import { escapeHtml } from "../assets/safe.js";
import { createPrintEngine } from "../assets/print-engine.js";

document.getElementById("header").innerHTML = renderHeader("admin");
document.getElementById("footer").innerHTML = renderFooter();
hydrateHeaderAuth();
document.getElementById("adminBreadcrumb").innerHTML = renderAdminBreadcrumb("Print Queue");
hydrateAdminBreadcrumb();

function readNumSetting(key, def, min, max) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    if (Number.isFinite(v)) return Math.min(max, Math.max(min, v));
  } catch (_) {}
  return def;
}

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

let toastTimer;
function toast(msg, ms = 4500) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function showGateError(title, message) {
  $("loadingState").style.display = "block";
  $("agent").style.display = "none";
  $("loadingState").innerHTML =
    '<div class="admin-gate"><h3 style="margin:0;">' + escapeHtml(title) + '</h3><div class="small" style="opacity:.8;">' +
    escapeHtml(message) + '</div><a class="btn secondary" href="index.html" style="margin-top:8px;">Go to store</a></div>';
}

const engine = createPrintEngine({
  kinds: ["label", "invoice"],
  getPaperWidth: () => parseInt($("paperWidth").value, 10) || 384,
  onState: (st) => {
    $("statusCard").dataset.state = st.status;
    $("stateText").textContent = st.status[0].toUpperCase() + st.status.slice(1);
    $("deviceName").textContent = st.deviceName || "no device";
    $("defaultName").textContent = st.defaultName || "none";
    const pill = $("defaultPill");
    const pst = st.status === "connected" || st.status === "printing" ? "connected" : st.status === "reconnecting" ? "reconnecting" : "disconnected";
    pill.dataset.state = pst;
    pill.textContent = pst === "connected" ? "Connected" : pst === "reconnecting" ? "Reconnecting…" : "Disconnected";
    $("changePrinter").hidden = !st.hasDefault;
    $("btnDisconnect").hidden = !engine.isConnected();
    $("btnConnect").hidden = engine.isConnected() || st.hasDefault;
    $("btnSerial").hidden = engine.isConnected() || st.hasDefault || !engine.isSerialSupported();
    const canReconnect = !engine.isConnected() && st.hasDefault;
    $("btnReconnect").hidden = !canReconnect;
    if (st.hasDefault) $("btnReconnectName").textContent = st.defaultName || "printer";
    $("queueInfo").textContent = st.queueLength + " queued";
  },
  onLog: (msg) => {
    const line = new Date().toLocaleTimeString() + " " + msg;
    const l = $("agentLog");
    if (!l) return;
    const lines = (l.dataset.lines ? JSON.parse(l.dataset.lines) : []);
    lines.unshift(line);
    if (lines.length > 6) lines.length = 6;
    l.dataset.lines = JSON.stringify(lines);
    l.textContent = lines.join("\n");
    l.style.whiteSpace = "pre-line";
  },
  onToast: (msg, ms) => toast(msg, ms),
  onJobScheduled: () => loadJobs(),
});

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
    const r = await engine.listJobs();
    jobRows = r.rows || [];
  } catch (e) { $("jobsBody").innerHTML = '<tr><td colspan="5" class="pa-empty">Failed to load: ' + escapeHtml(e.message) + "</td></tr>"; return; }
  if (!jobRows.length) { $("jobsBody").innerHTML = '<tr><td colspan="5" class="pa-empty">No jobs yet.</td></tr>'; return; }
  $("jobsBody").innerHTML = jobRows.map((j) =>
    '<tr class="' + (j.status === "failed" ? "failed" : "") + '" data-id="' + escapeHtml(j.id) + '">' +
    "<td>" + escapeHtml(fmtTime(j.created_at)) + "</td><td>" + escapeHtml(j.kind) + "</td><td class=\"mono\">" + escapeHtml(detailOf(j)) + "</td>" +
    '<td><span class="pa-pill ' + escapeHtml(j.status) + '">' + escapeHtml(j.status) + "</span>" +
    (j.failure_reason ? ' <span class="pa-sub">' + escapeHtml(j.failure_reason) + "</span>" : "") + "</td>" +
    "<td>" + (j.status === "failed" ? "Retry" : (j.status === "queued" || j.status === "printing") ? '<a href="#" data-cancel="1">Cancel</a>' : "") + "</td></tr>"
  ).join("");
}

function offerPicker(device, cands, use) {
  const sel = $("svcSelect");
  sel.innerHTML = cands.map((c, i) => '<option value="' + i + '">' + escapeHtml(c.svc.uuid + " / " + c.ch.uuid) + "</option>").join("");
  $("svcPick").hidden = false;
  $("svcUse").onclick = () => {
    const c = cands[parseInt(sel.value, 10)];
    use(c);
    $("svcPick").hidden = true; toast("Using " + c.ch.uuid);
  };
}

function wire() {
  $("agentId").textContent = engine.agentId.slice(0, 8);
  $("agentId").title = engine.agentId;
  $("supportNote").textContent = engine.isBluetoothSupported() ? "" : "Web Bluetooth is not available here (iOS/Safari/Firefox are unsupported). Use Chrome or Edge on Android or desktop.";
  try { const w = localStorage.getItem("ahamstreePaperWidth"); if (w) $("paperWidth").value = w; } catch (_) {}
  $("paperWidth").addEventListener("change", () => { try { localStorage.setItem("ahamstreePaperWidth", $("paperWidth").value); } catch (_) {} });
  for (const [id, def, min, max] of [["labelOffset", 0, -25, 25], ["trailingFeed", 15, 0, 50]]) {
    const el = $(id);
    el.value = readNumSetting(id, def, min, max);
    el.addEventListener("change", () => {
      const v = Math.min(max, Math.max(min, parseFloat(el.value) || 0));
      el.value = v;
      try { localStorage.setItem(id, String(v)); } catch (_) {}
    });
  }
  if (engine.isMockAllowed()) $("btnMock").hidden = false;

  $("btnConnect").addEventListener("click", async () => {
    try { await engine.connectBluetooth(offerPicker); }
    catch (e) { if (e.name !== "NotFoundError") toast(e.message || String(e), 7000); }
  });
  $("btnReconnect").addEventListener("click", async () => {
    try { await engine.reconnectDefault(); }
    catch (e) { if (e.name !== "NotFoundError") toast(e.message || String(e), 7000); }
  });
  $("btnSerial").addEventListener("click", async () => {
    try { await engine.connectSerial(); }
    catch (e) { if (e.name !== "NotFoundError") toast(e.message || String(e), 7000); }
  });
  $("btnMock").addEventListener("click", () => engine.mockConnect());
  $("btnDisconnect").addEventListener("click", () => engine.disconnect());
  $("changePrinter").addEventListener("click", (e) => {
    e.preventDefault();
    engine.forgetDefault();
    toast("Default printer cleared. Pick a new printer with Connect.", 6000);
  });
  $("jobsBody").addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const job = jobRows.find((j) => j.id === tr.dataset.id);
    if (!job) return;
    try {
      if (e.target.closest("[data-cancel]")) {
        e.preventDefault();
        await engine.cancelJob(job.id);
        toast("Cancelled");
      } else if (job.status === "failed") {
        if (!engine.isConnected()) {
          try { await engine.nudgeReconnect(); } catch (_) {}
        }
        await engine.retryJob(job.kind, job.payload);
        toast(engine.isConnected() ? "Re-queued — printing now" : "Re-queued — will print when printer reconnects");
      } else return;
      loadJobs();
    } catch (err) { toast(err.message); }
  });

  window.__printAgent = engine.__internals;
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
    loadJobs();
    await engine.init();
  } catch (e) {
    showGateError("Error", e.message || String(e));
  }
})();
