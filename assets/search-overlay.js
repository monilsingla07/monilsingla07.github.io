// assets/search-overlay.js
//
// Header search, reworked from "click Search → full navigation to a blank
// search.html page" into the standard e-commerce pattern: a dropdown panel
// that opens in place under the header, with debounced live results as you
// type (per UX guidance: "show predictions as user types", never a bare
// blank screen). search.html itself still exists as the full-results page
// (linked via "View all results" and reachable directly/shared as a URL —
// see its own updated empty state), this overlay is the fast path for the
// header search icon/link.

import { escapeHtml, escapeAttr } from "./safe.js";
import { searchProducts, renderSearchPreview } from "./search.js";

const PREVIEW_LIMIT = 6;
const DEBOUNCE_MS = 300;

// Shown when the panel first opens (no query yet) and preserved as a set of
// quick escape hatches even mid-search — this is the "don't leave the
// visitor at a blank screen" default the UX guidance calls out.
const QUICK_LINKS = [
  { label: "Sarees", href: "products.html?type=saree" },
  { label: "Suits", href: "products.html?type=suit" },
  { label: "New Arrivals", href: "new-arrivals.html" },
  { label: "Sale", href: "sale.html" },
];

let _mounted = false;
let _lastFocused = null;
let _debounceTimer = null;
let _closeFn = null;

function quickLinksHtml() {
  return `
    <div class="search-ov-section-label">Browse instead</div>
    <div class="search-ov-quicklinks">
      ${QUICK_LINKS.map((l) => `<a href="${escapeAttr(l.href)}">${escapeHtml(l.label)}</a>`).join("")}
    </div>
  `;
}

function promptStateHtml() {
  return `
    <div class="search-ov-prompt">Start typing to search sarees, suits, fabrics, colors…</div>
    ${quickLinksHtml()}
  `;
}

function noResultsHtml(query) {
  return `
    <div class="search-ov-prompt">No products found for "${escapeHtml(query)}" — try a different search term.</div>
    ${quickLinksHtml()}
  `;
}

function mount() {
  if (_mounted) return;
  _mounted = true;

  const overlay = document.createElement("div");
  overlay.id = "searchOverlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <style>
      #searchOverlay { position: fixed; inset: 0; top: var(--header-offset, 120px); z-index: 2000; }
      #searchOvBackdrop { position: absolute; inset: 0; background: rgba(20,14,10,.45); animation: searchOvFade .15s ease-out; }
      @keyframes searchOvFade { from { opacity: 0; } to { opacity: 1; } }
      #searchOvPanel {
        position: relative; background: #fff; border-bottom: 1px solid var(--border-light);
        box-shadow: 0 16px 40px rgba(0,0,0,.14);
        max-height: min(70vh, 620px); overflow-y: auto;
        animation: searchOvSlide .18s cubic-bezier(.16,1,.3,1);
      }
      @keyframes searchOvSlide { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      #searchOvInner { max-width: 720px; margin: 0 auto; padding: 18px 20px 26px; }
      #searchOvInputRow { display: flex; align-items: center; gap: 10px; border: 1.5px solid var(--border); border-radius: 999px; padding: 4px 6px 4px 16px; }
      #searchOvInputRow:focus-within { border-color: var(--brand); }
      #searchOvInputRow svg { flex-shrink: 0; color: var(--text-light); }
      #searchOvInput { flex: 1; border: none; outline: none; font-size: 16px; font-family: var(--font-body); padding: 10px 0; background: transparent; color: var(--text); }
      #searchOvClose {
        flex-shrink: 0; width: 34px; height: 34px; border-radius: 999px; border: none;
        background: var(--bg-warm); color: var(--text); font-size: 18px; line-height: 1;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
      #searchOvClose:hover { background: var(--brand-light); color: var(--brand); }
      #searchOvBody { margin-top: 16px; }
      .search-ov-prompt { font-size: 13px; color: var(--text-light); padding: 4px 2px 14px; }
      .search-ov-section-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-light); margin-bottom: 8px; }
      .search-ov-quicklinks { display: flex; flex-wrap: wrap; gap: 8px; }
      .search-ov-quicklinks a {
        font-size: 13px; font-weight: 600; text-decoration: none; color: var(--text);
        border: 1.5px solid var(--border); border-radius: 999px; padding: 7px 14px;
      }
      .search-ov-quicklinks a:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-lighter); }
      .search-preview-row { display: flex; align-items: center; gap: 12px; padding: 8px 4px; text-decoration: none; color: inherit; border-radius: 10px; }
      .search-preview-row:hover { background: var(--bg-warm); }
      .search-preview-thumb { width: 48px; height: 60px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: var(--bg-warm); }
      .search-preview-info { min-width: 0; }
      .search-preview-title { font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .search-preview-price { font-size: 13px; margin-top: 3px; }
      #searchOvViewAll {
        display: block; text-align: center; margin-top: 10px; padding: 11px; border-radius: 10px;
        font-size: 13px; font-weight: 700; color: var(--brand); text-decoration: none;
        border: 1.5px solid var(--border);
      }
      #searchOvViewAll:hover { border-color: var(--brand); background: var(--brand-lighter); }
      @media (max-width: 560px) {
        #searchOvInner { padding: 14px 16px 20px; }
        .search-preview-title { max-width: 46vw; }
      }
    </style>
    <div id="searchOvBackdrop"></div>
    <div id="searchOvPanel" role="search" aria-label="Search products">
      <div id="searchOvInner">
        <div id="searchOvInputRow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>
          </svg>
          <input id="searchOvInput" type="text" placeholder="Search for sarees, fabrics, colors…" autocomplete="off" aria-label="Search" />
          <button id="searchOvClose" type="button" aria-label="Close search">&times;</button>
        </div>
        <div id="searchOvBody">${promptStateHtml()}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const backdrop = overlay.querySelector("#searchOvBackdrop");
  const input = overlay.querySelector("#searchOvInput");
  const closeBtn = overlay.querySelector("#searchOvClose");
  const body = overlay.querySelector("#searchOvBody");

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    clearTimeout(_debounceTimer);
    document.body.style.overflow = "";
    window.removeEventListener("keydown", onKeydown);
    if (_lastFocused && document.contains(_lastFocused)) _lastFocused.focus();
  }
  _closeFn = close;

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  function goToFullResults(query) {
    window.location.href = "search.html?q=" + encodeURIComponent(query);
  }

  async function runSearch(query) {
    body.innerHTML = `<div class="search-ov-prompt">Searching…</div>`;
    try {
      const { data: products, error } = await searchProducts(query);
      if (error) {
        body.innerHTML = `<div class="search-ov-prompt">Something went wrong searching — please try again.</div>`;
        return;
      }
      if (!products.length) {
        body.innerHTML = noResultsHtml(query);
        return;
      }
      const preview = products.slice(0, PREVIEW_LIMIT);
      body.innerHTML = `
        ${renderSearchPreview(preview)}
        <a id="searchOvViewAll" href="search.html?q=${encodeURIComponent(query)}">
          View all ${products.length}${products.length >= 20 ? "+" : ""} result${products.length === 1 ? "" : "s"} for "${escapeHtml(query)}" →
        </a>
      `;
    } catch (_e) {
      body.innerHTML = `<div class="search-ov-prompt">Something went wrong searching — please try again.</div>`;
    }
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(_debounceTimer);
    if (q.length < 2) {
      body.innerHTML = promptStateHtml();
      return;
    }
    _debounceTimer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = input.value.trim();
      if (q.length >= 2) goToFullResults(q);
    }
  });

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  overlay._open = () => {
    _lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeydown);
    input.value = "";
    body.innerHTML = promptStateHtml();
    // Let the panel paint before focusing, avoids an iOS Safari scroll jump.
    setTimeout(() => input.focus(), 30);
  };
}

export function openSearchOverlay() {
  mount();
  document.getElementById("searchOverlay")._open();
}

export function closeSearchOverlay() {
  if (_closeFn) _closeFn();
}
