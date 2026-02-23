// assets/safe.js
// Helpers: escape HTML/text, escape attribute values, and allow-list URLs.

export function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttr(input) {
  // Also remove control chars/newlines which can break attributes
  return escapeHtml(String(input ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ").trim());
}

function hasScheme(u) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(u);
}

function isSafeRelative(u) {
  if (!u) return false;
  // Disallow protocol-relative URLs like //evil.com
  if (u.startsWith("//")) return false;
  // Allow absolute-path or relative-path
  if (u.startsWith("/")) return true;
  if (u.startsWith("./") || u.startsWith("../")) return true;
  // Plain relative without scheme
  return !hasScheme(u);
}

export function safeUrl(raw, { type = "href" } = {}) {
  const u = String(raw ?? "").trim();
  if (!u) return "";

  // Allow same-site relative URLs
  if (isSafeRelative(u)) return u;

  const low = u.toLowerCase();

  // Block common dangerous schemes
  if (low.startsWith("javascript:") || low.startsWith("vbscript:") || low.startsWith("data:text/")) {
    return "";
  }

  if (type === "href") {
    if (low.startsWith("https://") || low.startsWith("http://")) return u;
    if (low.startsWith("mailto:") || low.startsWith("tel:")) return u;
    if (low.startsWith("#")) return u;
    return "";
  }

  // type === "src" (images)
  if (low.startsWith("https://") || low.startsWith("http://")) return u;
  if (low.startsWith("data:image/")) return u;
  return "";
}

export function safeHref(raw) {
  return escapeAttr(safeUrl(raw, { type: "href" }));
}

export function safeSrc(raw) {
  return escapeAttr(safeUrl(raw, { type: "src" }));
}

export function safeCssUrl(raw) {
  // For CSS url(...) contexts. We URL-encode dangerous characters.
  const u = safeUrl(raw, { type: "src" });
  if (!u) return "";
  // Encode quotes and parentheses to avoid breaking out of url('...')
  return encodeURI(u).replace(/'/g, "%27").replace(/\)/g, "%29").replace(/\(/g, "%28");
}
