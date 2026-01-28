// assets/cookie-consent.js
export function showCookieConsent(onAccept) {
  try {
    if (localStorage.getItem("aham_cookie_consent") === "accepted") {
      onAccept && onAccept();
      return;
    }

    const bar = document.createElement("div");
    bar.style = "position:fixed;left:12px;right:12px;bottom:12px;padding:12px;border-radius:10px;background:#fff;border:1px solid #eee;z-index:9999;display:flex;gap:12px;align-items:center;box-shadow:0 6px 18px rgba(0,0,0,.06)";
    bar.innerHTML = `
      <div style="flex:1;">
        We use analytics to improve the site. By clicking "Accept" you agree to tracking. Read our <a href="privacy.html">privacy policy</a>.
      </div>
      <div>
        <button id="aham-accept" class="btn">Accept</button>
        <button id="aham-reject" class="btn secondary">Reject</button>
      </div>
    `;
    document.body.appendChild(bar);

    bar.querySelector("#aham-accept").addEventListener("click", () => {
      localStorage.setItem("aham_cookie_consent", "accepted");
      onAccept && onAccept();
      bar.remove();
    });
    bar.querySelector("#aham-reject").addEventListener("click", () => {
      localStorage.setItem("aham_cookie_consent", "rejected");
      bar.remove();
    });
  } catch (err) {
    // fail silently
    console.warn("Cookie consent failed", err);
  }
}
