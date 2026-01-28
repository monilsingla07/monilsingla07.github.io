// assets/analytics.js (Plausible loader — loads only after consent)
import { ENV } from "./env.local.js";

export function loadAnalytics() {
  const domain = ENV?.PLAUSIBLE_DOMAIN;
  if (!domain) return;
  const s = document.createElement("script");
  s.defer = true;
  s.setAttribute("data-domain", domain);
  s.src = "https://plausible.io/js/plausible.js";
  document.head.appendChild(s);
}
