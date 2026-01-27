export function setTopBanner(show) {
  const b = document.getElementById("topBanner");
  if (!b) return;
  if (show) {
    b.classList.remove("hidden");
    b.textContent = "New user offer: Get 10% off with WELCOME10 (applied at checkout)";
  } else {
    b.classList.add("hidden");
  }
}

export function startHeroCarousel() {
  const title = document.getElementById("heroTitle");
  const sub = document.getElementById("heroSubtitle");
  if (!title || !sub) return;

  const slides = [
    ["Chanderi Drop", "Limited pieces. Timeless craft."],
    ["New here? 10% off", "Use WELCOME10 at checkout (login required)."],
    ["Shipping across India", "Global shipping coming soon."]
  ];

  let i = 0;
  setInterval(() => {
    i = (i + 1) % slides.length;
    title.textContent = slides[i][0];
    sub.textContent = slides[i][1];
  }, 3500);
}

