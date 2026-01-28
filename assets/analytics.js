// Load Plausible analytics only when consent has been given.
// Assumes assets/env.local.js provides ENV.PLAUSIBLE_DOMAIN
import { ENV } from "./env.local.js";

export function loadAnalytics() {
  const domain = ENV.PLAUSIBLE_DOMAIN;
  if (!domain) return;
  // Plausible
  const s = document.createElement("script");
  s.defer = true;
  s.setAttribute("data-domain", domain);
  s.src = "https://plausible.io/js/plausible.js";
  document.head.appendChild(s);
}