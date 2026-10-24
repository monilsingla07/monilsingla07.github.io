// assets/policy-summary.js
// Single source for the 3-line policy summary shown beside the buy action
// (product.html) and above Checkout (cart.html) - UX-023. Edit the wording
// here and every mention stays in sync. Mirrors the 48h defect-only policy
// on returns.html / help.html.
export const POLICY_LINES = [
  {
    icon: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
    text: "Complimentary shipping, delivered in 3-5 days",
  },
  {
    icon: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    text: "Returns for manufacturing defects within 48h, with photo evidence",
    link: { href: "returns.html", label: "View policy" },
  },
  {
    icon: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    text: "Cancel before dispatch for a full refund",
    link: { href: "help.html", label: "How" },
  },
];

export function policySummaryHtml() {
  const items = POLICY_LINES.map((l) =>
    '<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    l.icon + "</svg><span>" + l.text +
    (l.link ? ' <a href="' + l.link.href + '">' + l.link.label + "</a>" : "") +
    "</span></li>"
  ).join("");
  return '<ul class="policy-summary" aria-label="Shipping, returns and cancellation">' + items + "</ul>";
}

// Fills every [data-policy-summary] placeholder on the page.
export function mountPolicySummary(root = document) {
  root.querySelectorAll("[data-policy-summary]").forEach((el) => { el.innerHTML = policySummaryHtml(); });
}
