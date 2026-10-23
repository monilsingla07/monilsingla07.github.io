// assets/print-queue.js: client helpers for the shop print queue.
// Any admin device enqueues; the agent page (admin-print-agent.html) prints.
import { supabase, SUPABASE_ANON_KEY } from "./supabase.js";

export const PRINT_QUEUE_FN = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/admin-print-queue";

export async function queueCall(body) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token || "";
  const res = await fetch(PRINT_QUEUE_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || "HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function enqueueLabels(serials, layout = "50x50") {
  return queueCall({ action: "enqueue", kind: "label", payload: { serials, layout } });
}

export async function enqueueInvoice(orderId) {
  return queueCall({ action: "enqueue", kind: "invoice", payload: { order_id: orderId } });
}

export async function queuedCount() {
  const r = await queueCall({ action: "list", status: "queued", limit: 1 });
  return r.total || 0;
}

// Mini popover next to `anchor`: primary "Print now", small "Preview labels" link. Calls onShop() / onBrowser().
export function showPrintChoice(anchor, { onShop, onBrowser }) {
  document.querySelectorAll(".pq-pop").forEach((p) => p.remove());
  const pop = document.createElement("div");
  pop.className = "pq-pop";
  pop.style.cssText = "position:absolute;z-index:3000;background:#fff;border:1px solid #d8cfbd;box-shadow:0 4px 14px rgba(0,0,0,.18);padding:6px;display:flex;flex-direction:column;gap:4px;min-width:200px;";
  const mk = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = "font:inherit;font-size:13px;text-align:left;padding:8px 10px;border:0;background:none;cursor:pointer;";
    b.addEventListener("mouseenter", () => { b.style.background = "#f4efe6"; });
    b.addEventListener("mouseleave", () => { b.style.background = "none"; });
    b.addEventListener("click", () => { pop.remove(); fn(); });
    pop.appendChild(b);
  };
  mk("Print now", onShop);
  const pv = document.createElement("a");
  pv.href = "#";
  pv.textContent = "Preview labels";
  pv.style.cssText = "font-size:11px;color:#777;padding:2px 10px 6px;text-decoration:underline;cursor:pointer;";
  pv.addEventListener("click", (e) => { e.preventDefault(); pop.remove(); onBrowser(); });
  pop.appendChild(pv);
  const r = anchor.getBoundingClientRect();
  pop.style.top = window.scrollY + r.bottom + 4 + "px";
  pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 220)) + "px";
  document.body.appendChild(pop);
  const close = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("mousedown", close, true); } };
  setTimeout(() => document.addEventListener("mousedown", close, true), 0);
}
