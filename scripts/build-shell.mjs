// scripts/build-shell.mjs  (UX-026)
//
// Pre-renders the site header + footer into every customer-facing page so the
// first paint has navigation even if the JS module graph is slow or fails.
// assets/ui.js stays the single source of truth for the markup; this script
// imports renderHeader()/renderFooter() under minimal browser stubs and
// writes their output between marker comments in each page:
//
//   <div id="header"><!--shell:header-->...<!--/shell:header--></div>
//   <div id="footer"><!--shell:footer-->...<!--/shell:footer--></div>
//
// The page's own module script still assigns innerHTML on load (identical
// markup), then hydrateHeaderAuth() upgrades the dynamic bits (login state,
// cart badge, nav tree, wishlist link). Re-run after editing the header or
// footer in ui.js:   node scripts/build-shell.mjs
//
// Admin pages (admin*.html, print-*.html) are skipped on purpose.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── minimal browser stubs so ui.js and its imports can load under Node ──
const store = new Map();
globalThis.localStorage = globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};
const noop = () => {};
globalThis.document = {
  readyState: "complete",
  addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop }),
  documentElement: { style: { setProperty: noop } },
  body: null, head: null,
};
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.removeEventListener = noop;
globalThis.location = { href: "http://localhost/", search: "", pathname: "/", hash: "", origin: "http://localhost" };
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
globalThis.navigator ??= { userAgent: "node" };

const { renderHeader, renderFooter } = await import(pathToFileURL(path.join(root, "assets/ui.js")).href);

const SKIP = /^(admin|print-)/;
const files = readdirSync(root).filter((f) => f.endsWith(".html") && !SKIP.test(f));

// products.html picks its marker at runtime from ?type=; the static shell
// uses the default ("products"), hydration corrects it.
let changed = 0;
for (const f of files) {
  const p = path.join(root, f);
  let html = readFileSync(p, "utf8");
  // Pages that never call renderHeader() (checkout is deliberately header-less)
  // keep their empty slot.
  if (!/<div id="header"/.test(html) || !/renderHeader\(/.test(html)) continue;

  // Which marker does this page pass to renderHeader()?
  const m = html.match(/renderHeader\(\s*(?:"([^"]*)")?/);
  const active = m && m[1] ? m[1] : /renderHeader\(\s*\(/.test(html) ? "products" : "";

  const header = `<!--shell:header-->${slim(renderHeader(active))}<!--/shell:header-->`;
  const footer = `<!--shell:footer-->${slim(renderFooter())}<!--/shell:footer-->`;

  const before = html;
  html = replaceSlot(html, "header", header);
  html = replaceSlot(html, "footer", footer);
  if (html !== before) { writeFileSync(p, html); changed++; console.log("  updated", f); }
}
console.log(`shell pre-rendered into ${changed} of ${files.length} pages`);
process.exit(0);

// Drop author comments and indentation: ~10KB -> ~6KB per page.
function slim(h) {
  return h.replace(/<!--[\s\S]*?-->/g, "").replace(/\n\s+/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

function replaceSlot(html, id, inner) {
  const marked = new RegExp(`(<div id="${id}">)<!--shell:${id}-->[\\s\\S]*?<!--/shell:${id}-->(</div>)`);
  if (marked.test(html)) return html.replace(marked, (_, a, b) => a + inner + b);
  // First run: slot is the empty placeholder.
  const empty = new RegExp(`<div id="${id}"></div>`);
  if (empty.test(html)) return html.replace(empty, () => `<div id="${id}">${inner}</div>`);
  return html;
}
