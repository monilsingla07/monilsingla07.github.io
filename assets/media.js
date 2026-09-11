// assets/media.js
//
// Presentation-side helpers for images. Kept separate from safe.js (which is
// purely about escaping untrusted values) because these are about *what* to
// load, not about making a value safe to interpolate.

// Product cards carry a second "hover swap" photo that cross-fades in on
// mouse-over. A touch device can never trigger that hover, but the <img> is
// still in the DOM, so the browser downloads the full-size second photo for
// every card and then keeps it at opacity:0 forever — roughly doubling the
// image bytes a phone visitor pays for, for an effect they cannot see.
//
// Evaluated per call rather than once at module load so a page that re-renders
// after a window/input change picks up the new answer. Note that an already
// rendered grid is NOT re-evaluated — switching input mid-page keeps whatever
// the cards were built with until the next render, which is a fair trade for
// not wiring a resize listener into every listing page.
export function supportsHover() {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    // Very old browsers without matchMedia: assume hover works, which only
    // costs bytes rather than breaking the layout.
    return true;
  }
}

/**
 * The hover-swap image URL to render, or "" to render no hover image at all.
 *
 * Card renderers gate the whole hover treatment on this one value — the
 * second <img>, the `p-card-img-primary` class and the `has-hover-img`
 * class — so returning "" cleanly removes all of it on touch devices.
 *
 * @param {string|null|undefined} url - the product's second image, if any
 * @returns {string}
 */
export function hoverImageUrl(url) {
  if (!url) return "";
  return supportsHover() ? url : "";
}
