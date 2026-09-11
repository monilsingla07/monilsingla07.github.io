// assets/media.js
//
// Presentation-side helpers for images. Kept separate from safe.js (which is
// purely about escaping untrusted values) because these are about *what* to
// load, not about making a value safe to interpolate.

import { safeSrc } from "./safe.js";

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

// Width of the grid rendition produced at upload (see image-resize.js). Kept
// in sync by hand rather than imported, because the storefront must not pull
// in the admin-only resize module just to render a card.
const THUMB_WIDTH = 700;

// How wide a product card's image box actually is, per breakpoint. Measured
// from the live grid: 2 columns of 172px at 390px wide, up to 4 columns of
// 306px on a 1440px desktop. Without this the browser assumes the image fills
// the viewport and picks the largest candidate every time, which would undo
// the point of offering a small one.
const CARD_SIZES = "(max-width: 560px) 46vw, (max-width: 980px) 30vw, 320px";

/**
 * The srcset/sizes/width/height attributes for a product image in a card-sized
 * slot, as a string to drop into an <img> tag.
 *
 * Degrades in every direction: with no thumb the image renders exactly as it
 * always did, and with no stored width no `w` descriptors are claimed (a wrong
 * descriptor makes the browser choose badly, so a missing one is preferable to
 * a guessed one).
 *
 * @param {{thumb_url?: string|null, width?: number|null, height?: number|null}} img
 * @param {string} [sizes] - CSS `sizes` for the slot; defaults to a product card
 * @returns {string} attributes, pre-escaped, or "" when nothing can be offered
 */
export function cardImageAttrs(img, sizes = CARD_SIZES) {
  if (!img) return "";
  const parts = [];

  const width = Number(img.width) || 0;
  const height = Number(img.height) || 0;
  // Intrinsic size reserves the right box before the bytes arrive, so cards
  // stop reflowing as images land.
  if (width > 0 && height > 0) parts.push(`width="${width}" height="${height}"`);

  const thumb = img.thumb_url ? safeSrc(img.thumb_url) : "";
  const full = img.image_url ? safeSrc(img.image_url) : "";
  if (thumb && full && width > THUMB_WIDTH) {
    parts.push(`srcset="${thumb} ${THUMB_WIDTH}w, ${full} ${width}w"`);
    parts.push(`sizes="${sizes}"`);
  }

  return parts.join(" ");
}

/**
 * The `src` a card should use: the small rendition when one exists, so that
 * browsers which ignore srcset still get the cheap file.
 */
export function cardImageSrc(img) {
  if (!img) return "";
  return safeSrc(img.thumb_url || img.image_url);
}

/**
 * Flatten a product row's joined product_images into the fields the card
 * templates expect. Every listing page repeated this sort-then-pick block;
 * having one copy is what lets a change like srcset land in a single place.
 *
 * Adds `_img` / `_imgHover` (the full image records, for cardImageAttrs)
 * alongside the plain `image_url` / `image_url_hover` the templates already
 * branch on.
 *
 * @param {Object} product - a products row with a joined product_images array
 * @returns {Object} the product with image fields resolved
 */
export function withCardImages(product) {
  const imgs = (product?.product_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const primary = imgs[0] ?? null;
  // The hover rendition is dropped entirely on touch devices — see above.
  const hover = hoverImageUrl(imgs[1]?.image_url) ? imgs[1] : null;

  return {
    ...product,
    image_url: primary?.image_url ?? "",
    image_url_hover: hover?.image_url ?? "",
    _img: primary,
    _imgHover: hover,
  };
}
