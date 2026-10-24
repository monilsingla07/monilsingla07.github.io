// assets/icons.js
// Tiny inline-SVG icon helper (UX-062). One visual language everywhere:
// 24x24 viewBox, 1.5px stroke, no fill, currentColor, rounded caps/joins.
//
//   import { icon } from "./icons.js";
//   el.innerHTML = icon("check") + " Saved";
//   icon("close", { size: 18, label: "Close" })   // label -> role="img" + aria-label
//
// Icons are decorative (aria-hidden) unless a `label` is given. The returned
// strings are static markup (no user input), safe to assign to innerHTML.
const PATHS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  warning: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.01"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  "chevron-left": '<path d="M15 5l-7 7 7 7"/>',
  "chevron-right": '<path d="M9 5l7 7-7 7"/>',
  "chevron-up": '<path d="M5 15l7-7 7 7"/>',
  "chevron-down": '<path d="M5 9l7 7 7-7"/>',
  heart: '<path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z"/>',
  return: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  dot: '<circle cx="12" cy="12" r="3.5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9.4 15.6c.5.7 1.5 1.1 2.6 1.1 1.7 0 2.9-.8 2.9-2.1 0-1.3-1.3-1.7-2.9-2.1-1.6-.4-2.9-.8-2.9-2.1 0-1.3 1.2-2.1 2.9-2.1 1.1 0 2.1.4 2.6 1.1M12 6.3v1.1M12 16.6v1.1"/>',
};

export function icon(name, { size = 20, label = "", cls = "" } = {}) {
  const body = PATHS[name];
  if (!body) return "";
  const a11y = label ? `role="img" aria-label="${String(label).replace(/"/g, "&quot;")}"` : 'aria-hidden="true" focusable="false"';
  const c = "icon" + (cls ? " " + cls : "");
  return `<svg class="${c}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}

export const iconNames = Object.keys(PATHS);
