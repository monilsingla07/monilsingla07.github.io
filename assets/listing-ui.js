// assets/listing-ui.js
// Shared bits for product listing pages: card metadata line (UX-038) and
// friendly empty / error states (UX-035).
import { escapeHtml } from "./safe.js";

// Extra PostgREST select fragment so cards can show "Fabric · Colour".
// (saree_types is not publicly readable, so it is intentionally not embedded.)
export const CARD_META_SELECT = "colour, fabric:fabrics(name)";

// "{fabric} · {colour}" — omitted entirely when neither is known.
export function cardMetaLine(p) {
  const fabric = (p && p.fabric && p.fabric.name) || "";
  const colour = (p && p.colour) || "";
  const text = [fabric, colour].map((s) => String(s).trim()).filter(Boolean).join(" · ");
  if (!text) return "";
  return `<div class="p-card-meta" title="${escapeHtml(text)}">${escapeHtml(text)}</div>`;
}

// Fallback for pages without filters: "clear" means go back to the base URL.
if (typeof window !== "undefined" && typeof window.clearAllFilters !== "function") {
  window.clearAllFilters = () => { location.href = location.pathname; };
}

export function emptyStateHtml({ filtered = true } = {}) {
  return `<div class="empty-state">
    <h3>${filtered ? "No sarees match these filters" : "Nothing here just yet"}</h3>
    <p>${filtered ? "Try clearing a filter, or browse" : "Please check back soon, or browse"} <a href="products.html">all sarees</a>.</p>
    ${filtered ? `<button type="button" class="btn" onclick="clearAllFilters()">Clear filters</button>` : ""}
  </div>`;
}

export function errorStateHtml() {
  return `<div class="error-state" role="alert">
    <h3>We couldn't load this page</h3>
    <p>Please try again.</p>
    <button type="button" class="btn" onclick="location.reload()">Retry</button>
    <p><a href="contact.html">Need help?</a></p>
  </div>`;
}

// Log the real error for debugging; callers show errorStateHtml() to users.
export function logListingError(where, error) {
  try { console.error("[" + where + "]", error); } catch (_) {}
}
