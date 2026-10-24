// assets/a11y.js — small shared helper for modal dialogs (UX-010, UX-020).
// openTrap() keeps Tab / Shift+Tab inside `container`, closes on Escape via
// `onEscape`, moves focus into the dialog, and returns a release() function
// that removes the trap and puts focus back on whatever opened it.
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function openTrap(container, { onEscape, initialFocus, returnTo } = {}) {
  // returnTo: element to refocus on release (Safari does not focus buttons on
  // click, so activeElement alone is not a reliable record of the opener).
  const trigger = returnTo || document.activeElement;
  const items = () =>
    Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
    );

  function onKey(e) {
    if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const list = items();
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    const inside = container.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", onKey, true);
  const start = initialFocus || items()[0];
  if (start) start.focus();

  return function release() {
    document.removeEventListener("keydown", onKey, true);
    if (trigger && typeof trigger.focus === "function" && document.contains(trigger)) {
      trigger.focus();
    }
  };
}
