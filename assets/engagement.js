// assets/engagement.js
//
// Gate for promotional popups (UX-024): they must not open the moment a page
// loads. whenEngaged(cb) runs cb once the visitor has shown real interest,
// i.e. the first of:
//   - adding an item to the cart            (assets/cart.js fires "ahamstree:cart-add")
//   - scrolling past 50% of the current page
//   - opening a second page in this browser session
// Listeners are attached when this module is first imported (page load), so an
// early interaction is remembered even if the popup config is still loading.

const PV_KEY = "ahamstree_session_pageviews";

let engaged = false;
const waiting = [];

function fire() {
  if (engaged) return;
  engaged = true;
  detach();
  // Small delay so the popup doesn't land mid-click / mid-scroll.
  setTimeout(() => { waiting.splice(0).forEach((cb) => { try { cb(); } catch (_) {} }); }, 400);
}

function onScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  if (max > 0 && window.scrollY / max >= 0.5) fire();
}
function onCartAdd() { fire(); }

function detach() {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("ahamstree:cart-add", onCartAdd);
}

(function init() {
  if (typeof window === "undefined") return;

  // Count this page view for the session (a plain reload is not a new page).
  let views = 1;
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    const isReload = nav?.type === "reload";
    views = Math.max(1, Number(sessionStorage.getItem(PV_KEY) || 0) + (isReload ? 0 : 1));
    sessionStorage.setItem(PV_KEY, String(views));
  } catch (_) {}

  if (views >= 2) { fire(); return; }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("ahamstree:cart-add", onCartAdd);
})();

export function whenEngaged(cb) {
  if (engaged) setTimeout(() => { try { cb(); } catch (_) {} }, 0);
  else waiting.push(cb);
}
