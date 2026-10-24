/* Consent-gated Google Analytics (GA4).
 *
 * Classic (non-module) script, loaded in <head> of every page. Nothing is
 * requested from Google until the visitor has accepted cookies:
 *   - the cookie banner (assets/ui.js renderCookieBanner) calls
 *     window.loadAnalytics() when "Accept" is clicked;
 *   - on later page loads it runs here if localStorage.cookieConsent === "accept".
 * Until then window.gtag is a no-op so cart.js etc. can call it safely and
 * nothing is queued for a later flush.
 */
(function () {
  var GA_ID = "G-CKQ1EXBHY6";
  var loaded = false;
  window.gtag = function () {};
  window.loadAnalytics = function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  };
  var consent = null;
  try { consent = localStorage.getItem("cookieConsent"); } catch (_) {}
  if (consent === "accept") window.loadAnalytics();
})();
